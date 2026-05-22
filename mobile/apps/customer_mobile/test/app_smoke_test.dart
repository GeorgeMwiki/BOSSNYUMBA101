import 'package:customer_mobile/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('CustomerApp renders home and the pay-rent FAB', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: CustomerApp()));
    await tester.pump();
    expect(find.text('BOSSNYUMBA'), findsOneWidget);
    expect(find.byKey(const Key('customer-pay-rent-fab')), findsOneWidget);
  });
}
