// ---------------------------------------------------------------------------
// sync_engine_test.dart
// ---------------------------------------------------------------------------
// Unit tests for `DefaultSyncEngine`.
//
// Covers:
//   1. queueMutation persists to outbox and attaches idempotency-key
//   2. syncNow drains pending in priority order (payment first)
//   3. successful drain removes the mutation from outbox
//   4. transient failure bumps retry count, keeps it pending
//   5. terminal failure (>= maxRetries) marks failed
//   6. 409 conflict response marks conflicted (server_wins_with_audit)
//   7. resolveConflict(serverWinsWithAudit) discards the mutation
//   8. resolveConflict(clientWins) re-queues as pending
//   9. retryFailed flips failed -> pending and re-drains
// ---------------------------------------------------------------------------

import 'dart:async';

import 'package:bossnyumba_core/sync_engine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DefaultSyncEngine', () {
    late InMemoryOutboxStore outbox;
    late FakeSyncTransport transport;
    late StreamController<bool> onlineCtrl;
    late DefaultSyncEngine engine;
    var idCounter = 0;

    setUp(() {
      outbox = InMemoryOutboxStore();
      transport = FakeSyncTransport();
      onlineCtrl = StreamController<bool>.broadcast();
      idCounter = 0;
      engine = DefaultSyncEngine(
        outbox: outbox,
        transport: transport,
        onlineStream: onlineCtrl.stream,
        idGenerator: () => 'mut-${++idCounter}',
        nowEpochMs: () => 1000 * idCounter,
        maxRetries: 3,
      );
    });

    tearDown(() async {
      engine.dispose();
      await onlineCtrl.close();
    });

    test('queueMutation persists with idempotency-key header', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
        body: '{"amount":250000}',
      );
      final all = await outbox.listAll();
      expect(all, hasLength(1));
      expect(all.first.entity, SyncEntity.payment);
      expect(all.first.headers, isNotNull);
      expect(all.first.headers!['idempotency-key'], 'mut-1');
    });

    test('syncNow drains payment ahead of maintenance ticket', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.maintenanceTicket,
        url: '/api/maintenance',
        method: 'POST',
      );
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      await engine.syncNow();
      expect(transport.sent, hasLength(2));
      // Payment must arrive first regardless of insertion order.
      expect(transport.sent.first.entity, SyncEntity.payment);
      expect(transport.sent.last.entity, SyncEntity.maintenanceTicket);
      expect(await outbox.count(), 0);
    });

    test('successful drain removes mutation from outbox', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      await engine.syncNow();
      expect(await outbox.count(), 0);
    });

    test('transient failure bumps retry count + stays pending', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      transport.responses.add(const SyncResult(
        success: false,
        errorMessage: 'timeout',
      ));
      await engine.syncNow();
      final all = await outbox.listAll();
      expect(all, hasLength(1));
      expect(all.first.status, MutationStatus.pending);
      expect(all.first.retryCount, 1);
      expect(all.first.errorMessage, 'timeout');
    });

    test('terminal failure after maxRetries marks failed', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      for (var i = 0; i < 3; i++) {
        transport.responses.add(const SyncResult(
          success: false,
          errorMessage: 'flaky',
        ));
        await engine.syncNow();
      }
      final all = await outbox.listAll();
      expect(all, hasLength(1));
      expect(all.first.status, MutationStatus.failed);
      expect(all.first.retryCount, 3);
    });

    test('409 conflict marks the mutation conflicted', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      transport.responses.add(const SyncResult(
        success: false,
        conflict: true,
        errorMessage: 'server conflict',
      ));
      await engine.syncNow();
      final all = await outbox.listAll();
      expect(all, hasLength(1));
      expect(all.first.status, MutationStatus.conflicted);
    });

    test('resolveConflict(serverWinsWithAudit) drops the local mutation',
        () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      transport.responses.add(const SyncResult(success: false, conflict: true));
      await engine.syncNow();
      await engine.resolveConflict(
        mutationId: 'mut-1',
        policy: ConflictPolicy.serverWinsWithAudit,
      );
      expect(await outbox.count(), 0);
    });

    test('resolveConflict(clientWins) re-queues as pending', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      transport.responses.add(const SyncResult(success: false, conflict: true));
      await engine.syncNow();
      await engine.resolveConflict(
        mutationId: 'mut-1',
        policy: ConflictPolicy.clientWins,
      );
      final all = await outbox.listAll();
      expect(all, hasLength(1));
      expect(all.first.status, MutationStatus.pending);
    });

    test('retryFailed flips failed entries to pending and re-drains',
        () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      for (var i = 0; i < 3; i++) {
        transport.responses.add(const SyncResult(success: false));
        await engine.syncNow();
      }
      // Now mark transport healthy and retry.
      await engine.retryFailed();
      expect(await outbox.count(), 0);
    });

    test('online stream auto-triggers syncNow', () async {
      await engine.start();
      await engine.queueMutation(
        entity: SyncEntity.payment,
        url: '/api/payments',
        method: 'POST',
      );
      // Before going online, transport hasn't been hit.
      // queueMutation in offline mode skips send.
      expect(transport.sent, hasLength(0));
      onlineCtrl.add(true);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(transport.sent.length, greaterThanOrEqualTo(1));
    });
  });
}
