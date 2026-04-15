import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

/// Owner home screen showing four headline KPI cards:
///   * Collection rate
///   * Occupancy
///   * Arrears total
///   * Open tickets
///
/// Each card shows a current value, a period-over-period delta, uses a
/// skeleton while loading, and shows an error state with a retry button.
///
/// Pull-to-refresh triggers a re-fetch. The screen also watches [AuthProvider]
/// so switching the active organisation (tenantId) re-fetches automatically.
class OwnerHomeScreen extends StatefulWidget {
  const OwnerHomeScreen({super.key});

  @override
  State<OwnerHomeScreen> createState() => _OwnerHomeScreenState();
}

class _KpiSnapshot {
  final double collectionRate;
  final double? collectionRateDelta;
  final double occupancy;
  final double? occupancyDelta;
  final num arrears;
  final num? arrearsDelta;
  final int openTickets;
  final int? openTicketsDelta;

  _KpiSnapshot({
    required this.collectionRate,
    required this.collectionRateDelta,
    required this.occupancy,
    required this.occupancyDelta,
    required this.arrears,
    required this.arrearsDelta,
    required this.openTickets,
    required this.openTicketsDelta,
  });

  factory _KpiSnapshot.fromSummary(
    Map<String, dynamic> summary,
    Map<String, dynamic> maintenance,
  ) {
    Map<String, dynamic> kpi(String key) {
      final raw = summary[key];
      if (raw is Map<String, dynamic>) return raw;
      if (raw is Map) return Map<String, dynamic>.from(raw);
      return <String, dynamic>{};
    }

    final collection = kpi('collectionRate');
    final occupancy = kpi('occupancy');
    final arrears = kpi('arrears');

    return _KpiSnapshot(
      collectionRate: (collection['value'] as num?)?.toDouble() ?? 0,
      collectionRateDelta: (collection['delta'] as num?)?.toDouble(),
      occupancy: (occupancy['value'] as num?)?.toDouble() ?? 0,
      occupancyDelta: (occupancy['delta'] as num?)?.toDouble(),
      arrears: (arrears['value'] as num?) ?? 0,
      arrearsDelta: arrears['delta'] as num?,
      openTickets: (maintenance['open'] as num?)?.toInt() ?? 0,
      openTicketsDelta: maintenance['delta'] is num
          ? (maintenance['delta'] as num).toInt()
          : null,
    );
  }
}

class _OwnerHomeScreenState extends State<OwnerHomeScreen> {
  _KpiSnapshot? _snapshot;
  String? _error;
  bool _loading = true;
  String? _lastTenantId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final tenantId = context.read<AuthProvider>().session?.tenantId;
    if (_lastTenantId != null && _lastTenantId != tenantId) {
      // Active organisation switched — refresh.
      _load();
    }
    _lastTenantId = tenantId;
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    final api = ApiClient.instance;
    try {
      final results = await Future.wait([
        api.get<Map<String, dynamic>>('/analytics/summary'),
        api.get<Map<String, dynamic>>('/analytics/maintenance'),
        // occupancy + arrears are available for deep-drill screens; we don't
        // need their payload for the 4 headline cards but we warm the cache.
        api.get<dynamic>('/analytics/occupancy'),
        api.get<Map<String, dynamic>>('/analytics/arrears'),
      ]);
      final summary = results[0];
      final maintenance = results[1];

      if (!summary.isOk) {
        throw Exception(summary.error ?? 'Failed to load KPI summary');
      }
      if (!maintenance.isOk) {
        throw Exception(maintenance.error ?? 'Failed to load maintenance KPIs');
      }

      final summaryData = (summary.data ?? <String, dynamic>{}) as Map<String, dynamic>;
      final maintenanceData =
          (maintenance.data ?? <String, dynamic>{}) as Map<String, dynamic>;

      if (!mounted) return;
      setState(() {
        _snapshot = _KpiSnapshot.fromSummary(summaryData, maintenanceData);
        _loading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _snapshot = null;
        _error = err.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;

    // Active-org change detection (in case provider rebuilds before
    // didChangeDependencies fires).
    if (_lastTenantId != null && _lastTenantId != session?.tenantId && !_loading) {
      _lastTenantId = session?.tenantId;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Portfolio')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome, ${session?.firstName ?? "Owner"}',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    if (session?.tenantName != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        session!.tenantName!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _buildKpiGrid(context),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiGrid(BuildContext context) {
    if (_loading) {
      return _KpiGrid(
        children: List.generate(4, (_) => const _KpiSkeleton()),
      );
    }
    if (_error != null) {
      return _KpiErrorCard(message: _error!, onRetry: _load);
    }
    final snap = _snapshot;
    if (snap == null) {
      return _KpiErrorCard(
        message: 'No KPI data available for this organisation yet.',
        onRetry: _load,
      );
    }
    return _KpiGrid(
      children: [
        _KpiCard(
          label: 'Collection Rate',
          icon: Icons.bar_chart,
          iconColor: Colors.teal,
          value: '${snap.collectionRate.toStringAsFixed(1)}%',
          deltaLabel: _formatDelta(snap.collectionRateDelta, unit: _DeltaUnit.percent),
          deltaPositive: (snap.collectionRateDelta ?? 0) >= 0,
        ),
        _KpiCard(
          label: 'Occupancy',
          icon: Icons.home,
          iconColor: Colors.blue,
          value: '${snap.occupancy.toStringAsFixed(1)}%',
          deltaLabel: _formatDelta(snap.occupancyDelta, unit: _DeltaUnit.percent),
          deltaPositive: (snap.occupancyDelta ?? 0) >= 0,
        ),
        _KpiCard(
          label: 'Arrears Total',
          icon: Icons.attach_money,
          iconColor: Colors.orange,
          value: _formatCurrency(snap.arrears),
          deltaLabel: _formatDelta(snap.arrearsDelta, unit: _DeltaUnit.currency),
          // Falling arrears is good (positive), rising arrears is bad.
          deltaPositive: (snap.arrearsDelta ?? 0) <= 0,
        ),
        _KpiCard(
          label: 'Open Tickets',
          icon: Icons.build,
          iconColor: Colors.purple,
          value: '${snap.openTickets}',
          deltaLabel: _formatDelta(snap.openTicketsDelta, unit: _DeltaUnit.count),
          // Fewer tickets is good.
          deltaPositive: (snap.openTicketsDelta ?? 0) <= 0,
        ),
      ],
    );
  }
}

enum _DeltaUnit { percent, currency, count }

String _formatCurrency(num amount) {
  final value = amount.round();
  final formatted = value.toString().replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
        (match) => '${match[1]},',
      );
  return 'KES $formatted';
}

String _formatDelta(num? delta, {required _DeltaUnit unit}) {
  if (delta == null) return 'no prior period';
  final sign = delta >= 0 ? '+' : '';
  switch (unit) {
    case _DeltaUnit.percent:
      return '$sign${delta.toStringAsFixed(1)}pts vs last month';
    case _DeltaUnit.currency:
      final prefix = delta >= 0 ? '+' : '-';
      return '$prefix${_formatCurrency(delta.abs())} vs last month';
    case _DeltaUnit.count:
      return '$sign${delta.toInt()} vs last month';
  }
}

class _KpiGrid extends StatelessWidget {
  final List<Widget> children;
  const _KpiGrid({required this.children});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 640 ? 4 : 2;
        return GridView.count(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.4,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: children,
        );
      },
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color iconColor;
  final String value;
  final String deltaLabel;
  final bool deltaPositive;

  const _KpiCard({
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.deltaLabel,
    required this.deltaPositive,
  });

  @override
  Widget build(BuildContext context) {
    final deltaColor = deltaPositive ? Colors.green[700] : Colors.red[700];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: iconColor),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.labelMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            Text(
              value,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            Text(
              deltaLabel,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: deltaColor),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _bar(width: 80, height: 10),
            _bar(width: 120, height: 18),
            _bar(width: 140, height: 10),
          ],
        ),
      ),
    );
  }

  Widget _bar({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.grey[300],
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

class _KpiErrorCard extends StatelessWidget {
  final String message;
  final Future<void> Function() onRetry;

  const _KpiErrorCard({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.red[50],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.error_outline, color: Colors.red[700]),
                const SizedBox(width: 8),
                Text(
                  'Unable to load KPIs',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(color: Colors.red[800]),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(message, style: TextStyle(color: Colors.red[700])),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: () => onRetry(),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
