import 'package:bossnyumba_ui/bossnyumba_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('BossnyumbaTheme', () {
    test('light() returns a ThemeData with primary brand colour', () {
      final theme = BossnyumbaTheme.light();
      expect(theme.colorScheme.primary, BossnyumbaColors.primary);
      expect(theme.brightness, Brightness.light);
    });

    test('dark() returns a dark ThemeData', () {
      final theme = BossnyumbaTheme.dark();
      expect(theme.brightness, Brightness.dark);
    });
  });

  group('PaymentButton', () {
    testWidgets('renders M-Pesa label + amount', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: BossnyumbaTheme.light(),
        home: const Scaffold(
          body: PaymentButton(
            method: PaymentMethod.mpesa,
            amount: 250000,
            currency: 'TZS',
          ),
        ),
      ));
      expect(find.text('Pay with M-Pesa'), findsOneWidget);
      expect(find.text('250000 TZS'), findsOneWidget);
    });

    testWidgets('isLoading shows a spinner', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: const Scaffold(
          body: PaymentButton(
            method: PaymentMethod.mpesa,
            amount: 1,
            currency: 'TZS',
            isLoading: true,
          ),
        ),
      ));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('PropertyCard', () {
    testWidgets('renders name + occupancy chip', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: BossnyumbaTheme.light(),
        home: const Scaffold(
          body: PropertyCard(
            data: PropertyCardData(
              id: 'p1',
              name: 'Mikocheni Estate',
              totalUnits: 100,
              occupiedUnits: 80,
              addressLine: 'Mikocheni, Dar es Salaam',
              distanceMeters: 1500,
            ),
          ),
        ),
      ));
      expect(find.text('Mikocheni Estate'), findsOneWidget);
      expect(find.text('80% occupied'), findsOneWidget);
      expect(find.text('1.5 km'), findsOneWidget);
    });
  });
}
