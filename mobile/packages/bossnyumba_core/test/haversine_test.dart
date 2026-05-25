import 'package:bossnyumba_core/geolocation/haversine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Haversine', () {
    test('returns 0 for identical points', () {
      final d = Haversine.distanceMeters(
        lat1: -6.7924,
        lng1: 39.2083,
        lat2: -6.7924,
        lng2: 39.2083,
      );
      expect(d, closeTo(0, 0.01));
    });

    test('Dar es Salaam to Dodoma is ~437 km', () {
      // -6.7924, 39.2083 -> -6.1731, 35.7419
      final d = Haversine.distanceKm(
        lat1: -6.7924,
        lng1: 39.2083,
        lat2: -6.1731,
        lng2: 35.7419,
      );
      expect(d, closeTo(437, 5));
    });

    test('symmetric', () {
      final a = Haversine.distanceMeters(
        lat1: 0,
        lng1: 0,
        lat2: 1,
        lng2: 1,
      );
      final b = Haversine.distanceMeters(
        lat1: 1,
        lng1: 1,
        lat2: 0,
        lng2: 0,
      );
      expect(a, closeTo(b, 0.001));
    });
  });
}
