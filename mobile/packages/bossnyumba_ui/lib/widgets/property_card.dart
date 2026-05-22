// ---------------------------------------------------------------------------
// widgets/property_card.dart
// ---------------------------------------------------------------------------
// `PropertyCard` — reusable card surfacing one property summary.
//
// What BELONGS in this file:
//   * The `PropertyCard` widget — header image, name, address, unit
//     count, occupancy chip, distance (when GPS is available).
//   * A simple `PropertyCardData` value object so consumers don't
//     need to wire the full domain model into a presentation widget.
//
// What does NOT belong here:
//   * Domain logic / repository calls — the host screen owns those.
//   * Navigation handlers — caller passes an `onTap` callback.
//
// Used by:
//   * `estate_manager_mobile` — inspection list, property picker.
//   * `customer_mobile` — tenant's "my building" overview, browse list.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

/// Lightweight DTO for the card.
class PropertyCardData {
  final String id;
  final String name;
  final String? addressLine;
  final int totalUnits;
  final int occupiedUnits;
  final double? distanceMeters;
  final String? heroImageUrl;

  const PropertyCardData({
    required this.id,
    required this.name,
    required this.totalUnits,
    required this.occupiedUnits,
    this.addressLine,
    this.distanceMeters,
    this.heroImageUrl,
  });
}

/// Compact property summary card.
///
/// Visual contract:
///   - 16dp internal padding
///   - 12dp corner radius
///   - hero image at top (cached_network_image)
///   - title + address rows
///   - occupancy chip + distance row
class PropertyCard extends StatelessWidget {
  final PropertyCardData data;
  final VoidCallback? onTap;

  const PropertyCard({
    super.key,
    required this.data,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    throw UnimplementedError(
      'PropertyCard.build() — implementation pending. '
      'Will render hero image + title + occupancy chip per BossnyumbaTheme.',
    );
  }
}
