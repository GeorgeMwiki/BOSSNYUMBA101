import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

/// Owner glance dashboard — the mobile companion home.
///
/// Designed for 30-second decisions during a commute:
///  * KPIs above the fold (2x2 grid) hitting `/analytics/summary`
///  * Today's agenda + recent alerts below the fold
///  * Pull-to-refresh re-fetches everything
///  * Refetches automatically when the active org (tenantId) changes
class OwnerHomeScreen extends StatefulWidget {
  const OwnerHomeScreen({super.key});

  @override
  State<OwnerHomeScreen> createState() => _OwnerHomeScreenState();
}

class _OwnerHomeScreenState extends State<OwnerHomeScreen> {
  Future<ApiResponse<Map<String, dynamic>>>? _summary;
  Future<ApiResponse<Map<String, dynamic>>>? _agenda;
  Future<ApiResponse<Map<String, dynamic>>>? _alerts;
  Future<ApiResponse<Map<String, dynamic>>>? _approvals;

  String? _lastTenantId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAll());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.read<AuthProvider>();
    final tenantId = auth.session?.tenantId;
    if (_lastTenantId != null && tenantId != _lastTenantId) {
      // Active org changed — refetch everything.
      _loadAll();
    }
    _lastTenantId = tenantId;
  }

  void _loadAll() {
    setState(() {
      _summary = ApiClient.instance.get<Map<String, dynamic>>('/analytics/summary');
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      _agenda = ApiClient.instance
          .get<Map<String, dynamic>>('/owner/agenda', queryParams: {'date': today});
      _alerts = ApiClient.instance.get<Map<String, dynamic>>(
        '/notifications',
        queryParams: {'limit': '5', 'unread': 'true'},
      );
      _approvals = ApiClient.instance.get<Map<String, dynamic>>(
        '/approvals',
        queryParams: {'status': 'pending', 'limit': '1'},
      );
    });
  }

  Future<void> _refresh() async {
    _loadAll();
    await Future.wait([
      _summary!,
      _agenda!,
      _alerts!,
      _approvals!,
    ]);
  }

  String _greeting(int hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final greetLine =
        '${_greeting(DateTime.now().hour)}, ${session?.firstName.isNotEmpty == true ? session!.firstName : 'Owner'}';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Boss Dashboard'),
        actions: const [
          _OrgSwitcherCompact(),
          SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                greetLine,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.85),
                    ),
              ),
            ),
            _KpiGrid(future: _summary, onRetry: _loadAll),
            const SizedBox(height: 20),
            _ApprovalsBadge(future: _approvals),
            const SizedBox(height: 20),
            _SectionHeader(title: "Today's agenda"),
            const SizedBox(height: 8),
            _AgendaSection(future: _agenda, onRetry: _loadAll),
            const SizedBox(height: 24),
            _SectionHeader(title: 'Recent alerts'),
            const SizedBox(height: 8),
            _AlertsSection(future: _alerts, onRetry: _loadAll),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// KPI grid
// ---------------------------------------------------------------------------

class _KpiGrid extends StatelessWidget {
  final Future<ApiResponse<Map<String, dynamic>>>? future;
  final VoidCallback onRetry;
  const _KpiGrid({required this.future, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ApiResponse<Map<String, dynamic>>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const _KpiSkeletonGrid();
        }
        if (!snap.hasData || !(snap.data?.isOk ?? false)) {
          return _ErrorCard(
            message: snap.data?.error ?? 'Unable to load KPIs',
            onRetry: onRetry,
          );
        }
        final data = snap.data!.data ?? const {};

        final collection = _asDouble(data['collectionRate']);
        final collectionDelta = _asDouble(data['collectionRateDelta']);
        final occupancy = _asDouble(data['occupancyRate']);
        final occupancyDelta = _asDouble(data['occupancyRateDelta']);
        final arrears = _asDouble(data['arrearsTotal']);
        final openTickets = _asInt(data['openTickets']);
        final criticalTickets = _asInt(data['criticalTickets']);

        return GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.35,
          children: [
            _KpiCard(
              key: const Key('kpi-collection'),
              label: 'Collection rate',
              value: collection != null ? '${collection.toStringAsFixed(0)}%' : '--',
              delta: collectionDelta,
              deltaSuffix: 'pp',
            ),
            _KpiCard(
              key: const Key('kpi-occupancy'),
              label: 'Occupancy',
              value: occupancy != null ? '${occupancy.toStringAsFixed(0)}%' : '--',
              delta: occupancyDelta,
              deltaSuffix: 'pp',
            ),
            _KpiCard(
              key: const Key('kpi-arrears'),
              label: 'Arrears',
              value: arrears != null ? _formatKes(arrears) : 'KES --',
              // Arrears going down is good — we don't surface a delta here to
              // keep the card scannable.
            ),
            _KpiCard(
              key: const Key('kpi-tickets'),
              label: 'Open tickets',
              value: openTickets != null ? '$openTickets' : '--',
              badgeCount: criticalTickets ?? 0,
            ),
          ],
        );
      },
    );
  }

  static double? _asDouble(Object? v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  static int? _asInt(Object? v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }

  static String _formatKes(double v) {
    final f = NumberFormat.decimalPattern('en_US');
    return 'KES ${f.format(v.round())}';
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final double? delta;
  final String deltaSuffix;
  final int badgeCount;

  const _KpiCard({
    super.key,
    required this.label,
    required this.value,
    this.delta,
    this.deltaSuffix = '',
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasDelta = delta != null;
    final isUp = hasDelta && delta! >= 0;
    final deltaColor = isUp ? Colors.greenAccent : theme.colorScheme.error;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.7),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (badgeCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.error,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$badgeCount',
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (hasDelta)
              Row(
                children: [
                  Icon(
                    isUp ? Icons.arrow_upward : Icons.arrow_downward,
                    size: 14,
                    color: deltaColor,
                  ),
                  const SizedBox(width: 2),
                  Text(
                    '${delta!.abs().toStringAsFixed(1)}$deltaSuffix',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: deltaColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'vs last month',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.55),
                    ),
                  ),
                ],
              )
            else
              const SizedBox(height: 14),
          ],
        ),
      ),
    );
  }
}

class _KpiSkeletonGrid extends StatelessWidget {
  const _KpiSkeletonGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.35,
      children: const [
        _KpiSkeleton(),
        _KpiSkeleton(),
        _KpiSkeleton(),
        _KpiSkeleton(),
      ],
    );
  }
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Card(
      key: const Key('kpi-skeleton'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              height: 10,
              width: 80,
              decoration: BoxDecoration(
                color: base.withOpacity(0.6),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            Container(
              height: 26,
              width: 100,
              decoration: BoxDecoration(
                color: base.withOpacity(0.9),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            Container(
              height: 10,
              width: 60,
              decoration: BoxDecoration(
                color: base.withOpacity(0.6),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Agenda & alerts sections
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
    );
  }
}

class _AgendaSection extends StatelessWidget {
  final Future<ApiResponse<Map<String, dynamic>>>? future;
  final VoidCallback onRetry;
  const _AgendaSection({required this.future, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ApiResponse<Map<String, dynamic>>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const _ListSkeleton(rows: 2);
        }
        if (!snap.hasData || !(snap.data?.isOk ?? false)) {
          return _ErrorCard(
            message: snap.data?.error ?? 'Unable to load agenda',
            onRetry: onRetry,
          );
        }
        final data = snap.data!.data ?? const {};
        final items = _extractList(data);
        if (items.isEmpty) {
          return Card(
            key: const Key('agenda-empty'),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              child: Row(
                children: [
                  Icon(Icons.event_available,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5)),
                  const SizedBox(width: 12),
                  const Text('No scheduled events today'),
                ],
              ),
            ),
          );
        }
        return Column(
          children: items.map((e) {
            final m = e as Map<String, dynamic>;
            final title = (m['title'] ?? m['name'] ?? 'Event').toString();
            final subtitle = (m['subtitle'] ?? m['time'] ?? m['type'] ?? '').toString();
            final type = (m['type'] ?? '').toString().toLowerCase();
            return Card(
              child: ListTile(
                minVerticalPadding: 12,
                leading: Icon(_iconForAgenda(type)),
                title: Text(title),
                subtitle: subtitle.isEmpty ? null : Text(subtitle),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  IconData _iconForAgenda(String type) {
    switch (type) {
      case 'lease_start':
      case 'lease_end':
      case 'lease':
        return Icons.description;
      case 'inspection':
        return Icons.checklist;
      case 'vendor':
      case 'vendor_visit':
        return Icons.build;
      default:
        return Icons.event;
    }
  }
}

class _AlertsSection extends StatelessWidget {
  final Future<ApiResponse<Map<String, dynamic>>>? future;
  final VoidCallback onRetry;
  const _AlertsSection({required this.future, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ApiResponse<Map<String, dynamic>>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const _ListSkeleton(rows: 3);
        }
        if (!snap.hasData || !(snap.data?.isOk ?? false)) {
          return _ErrorCard(
            message: snap.data?.error ?? 'Unable to load alerts',
            onRetry: onRetry,
          );
        }
        final data = snap.data!.data ?? const {};
        final items = _extractList(data);
        if (items.isEmpty) {
          return Card(
            key: const Key('alerts-empty'),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              child: Text('You are all caught up.'),
            ),
          );
        }
        return Column(
          children: items.map((e) {
            final m = e as Map<String, dynamic>;
            final id = (m['id'] ?? '').toString();
            final title = (m['title'] ?? 'Notification').toString();
            final body = (m['body'] ?? m['message'] ?? '').toString();
            return Card(
              child: InkWell(
                onTap: id.isEmpty
                    ? null
                    : () => context.go('/owner/notifications/$id'),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 56),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.notifications_active_outlined),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(title,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(fontWeight: FontWeight.w600)),
                              if (body.isNotEmpty)
                                Text(
                                  body,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class _ApprovalsBadge extends StatelessWidget {
  final Future<ApiResponse<Map<String, dynamic>>>? future;
  const _ApprovalsBadge({required this.future});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ApiResponse<Map<String, dynamic>>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done ||
            !snap.hasData ||
            !(snap.data?.isOk ?? false)) {
          return const SizedBox.shrink();
        }
        final data = snap.data!.data ?? const {};
        final count = _extractCount(data);
        if (count <= 0) return const SizedBox.shrink();
        return Card(
          key: const Key('approvals-badge'),
          color: Theme.of(context).colorScheme.primary.withOpacity(0.15),
          child: InkWell(
            onTap: () => context.go('/owner/approvals'),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.priority_high),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Action needed — $count pending approval${count == 1 ? '' : 's'}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    const Icon(Icons.chevron_right),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  int _extractCount(Map<String, dynamic> data) {
    final total = data['total'] ?? data['count'];
    if (total is num) return total.toInt();
    if (total is String) return int.tryParse(total) ?? 0;
    final items = _extractList(data);
    return items.length;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

List<dynamic> _extractList(Map<String, dynamic> data) {
  for (final k in const ['items', 'results', 'data']) {
    final v = data[k];
    if (v is List) return v;
  }
  return const [];
}

class _ListSkeleton extends StatelessWidget {
  final int rows;
  const _ListSkeleton({this.rows = 3});

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Column(
      children: List.generate(
        rows,
        (_) => Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: base.withOpacity(0.9),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 12,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: base.withOpacity(0.9),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 10,
                        width: 120,
                        decoration: BoxDecoration(
                          color: base.withOpacity(0.6),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorCard({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Card(
      key: const Key('error-card'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.error_outline,
                    color: Theme.of(context).colorScheme.error),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    message,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: SizedBox(
                height: 44,
                child: TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact placeholder for the cross-cutting org switcher until
/// `lib/widgets/org_switcher.dart` lands from the parallel agent.
///
/// Shows the current tenant name + a down-caret icon in the AppBar.
class _OrgSwitcherCompact extends StatelessWidget {
  const _OrgSwitcherCompact();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthProvider>().session;
    final name = session?.tenantName ?? 'Org';
    return InkWell(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Org switcher coming soon')),
        );
      },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
        padding: const EdgeInsets.symmetric(horizontal: 8),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                name,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelLarge,
              ),
            ),
            const Icon(Icons.arrow_drop_down, size: 20),
          ],
        ),
      ),
    );
  }
}
