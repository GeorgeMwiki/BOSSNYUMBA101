import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/org_provider.dart';
import '../../core/cache/owner_cache.dart';

/// Property health status used for map pin coloring.
enum PropertyHealth {
  healthy, // green: occupancy > 80% AND collection > 90%
  attention, // amber: one metric dipping
  critical, // red: vacancy > 30% OR collection < 70%
}

/// A single property with geo + health data for the portfolio map.
class PortfolioProperty {
  final String id;
  final String name;
  final double? lat;
  final double? lng;
  final double occupancyRate;
  final double collectionRate;
  final int units;
  final double monthlyRevenue;
  final String? city;

  PortfolioProperty({
    required this.id,
    required this.name,
    this.lat,
    this.lng,
    required this.occupancyRate,
    required this.collectionRate,
    required this.units,
    required this.monthlyRevenue,
    this.city,
  });

  PropertyHealth get health {
    if (occupancyRate < 0.7 || collectionRate < 0.7) return PropertyHealth.critical;
    if (occupancyRate < 0.8 || collectionRate < 0.9) return PropertyHealth.attention;
    return PropertyHealth.healthy;
  }

  Color get pinColor {
    switch (health) {
      case PropertyHealth.healthy:
        return Colors.green;
      case PropertyHealth.attention:
        return Colors.amber;
      case PropertyHealth.critical:
        return Colors.red;
    }
  }

  factory PortfolioProperty.fromJson(Map<String, dynamic> json) {
    return PortfolioProperty(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown',
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      occupancyRate: (json['occupancyRate'] as num?)?.toDouble() ?? 0.0,
      collectionRate: (json['collectionRate'] as num?)?.toDouble() ?? 0.0,
      units: (json['units'] as num?)?.toInt() ?? 0,
      monthlyRevenue: (json['monthlyRevenue'] as num?)?.toDouble() ?? 0.0,
      city: json['city']?.toString(),
    );
  }
}

/// Portfolio map view — shows all properties as colored pins on a
/// scrollable list map-substitute (real map integration requires
/// flutter_map or google_maps_flutter which need pubspec additions).
///
/// For now this renders a list-based "map" view sorted by health,
/// color-coded, with a summary strip at the top. When a real map
/// package is added, swap the body with a MapWidget and use the
/// existing PortfolioProperty.lat/lng + pinColor.
class PortfolioMapScreen extends StatefulWidget {
  const PortfolioMapScreen({super.key});

  @override
  State<PortfolioMapScreen> createState() => _PortfolioMapScreenState();
}

class _PortfolioMapScreenState extends State<PortfolioMapScreen> {
  Future<List<PortfolioProperty>>? _future;
  String? _lastOrgId;
  PropertyHealth? _filter;

  Future<List<PortfolioProperty>> _fetch() async {
    final resp = await ApiClient.instance.get<dynamic>('/owner/portfolio');
    if (!resp.isOk || resp.data == null) return [];
    final list = resp.data is List ? resp.data as List : [];
    return list
        .map((e) => e is Map<String, dynamic> ? PortfolioProperty.fromJson(e) : null)
        .whereType<PortfolioProperty>()
        .toList()
      ..sort((a, b) => a.health.index.compareTo(b.health.index)); // critical first
  }

  @override
  Widget build(BuildContext context) {
    final orgId = context.watch<OrgProvider>().activeOrgId;
    if (_future == null || orgId != _lastOrgId) {
      _lastOrgId = orgId;
      _future = _fetch();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Portfolio Map'),
        actions: [
          PopupMenuButton<PropertyHealth?>(
            icon: const Icon(Icons.filter_list),
            onSelected: (v) => setState(() => _filter = v),
            itemBuilder: (_) => [
              const PopupMenuItem(value: null, child: Text('All')),
              const PopupMenuItem(value: PropertyHealth.critical, child: Text('Critical only')),
              const PopupMenuItem(value: PropertyHealth.attention, child: Text('Attention')),
              const PopupMenuItem(value: PropertyHealth.healthy, child: Text('Healthy')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          final f = _fetch();
          setState(() => _future = f);
          await f;
        },
        child: FutureBuilder<List<PortfolioProperty>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final properties = snap.data ?? [];
            final filtered = _filter == null
                ? properties
                : properties.where((p) => p.health == _filter).toList();

            if (filtered.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 100),
                  Center(child: Text('No properties found.')),
                ],
              );
            }

            // Summary strip
            final critical = properties.where((p) => p.health == PropertyHealth.critical).length;
            final attention = properties.where((p) => p.health == PropertyHealth.attention).length;
            final healthy = properties.where((p) => p.health == PropertyHealth.healthy).length;

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Summary row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _SummaryChip(color: Colors.red, label: '$critical critical'),
                    _SummaryChip(color: Colors.amber, label: '$attention attention'),
                    _SummaryChip(color: Colors.green, label: '$healthy healthy'),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'Tap a property for details. Map view coming with flutter_map.',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                ...filtered.map((p) => _PropertyMapCard(property: p)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final Color color;
  final String label;
  const _SummaryChip({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: CircleAvatar(backgroundColor: color, radius: 6),
      label: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}

class _PropertyMapCard extends StatelessWidget {
  final PortfolioProperty property;
  const _PropertyMapCard({required this.property});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: property.pinColor.withOpacity(0.15),
          child: Icon(Icons.apartment, color: property.pinColor),
        ),
        title: Text(property.name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          '${property.units} units · ${(property.occupancyRate * 100).toStringAsFixed(0)}% occ · '
          '${(property.collectionRate * 100).toStringAsFixed(0)}% coll'
          '${property.city != null ? " · ${property.city}" : ""}',
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Text(
          'KES ${(property.monthlyRevenue / 1000).toStringAsFixed(0)}k',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: property.pinColor,
          ),
        ),
        onTap: () {
          // Deep-link to property detail when the search agent's screen lands.
          // For now, show a snackbar.
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${property.name} detail coming soon')),
          );
        },
      ),
    );
  }
}
