import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import 'owner_tenant_detail_screen.dart';

/// Unit detail: summary card, current tenant link, lease history and the most
/// recent 5 maintenance tickets + 5 payments. Intentionally dense so owners
/// can answer "what's the status of unit 4B?" on the fly.
class OwnerUnitDetailScreen extends StatefulWidget {
  final String unitId;
  final String? initialLabel;
  final ApiClient? apiClient;

  const OwnerUnitDetailScreen({
    super.key,
    required this.unitId,
    this.initialLabel,
    this.apiClient,
  });

  @override
  State<OwnerUnitDetailScreen> createState() => _OwnerUnitDetailScreenState();
}

class _OwnerUnitDetailScreenState extends State<OwnerUnitDetailScreen> {
  late final ApiClient _api;

  Map<String, dynamic>? _unit;
  List<dynamic> _leaseHistory = [];
  List<dynamic> _tickets = [];
  List<dynamic> _payments = [];
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
    final id = widget.unitId;
    final unitResp = await _api.get<Map<String, dynamic>>('/units/$id');
    final leasesResp =
        await _api.get<Map<String, dynamic>>('/units/$id/leases');
    final ticketsResp =
        await _api.get<Map<String, dynamic>>('/units/$id/tickets');
    final paymentsResp =
        await _api.get<Map<String, dynamic>>('/units/$id/payments');

    if (!mounted) return;

    setState(() {
      _unit = unitResp.isOk ? unitResp.data : null;
      _leaseHistory = _asList(leasesResp.data);
      _tickets = _asList(ticketsResp.data).take(5).toList();
      _payments = _asList(paymentsResp.data).take(5).toList();
      _loading = false;
      _error = unitResp.isOk ? null : unitResp.error;
    });
  }

  List<dynamic> _asList(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map && raw['items'] is List) return raw['items'] as List;
    return const [];
  }

  String _money(double v) => NumberFormat.currency(symbol: 'KSh ').format(v);

  String _shortDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      return DateFormat.yMMMd().format(DateTime.parse(iso));
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = _unit?['label']?.toString() ??
        _unit?['number']?.toString() ??
        widget.initialLabel ??
        'Unit';
    return Scaffold(
      appBar: AppBar(title: Text(label)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(onRefresh: _load, child: _buildBody(context, label)),
    );
  }

  Widget _buildBody(BuildContext context, String label) {
    final unit = _unit ?? const <String, dynamic>{};
    final property = unit['propertyName']?.toString() ??
        unit['property']?.toString() ??
        '—';
    final status = unit['status']?.toString() ?? 'unknown';
    final rent = (unit['monthlyRent'] as num?)?.toDouble() ?? 0;
    final size = unit['size']?.toString();
    final beds = unit['bedrooms'];
    final baths = unit['bathrooms'];
    final currentTenant = unit['currentTenant'] as Map<String, dynamic>?;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.titleLarge),
                Text(property, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    Chip(label: Text('Status: $status')),
                    Chip(label: Text('Rent: ${_money(rent)}')),
                    if (beds != null) Chip(label: Text('$beds bd')),
                    if (baths != null) Chip(label: Text('$baths ba')),
                    if (size != null && size.isNotEmpty)
                      Chip(label: Text(size)),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),
        Text('Current tenant',
            style: Theme.of(context).textTheme.titleMedium),
        if (currentTenant == null)
          const ListTile(
            leading: Icon(Icons.person_outline),
            title: Text('Vacant'),
          )
        else
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text(currentTenant['name']?.toString() ?? 'Tenant'),
              subtitle: Text(currentTenant['status']?.toString() ?? ''),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => OwnerTenantDetailScreen(
                      tenantId: currentTenant['id']?.toString() ?? '',
                      initialName: currentTenant['name']?.toString(),
                    ),
                  ),
                );
              },
            ),
          ),

        const SizedBox(height: 16),
        Text('Lease history',
            style: Theme.of(context).textTheme.titleMedium),
        if (_leaseHistory.isEmpty)
          const Text('No prior leases')
        else
          ..._leaseHistory.map((l) {
            final m = l as Map<String, dynamic>;
            return ListTile(
              leading: const Icon(Icons.receipt_long),
              title: Text(m['tenantName']?.toString() ?? 'Tenant'),
              subtitle: Text(
                '${_shortDate(m['startDate']?.toString())}  →  '
                '${_shortDate(m['endDate']?.toString())}',
              ),
            );
          }),

        const SizedBox(height: 16),
        Text('Recent tickets',
            style: Theme.of(context).textTheme.titleMedium),
        if (_tickets.isEmpty)
          const Text('None')
        else
          ..._tickets.map((t) {
            final m = t as Map<String, dynamic>;
            return ListTile(
              leading: const Icon(Icons.build_circle),
              title: Text(m['title']?.toString() ?? 'Ticket'),
              subtitle: Text(m['status']?.toString() ?? ''),
              trailing: Text(_shortDate(m['openedAt']?.toString())),
            );
          }),

        const SizedBox(height: 16),
        Text('Recent payments',
            style: Theme.of(context).textTheme.titleMedium),
        if (_payments.isEmpty)
          const Text('None')
        else
          ..._payments.map((p) {
            final m = p as Map<String, dynamic>;
            return ListTile(
              leading: const Icon(Icons.payments),
              title: Text(_money((m['amount'] as num?)?.toDouble() ?? 0)),
              subtitle: Text(_shortDate(m['date']?.toString())),
              trailing: Text(m['status']?.toString() ?? ''),
            );
          }),
        const SizedBox(height: 32),
      ],
    );
  }
}
