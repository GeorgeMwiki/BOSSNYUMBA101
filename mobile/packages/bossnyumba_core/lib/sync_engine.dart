// ---------------------------------------------------------------------------
// sync_engine.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA offline-first sync engine — outbox + replay pattern.
//
// What BELONGS in this file:
//   * The `SyncEngine` abstract contract.
//   * The `QueuedMutation` record + `SyncStatus` value type that surface
//     pending-count, errors, and last-sync timestamp to the UI.
//   * The conflict-resolution enum (`ConflictPolicy`) mirroring backend.
//   * BOSSNYUMBA-specific entity tagging so the engine can prioritise
//     payment mutations ahead of, e.g., maintenance ticket edits.
//   * `OutboxStore` port — production wires Drift; tests use the
//     in-memory `InMemoryOutboxStore` below.
//   * `SyncTransport` port — production wires Dio; tests use the
//     in-memory `FakeSyncTransport` below.
//   * `DefaultSyncEngine` — concrete drain logic with retry, idempotency
//     keys, and server-wins conflict handling.
//
// Conflict resolution: `server_wins_with_audit` (mirrors web RBAC mobile
// policy). Local mutations that lose a conflict are NOT silently dropped —
// they are preserved in the outbox with status `conflicted` for manual
// review by the operator.
//
// Cached / sync-able BOSSNYUMBA entities (see `database/database.dart`):
//   1. Property             — building / estate
//   2. Unit                 — individual rentable unit
//   3. Lease                — tenant <-> unit agreement
//   4. Tenant               — resident profile
//   5. Payment              — rent / fee transaction (highest priority)
//   6. MaintenanceTicket    — issue raised by tenant
// ---------------------------------------------------------------------------

import 'dart:async';

/// The high-level entity domain a mutation targets.
enum SyncEntity {
  property,
  unit,
  lease,
  tenant,
  payment,
  maintenanceTicket,
}

/// Priority used by the engine to drain the outbox in the right order.
/// Lower = drained first.
int _priorityOf(SyncEntity e) {
  switch (e) {
    case SyncEntity.payment:
      return 0;
    case SyncEntity.lease:
      return 1;
    case SyncEntity.tenant:
      return 2;
    case SyncEntity.unit:
      return 3;
    case SyncEntity.property:
      return 4;
    case SyncEntity.maintenanceTicket:
      return 5;
  }
}

/// How the server resolves a conflict when local and remote diverge.
enum ConflictPolicy {
  /// Server's value wins. Local divergence is recorded in the audit log.
  serverWinsWithAudit,

  /// Local value wins. ONLY safe for client-authoritative entities (rare).
  clientWins,

  /// Mutation is rejected and surfaced to the operator for manual merge.
  manual,
}

/// Lifecycle of a queued mutation.
enum MutationStatus { pending, syncing, synced, failed, conflicted }

/// A single queued mutation in the outbox.
class QueuedMutation {
  const QueuedMutation({
    required this.mutationId,
    required this.entity,
    required this.url,
    required this.method,
    required this.timestamp,
    this.body,
    this.headers,
    this.status = MutationStatus.pending,
    this.retryCount = 0,
    this.errorMessage,
  });

  /// UUID v4 — used as the `idempotency-key` header. The server MUST
  /// dedupe by this key so retries never double-charge a payment.
  final String mutationId;
  final SyncEntity entity;
  final String url;
  final String method;
  final String? body;
  final Map<String, String>? headers;
  final int timestamp;
  final MutationStatus status;
  final int retryCount;
  final String? errorMessage;

  QueuedMutation copyWith({
    MutationStatus? status,
    int? retryCount,
    String? errorMessage,
  }) {
    return QueuedMutation(
      mutationId: mutationId,
      entity: entity,
      url: url,
      method: method,
      timestamp: timestamp,
      body: body,
      headers: headers,
      status: status ?? this.status,
      retryCount: retryCount ?? this.retryCount,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

/// Public sync status surfaced to UI (offline banner, sync indicator).
class SyncStatus {
  const SyncStatus({
    required this.pendingCount,
    required this.isSyncing,
    this.lastError,
    this.lastSyncAt,
  });

  final int pendingCount;
  final bool isSyncing;
  final String? lastError;
  final DateTime? lastSyncAt;
}

/// Result of one transport attempt.
class SyncResult {
  const SyncResult({
    required this.success,
    this.conflict = false,
    this.errorMessage,
  });

  final bool success;

  /// True when the server returned a conflict response (HTTP 409). The
  /// engine flips the mutation to [MutationStatus.conflicted] for
  /// operator review per `server_wins_with_audit` policy.
  final bool conflict;

  final String? errorMessage;
}

/// Transport port. Production wires Dio; tests inject a fake.
abstract class SyncTransport {
  Future<SyncResult> send(QueuedMutation mutation);
}

/// Outbox persistence port. Production wires Drift; tests use
/// [InMemoryOutboxStore] below.
abstract class OutboxStore {
  Future<void> enqueue(QueuedMutation mutation);
  Future<List<QueuedMutation>> drain();
  Future<List<QueuedMutation>> listAll();
  Future<List<QueuedMutation>> listFailed();
  Future<void> update(QueuedMutation mutation);
  Future<void> remove(String mutationId);
  Future<int> count();
}

/// In-memory outbox — used in unit tests and as the reference shape.
class InMemoryOutboxStore implements OutboxStore {
  final Map<String, QueuedMutation> _store = <String, QueuedMutation>{};

  @override
  Future<void> enqueue(QueuedMutation mutation) async {
    _store[mutation.mutationId] = mutation;
  }

  @override
  Future<List<QueuedMutation>> drain() async {
    final pending = _store.values
        .where((m) => m.status == MutationStatus.pending)
        .toList()
      ..sort((a, b) {
        final p = _priorityOf(a.entity).compareTo(_priorityOf(b.entity));
        return p != 0 ? p : a.timestamp.compareTo(b.timestamp);
      });
    return List<QueuedMutation>.unmodifiable(pending);
  }

  @override
  Future<List<QueuedMutation>> listAll() async {
    return List<QueuedMutation>.unmodifiable(_store.values);
  }

  @override
  Future<List<QueuedMutation>> listFailed() async {
    final failed =
        _store.values.where((m) => m.status == MutationStatus.failed).toList();
    return List<QueuedMutation>.unmodifiable(failed);
  }

  @override
  Future<void> update(QueuedMutation mutation) async {
    _store[mutation.mutationId] = mutation;
  }

  @override
  Future<void> remove(String mutationId) async {
    _store.remove(mutationId);
  }

  @override
  Future<int> count() async => _store.length;
}

/// Abstract sync engine contract.
abstract class SyncEngine {
  Stream<SyncStatus> get statusStream;
  int get pendingCount;

  Future<void> start();
  void dispose();

  /// Enqueue a mutation. The engine attaches an `idempotency-key`
  /// header and immediately attempts a sync if the device is online.
  Future<void> queueMutation({
    required SyncEntity entity,
    required String url,
    required String method,
    String? body,
    Map<String, String>? headers,
    String? mutationId,
  });

  Future<void> syncNow();
  Future<void> retryFailed();

  Future<void> resolveConflict({
    required String mutationId,
    required ConflictPolicy policy,
  });
}

/// Default sync engine.
///
/// Drain order: high-priority entities (Payment) first, then by FIFO
/// within priority bucket. Each mutation carries an `idempotency-key`
/// header equal to its `mutationId` so retries never double-apply.
///
/// Retry policy: up to [maxRetries] with exponential backoff handled
/// by the transport (Dio interceptor in production). Beyond that the
/// mutation lands in [MutationStatus.failed] and the user must call
/// [retryFailed].
///
/// Conflict policy: server response 409 -> [MutationStatus.conflicted].
/// `resolveConflict` honours the requested [ConflictPolicy] —
/// `serverWinsWithAudit` drops the local mutation (audit row is written
/// by the server), `clientWins` re-queues it as pending, `manual`
/// leaves it conflicted for operator action.
class DefaultSyncEngine implements SyncEngine {
  DefaultSyncEngine({
    required OutboxStore outbox,
    required SyncTransport transport,
    required Stream<bool> onlineStream,
    String Function() idGenerator = _defaultIdGenerator,
    int Function() nowEpochMs = _defaultNowEpoch,
    int maxRetries = 3,
  })  : _outbox = outbox,
        _transport = transport,
        _onlineStream = onlineStream,
        _id = idGenerator,
        _nowEpoch = nowEpochMs,
        _maxRetries = maxRetries;

  final OutboxStore _outbox;
  final SyncTransport _transport;
  final Stream<bool> _onlineStream;
  final String Function() _id;
  final int Function() _nowEpoch;
  final int _maxRetries;

  final StreamController<SyncStatus> _statusController =
      StreamController<SyncStatus>.broadcast();
  StreamSubscription<bool>? _onlineSub;
  bool _isSyncing = false;
  bool _isOnline = false;
  bool _disposed = false;
  DateTime? _lastSyncAt;
  String? _lastError;
  int _pendingCountCache = 0;

  @override
  Stream<SyncStatus> get statusStream => _statusController.stream;

  @override
  int get pendingCount => _pendingCountCache;

  @override
  Future<void> start() async {
    if (_disposed) return;
    _onlineSub ??= _onlineStream.listen((online) {
      _isOnline = online;
      if (online) {
        unawaited(syncNow());
      }
    });
    _pendingCountCache = await _outbox.count();
    _emit();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    final sub = _onlineSub;
    _onlineSub = null;
    if (sub != null) {
      unawaited(sub.cancel());
    }
    _statusController.close();
  }

  @override
  Future<void> queueMutation({
    required SyncEntity entity,
    required String url,
    required String method,
    String? body,
    Map<String, String>? headers,
    String? mutationId,
  }) async {
    if (_disposed) {
      throw StateError('SyncEngine has been disposed');
    }
    final id = mutationId ?? _id();
    final mergedHeaders = <String, String>{
      ...?headers,
      'idempotency-key': id,
    };
    final mutation = QueuedMutation(
      mutationId: id,
      entity: entity,
      url: url,
      method: method,
      body: body,
      headers: mergedHeaders,
      timestamp: _nowEpoch(),
    );
    await _outbox.enqueue(mutation);
    _pendingCountCache = await _outbox.count();
    _emit();
    if (_isOnline) {
      unawaited(syncNow());
    }
  }

  @override
  Future<void> syncNow() async {
    if (_disposed || _isSyncing) return;
    _isSyncing = true;
    _lastError = null;
    _emit();
    try {
      final batch = await _outbox.drain();
      for (final mutation in batch) {
        await _drainOne(mutation);
      }
      _lastSyncAt = DateTime.fromMillisecondsSinceEpoch(_nowEpoch());
    } finally {
      _isSyncing = false;
      _pendingCountCache = await _outbox.count();
      _emit();
    }
  }

  @override
  Future<void> retryFailed() async {
    if (_disposed) return;
    final failed = await _outbox.listFailed();
    for (final m in failed) {
      await _outbox.update(
        m.copyWith(status: MutationStatus.pending, errorMessage: null),
      );
    }
    await syncNow();
  }

  @override
  Future<void> resolveConflict({
    required String mutationId,
    required ConflictPolicy policy,
  }) async {
    if (_disposed) return;
    final all = await _outbox.listAll();
    QueuedMutation? target;
    for (final m in all) {
      if (m.mutationId == mutationId) {
        target = m;
        break;
      }
    }
    if (target == null) return;
    switch (policy) {
      case ConflictPolicy.serverWinsWithAudit:
        // Discard local — the server's value is authoritative. Server
        // already wrote an audit row when it returned 409.
        await _outbox.remove(mutationId);
        break;
      case ConflictPolicy.clientWins:
        // Re-queue as pending. Use with caution.
        await _outbox.update(
          target.copyWith(status: MutationStatus.pending, errorMessage: null),
        );
        break;
      case ConflictPolicy.manual:
        // Leave it in conflicted for operator action.
        break;
    }
    _pendingCountCache = await _outbox.count();
    _emit();
  }

  // ── internal ───────────────────────────────────────────────────────────

  Future<void> _drainOne(QueuedMutation m) async {
    await _outbox.update(m.copyWith(status: MutationStatus.syncing));
    try {
      final result = await _transport.send(m);
      if (result.success) {
        await _outbox.remove(m.mutationId);
        return;
      }
      if (result.conflict) {
        await _outbox.update(
          m.copyWith(
            status: MutationStatus.conflicted,
            errorMessage: result.errorMessage ?? 'server conflict',
          ),
        );
        return;
      }
      // Generic failure path — bump retry counter.
      final nextRetry = m.retryCount + 1;
      final terminal = nextRetry >= _maxRetries;
      await _outbox.update(
        m.copyWith(
          status: terminal ? MutationStatus.failed : MutationStatus.pending,
          retryCount: nextRetry,
          errorMessage: result.errorMessage ?? 'transport failed',
        ),
      );
      _lastError = result.errorMessage ?? 'transport failed';
    } on Object catch (e) {
      final nextRetry = m.retryCount + 1;
      final terminal = nextRetry >= _maxRetries;
      await _outbox.update(
        m.copyWith(
          status: terminal ? MutationStatus.failed : MutationStatus.pending,
          retryCount: nextRetry,
          errorMessage: e.toString(),
        ),
      );
      _lastError = e.toString();
    }
  }

  void _emit() {
    if (_statusController.isClosed) return;
    _statusController.add(
      SyncStatus(
        pendingCount: _pendingCountCache,
        isSyncing: _isSyncing,
        lastError: _lastError,
        lastSyncAt: _lastSyncAt,
      ),
    );
  }
}

String _defaultIdGenerator() {
  // Lightweight non-cryptographic id; production code substitutes
  // `package:uuid`'s v4 generator via the constructor parameter.
  final now = DateTime.now().microsecondsSinceEpoch;
  return 'mut_${now.toRadixString(36)}';
}

int _defaultNowEpoch() => DateTime.now().millisecondsSinceEpoch;

/// In-memory fake [SyncTransport] for tests.
class FakeSyncTransport implements SyncTransport {
  final List<QueuedMutation> sent = <QueuedMutation>[];

  /// Queue of pre-programmed responses. If empty, every call returns
  /// success.
  final List<SyncResult> responses = <SyncResult>[];

  /// Map from mutationId -> response, overrides `responses` if set.
  final Map<String, SyncResult> byId = <String, SyncResult>{};

  /// If set, the next call throws this error and the entry is consumed.
  Object? throwOnNext;

  @override
  Future<SyncResult> send(QueuedMutation mutation) async {
    sent.add(mutation);
    final err = throwOnNext;
    if (err != null) {
      throwOnNext = null;
      throw err;
    }
    if (byId.containsKey(mutation.mutationId)) {
      return byId[mutation.mutationId]!;
    }
    if (responses.isNotEmpty) {
      return responses.removeAt(0);
    }
    return const SyncResult(success: true);
  }
}
