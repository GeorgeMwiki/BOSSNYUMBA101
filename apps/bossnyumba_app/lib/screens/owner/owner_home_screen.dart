import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

class OwnerHomeScreen extends StatefulWidget {
  const OwnerHomeScreen({super.key});

  @override
  State<OwnerHomeScreen> createState() => _OwnerHomeScreenState();
}

class _OwnerHomeScreenState extends State<OwnerHomeScreen> {
  Map<String, dynamic>? _dashData;
  List<dynamic> _properties = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      // Try BFF dashboard first
      final dashResp = await ApiClient.instance.get<Map<String, dynamic>>('/bff/owner-portal/dashboard');
      if (dashResp.isOk && dashResp.data != null) {
        _dashData = dashResp.data;
      }
      // Load properties
      final propResp = await ApiClient.instance.get<Map<String, dynamic>>('/bff/owner-portal/properties');
      if (propResp.isOk && propResp.data != null) {
        final data = propResp.data!;
        _properties = data['items'] ?? data['properties'] ?? (data is List ? data : []);
      } else {
        // Fallback to direct API
        final fallback = await ApiClient.instance.get<Map<String, dynamic>>('/properties');
        if (fallback.isOk && fallback.data != null) {
          final data = fallback.data!;
          _properties = data['items'] ?? (data is List ? data : []);
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Portfolio')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Welcome card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Welcome, ${session?.firstName ?? "Owner"}', style: theme.textTheme.titleLarge),
                        if (_properties.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text('${_properties.length} propert${_properties.length == 1 ? 'y' : 'ies'}', style: theme.textTheme.titleMedium),
                        ],
                      ]),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Dashboard stats
                  if (_dashData != null) ...[
                    Row(children: [
                      Expanded(child: _StatCard(
                        label: 'Revenue',
                        value: _dashData!['revenue']?['total']?.toString() ?? '—',
                        color: cs.primary,
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _StatCard(
                        label: 'Occupancy',
                        value: '${_dashData!['occupancy']?['rate'] ?? _dashData!['stats']?['occupancy'] ?? '—'}%',
                        color: const Color(0xFF10B981),
                      )),
                    ]),
                    const SizedBox(height: 16),
                  ],

                  // Properties list
                  if (_properties.isEmpty)
                    Center(child: Column(children: [
                      const SizedBox(height: 40),
                      Icon(Icons.apartment, size: 64, color: Colors.grey[600]),
                      const SizedBox(height: 16),
                      const Text('No properties yet'),
                    ]))
                  else
                    ..._properties.map((p) {
                      final m = p as Map<String, dynamic>;
                      return Card(
                        child: ListTile(
                          leading: Container(
                            width: 48, height: 48,
                            decoration: BoxDecoration(
                              color: cs.primary.withAlpha(25),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.apartment, color: cs.primary),
                          ),
                          title: Text(m['name'] ?? 'Property'),
                          subtitle: Text('${m['units'] ?? m['totalUnits'] ?? 0} units${m['city'] != null ? " • ${m['city']}" : ""}'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () {},
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withAlpha(20), borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(51)),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 12, color: color)),
      ]),
    );
  }
}
