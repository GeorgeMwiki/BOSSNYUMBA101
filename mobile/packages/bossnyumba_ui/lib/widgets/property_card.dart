// ---------------------------------------------------------------------------
// widgets/property_card.dart
// ---------------------------------------------------------------------------
// `PropertyCard` — reusable card surfacing one property summary.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

import '../theme.dart';

/// Lightweight DTO for the card.
class PropertyCardData {
  const PropertyCardData({
    required this.id,
    required this.name,
    required this.totalUnits,
    required this.occupiedUnits,
    this.addressLine,
    this.distanceMeters,
    this.heroImageUrl,
  });

  final String id;
  final String name;
  final String? addressLine;
  final int totalUnits;
  final int occupiedUnits;
  final double? distanceMeters;
  final String? heroImageUrl;
}

/// Compact property summary card.
class PropertyCard extends StatelessWidget {
  const PropertyCard({
    super.key,
    required this.data,
    this.onTap,
  });

  final PropertyCardData data;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final occupancy = data.totalUnits == 0
        ? 0
        : ((data.occupiedUnits / data.totalUnits) * 100).round();
    final distance = data.distanceMeters;
    final theme = Theme.of(context);
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              if (data.heroImageUrl != null)
                AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Container(
                    color: BossnyumbaColors.neutral100,
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.home_work_outlined,
                      color: BossnyumbaColors.neutral400,
                    ),
                  ),
                ),
              if (data.heroImageUrl != null) const SizedBox(height: 12),
              Text(
                data.name,
                style: theme.textTheme.titleLarge,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (data.addressLine != null) ...<Widget>[
                const SizedBox(height: 4),
                Text(
                  data.addressLine!,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: BossnyumbaColors.neutral600,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: <Widget>[
                  Chip(
                    label: Text('$occupancy% occupied'),
                    backgroundColor: BossnyumbaColors.neutral100,
                  ),
                  const SizedBox(width: 8),
                  if (distance != null)
                    Text(
                      distance < 1000
                          ? '${distance.toStringAsFixed(0)} m'
                          : '${(distance / 1000).toStringAsFixed(1)} km',
                      style: theme.textTheme.labelSmall,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
