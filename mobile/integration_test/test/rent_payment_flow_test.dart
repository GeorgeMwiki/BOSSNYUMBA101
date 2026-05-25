// ---------------------------------------------------------------------------
// integration_test/rent_payment_flow_test.dart
// ---------------------------------------------------------------------------
// Rent payment flow: queue a payment mutation, verify it carries an
// idempotency-key and drains successfully when the device is online.
// ---------------------------------------------------------------------------

import 'dart:async';

import 'package:bossnyumba_core/sync_engine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('rent payment queues with idempotency key and drains',
      (tester) async {
    final outbox = InMemoryOutboxStore();
    final transport = FakeSyncTransport();
    final online = StreamController<bool>.broadcast();
    final engine = DefaultSyncEngine(
      outbox: outbox,
      transport: transport,
      onlineStream: online.stream,
      idGenerator: () => 'mpesa-stk-uuid',
    );
    await engine.start();

    await engine.queueMutation(
      entity: SyncEntity.payment,
      url: '/api/payments/mpesa/stk-push',
      method: 'POST',
      body: '{"leaseId":"L-1","amount":250000,"phone":"+255700000001"}',
    );

    // Mutation should be persisted with an idempotency-key header.
    final pending = await outbox.listAll();
    expect(pending, hasLength(1));
    expect(pending.first.headers!['idempotency-key'], 'mpesa-stk-uuid');

    // Simulate device coming online.
    online.add(true);
    await Future<void>.delayed(const Duration(milliseconds: 20));

    // Verify the STK push request was sent with idempotency-key.
    expect(transport.sent, hasLength(1));
    expect(transport.sent.first.url, '/api/payments/mpesa/stk-push');
    expect(transport.sent.first.headers!['idempotency-key'], 'mpesa-stk-uuid');
    expect(await outbox.count(), 0);

    engine.dispose();
    await online.close();
  });
}
