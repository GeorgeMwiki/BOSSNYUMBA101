// ---------------------------------------------------------------------------
// geolocation/haversine.dart
// ---------------------------------------------------------------------------
// Great-circle distance calculation between two GPS coordinates.
//
// What BELONGS in this file:
//   * Static `Haversine.distanceMeters` and `Haversine.distanceKm`
//     helpers — pure math, no dependencies, easy to unit test.
//
// What does NOT belong here:
//   * Anything that touches the GPS sensor — that goes in
//     `location_service.dart` (added later) with `package:geolocator`.
//
// BOSSNYUMBA use-cases:
//   * Inspector-on-site check-in: confirm the inspector is within
//     ~50m of the property they're meant to be inspecting.
//   * Tenant-facing "nearest unit" / "properties near me" search.
//   * Manager dashboard distance sort.
// ---------------------------------------------------------------------------

import 'dart:math';

/// Great-circle distance helpers.
class Haversine {
  Haversine._();

  static const double _earthRadiusMeters = 6371000;

  /// Distance between two coordinates in **metres**.
  static double distanceMeters({
    required double lat1,
    required double lng1,
    required double lat2,
    required double lng2,
  }) {
    final dLat = _toRadians(lat2 - lat1);
    final dLng = _toRadians(lng2 - lng1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLng / 2) *
            sin(dLng / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return _earthRadiusMeters * c;
  }

  /// Distance between two coordinates in **kilometres**.
  static double distanceKm({
    required double lat1,
    required double lng1,
    required double lat2,
    required double lng2,
  }) {
    return distanceMeters(
          lat1: lat1,
          lng1: lng1,
          lat2: lat2,
          lng2: lng2,
        ) /
        1000;
  }

  static double _toRadians(double degrees) => degrees * (pi / 180);
}
