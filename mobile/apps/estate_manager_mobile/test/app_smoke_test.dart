import 'package:estate_manager_mobile/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('EstateManagerApp renders the scaffold home', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: EstateManagerApp()));
    await tester.pump();
    expect(find.text('Estate Manager (scaffold)'), findsOneWidget);
    expect(find.byKey(const Key('estate-tile-inspection')), findsOneWidget);
    expect(find.byKey(const Key('estate-tile-tenant-signing')),
        findsOneWidget);
  });
}
