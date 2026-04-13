import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import 'owner_unit_detail_screen.dart';

/// Owner view of a single property: occupancy %, monthly revenue, open-ticket
/// count, photo carousel, location pin placeholder and a tappable list of
/// units.
class OwnerPropertyDetailScreen extends StatefulWidget {
  final String propertyId;
  final String? initialName;
  final ApiClient? apiClient;

  const OwnerPropertyDetailScreen({
    super.key,
    required this.propertyId,
    this.initialName,
    this.apiClient,
  });

  @override
  State<OwnerPropertyDetailScreen> createState() =>
      _OwnerPropertyDetailScreenState();
}

class _OwnerPropertyDetailScreenState extends State<OwnerPropertyDetailScreen> {
  late final ApiClient _api;

  Map<String, dynamic>? _property;
  List<dynamic> _units = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = widget.apiClient ?? ApiClient.instance;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final propResp = await _api
        .get<Map<String, dynamic>>('/properties/${widget.propertyId}');
    final unitsResp = await _api
        .get<Map<String, dynamic>>('/properties/${widget.propertyId}/units');

    if (!mounted) return;

    setState(() {
      _property = propResp.isOk ? propResp.data : null;
      final raw = unitsResp.data;
      if (raw is List) {
        _units = raw;
      } else if (raw is Map && raw['items'] is List) {
        _units = raw['items'] as List;
      } else {
        _units = const [];
      }
      _loading = false;
      _error = propResp.isOk ? null : propResp.error;
    });
  }

  String _money(double v) => NumberFormat.currency(symbol: 'KSh ').format(v);

  @override
  Widget build(BuildContext context) {
    final name = _property?['name']?.toString() ?? widget.initialName ?? 'Property';
    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _buildContent(context, name),
                ),
    );
  }

  Widget _buildContent(BuildContext context, String name) {
    final prop = _property ?? const <String, dynamic>{};
    final unitCount = (prop['unitCount'] as num?)?.toInt() ??
        (_units.isNotEmpty ? _units.length : 0);
    final occupied = (prop['occupiedUnits'] as num?)?.toInt() ?? 0;
    final occupancyPct =
        unitCount == 0 ? 0.0 : (occupied / unitCount).clamp(0.0, 1.0);
    final revenue = (prop['monthlyRevenue'] as num?)?.toDouble() ?? 0;
    final openTickets = (prop['openTickets'] as num?)?.toInt() ?? 0;
    final photos = (prop['photos'] as List?)?.cast<dynamic>() ?? const [];
    final address = prop['address']?.toString() ?? '—';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _PhotoGallery(photos: photos),
        const SizedBox(height: 16),
        Text(name, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Row(
          children: [
            const Icon(Icons.location_pin, size: 18),
            const SizedBox(width: 4),
            Expanded(child: Text(address)),
          ],
        ),
        const SizedBox(height: 16),

        Row(
          children: [
            Expanded(
              child: _StatCard(
                icon: Icons.home_work,
                label: 'Occupancy',
                value: '${(occupancyPct * 100).toStringAsFixed(0)}%',
                sub: '$occupied / $unitCount',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatCard(
                icon: Icons.payments,
                label: 'Monthly revenue',
                value: _money(revenue),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatCard(
                icon: Icons.build_circle,
                label: 'Open tickets',
                value: openTickets.toString(),
                accent: openTickets > 0 ? Colors.orange : null,
              ),
            ),
          ],
        ),

        const SizedBox(height: 24),
        Text('Units ($unitCount)',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_units.isEmpty)
          const Text('No units added yet')
        else
          ..._units.map((u) {
            final m = u as Map<String, dynamic>;
            final label = (m['label'] ?? m['number'] ?? 'Unit').toString();
            final status = m['status']?.toString() ?? '';
            final tenant = m['currentTenant']?.toString();
            return Card(
              child: ListTile(
                leading: const Icon(Icons.meeting_room),
                title: Text(label),
                subtitle: Text(
                  tenant == null || tenant.isEmpty
                      ? 'Vacant • $status'
                      : '$tenant • $status',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => OwnerUnitDetailScreen(
                        unitId: m['id']?.toString() ?? '',
                        initialLabel: label,
                      ),
                    ),
                  );
                },
              ),
            );
          }),
        const SizedBox(height: 32),
      ],
    );
  }
}

class _PhotoGallery extends StatelessWidget {
  final List<dynamic> photos;
  const _PhotoGallery({required this.photos});

  @override
  Widget build(BuildContext context) {
    if (photos.isEmpty) {
      return Container(
        height: 160,
        decoration: BoxDecoration(
          color: Colors.grey.shade200,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(child: Icon(Icons.photo, size: 48)),
      );
    }
    return SizedBox(
      height: 160,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: photos.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final url = photos[i].toString();
          return ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              url,
              width: 240,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 240,
                color: Colors.grey.shade300,
                child: const Icon(Icons.broken_image),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final String? sub;
  final Color? accent;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    this.sub,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: accent),
            const SizedBox(height: 6),
            Text(label, style: Theme.of(context).textTheme.labelSmall),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: accent,
                  ),
              overflow: TextOverflow.ellipsis,
            ),
            if (sub != null)
              Text(sub!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
