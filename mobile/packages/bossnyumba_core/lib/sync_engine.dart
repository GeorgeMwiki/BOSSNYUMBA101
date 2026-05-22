// ---------------------------------------------------------------------------
// sync_engine.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA offline-first sync engine — outbox + replay pattern.
//
// What BELONGS in this file:
//   * The abstract `SyncEngine` contract every implementation (production,
//     in-memory, fake) must satisfy.
//   * The `QueuedMutation` record + `SyncStatus` value type that surface
//     pending-count, errors, and last-sync timestamp to the UI.
//   * The conflict-resolution enum (`ConflictPolicy`) mirroring backend.
//   * BOSSNYUMBA-specific entity tagging so the engine can prioritise
//     payment mutations ahead of, e.g., maintenance ticket edits.
//
// What does NOT belong here:
//   * Concrete Drift / Dio wiring → goes in `sync_engine_impl.dart`
//     (added in a later phase).
//   * Backend reconciliation logic → server-side problem.
//
// Conflict resolution: `server_wins_with_audit` (mirrors web RBAC mobile
// policy). Local mutations that lose a conflict are NOT silently dropped —
// they are preserved in the outbox with status `conflicted` for manual
// review by the operator.
//
// Cached / sync-able BOSSNYUMBA entities (see `database/database.dart`):
//   1. Property             — building / estate
//   2. Unit                 — individual rentable unit
//   3. Lease                — tenant ⇄ unit agreement
//   4. Tenant               — resident profile
//   5. Payment              — rent / fee transaction (highest priority)
//   6. MaintenanceTicket    — issue raised by tenant
// ---------------------------------------------------------------------------

import 'dart:async';

/// The high-level entity domain a mutation targets.
///
/// Used by the sync engine to prioritise replays — for example, queued
/// `payment` mutations should drain before `maintenanceTicket` mutations
/// so a tenant's M-Pesa reconciliation can land before a low-priority
/// photo upload.
enum SyncEntity {
  property,
  unit,
  lease,
  tenant,
  payment,
  maintenanceTicket,
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
///
/// Persisted to the encrypted Drift outbox table; survives app kills,
/// crashes, and device reboots.
class QueuedMutation {
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
}

/// Public sync status surfaced to UI (offline banner, sync indicator).
class SyncStatus {
  final int pendingCount;
  final bool isSyncing;
  final String? lastError;
  final DateTime? lastSyncAt;

  const SyncStatus({
    required this.pendingCount,
    required this.isSyncing,
    this.lastError,
    this.lastSyncAt,
  });
}

/// Abstract sync engine contract.
///
/// Concrete implementation will be added in a later phase. App code should
/// depend on this interface (via Riverpod provider) rather than the
/// concrete class so tests can swap in a fake.
abstract class SyncEngine {
  /// Stream of sync status changes for UI badges.
  Stream<SyncStatus> get statusStream;

  /// Current number of pending mutations in the outbox.
  int get pendingCount;

  /// Start listening for connectivity changes; replay anything pending.
  ///
  /// Called once during app boot. Idempotent.
  Future<void> start();

  /// Release stream controllers and connectivity subscriptions.
  void dispose();

  /// Enqueue a mutation for later sync.
  ///
  /// Persists to the encrypted outbox immediately, then attempts a sync
  /// pass if the device is online. Called by API interceptors when a
  /// mutation fails due to network error OR proactively when the user
  /// performs an offline-first action (e.g. drafting a payment).
  Future<void> queueMutation({
    required SyncEntity entity,
    required String url,
    required String method,
    String? body,
    Map<String, String>? headers,
  }) {
    throw UnimplementedError(
      'queueMutation() must be implemented by SyncEngine subclasses',
    );
  }

  /// Force a sync pass immediately (e.g. user pulled-to-refresh).
  Future<void> syncNow() {
    throw UnimplementedError(
      'syncNow() must be implemented by SyncEngine subclasses',
    );
  }

  /// Retry every mutation currently in `failed` status.
  Future<void> retryFailed() {
    throw UnimplementedError(
      'retryFailed() must be implemented by SyncEngine subclasses',
    );
  }

  /// Resolve a conflict for a specific mutation according to [policy].
  ///
  /// Default policy at the engine level is [ConflictPolicy.serverWinsWithAudit];
  /// callers may override per-mutation for entities under client authority.
  Future<void> resolveConflict({
    required String mutationId,
    required ConflictPolicy policy,
  }) {
    throw UnimplementedError(
      'resolveConflict() must be implemented by SyncEngine subclasses',
    );
  }
}
