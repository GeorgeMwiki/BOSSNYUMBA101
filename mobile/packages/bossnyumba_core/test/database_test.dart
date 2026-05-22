import 'package:bossnyumba_core/database/database.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('InMemoryBossnyumbaDatabase', () {
    test('schemaVersion is 1', () {
      final db = InMemoryBossnyumbaDatabase();
      expect(db.schemaVersion, 1);
    });

    test('clearAllCaches sets flag', () async {
      final db = InMemoryBossnyumbaDatabase();
      await db.clearAllCaches();
      expect(db.cachesCleared, isTrue);
    });

    test('resetDatabase wipes everything', () async {
      final db = InMemoryBossnyumbaDatabase();
      await db.resetDatabase();
      expect(db.databaseReset, isTrue);
      expect(db.cachesCleared, isTrue);
      expect(db.queueCleared, isTrue);
    });
  });
}
