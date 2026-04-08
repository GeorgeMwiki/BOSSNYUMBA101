import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';
import '../../core/org_provider.dart';
import '../../widgets/org_switcher.dart';

/// Manager dashboard. Fetches open tickets scoped to the active org via the
/// shared [ApiClient]. The `X-Active-Org` header is auto-attached by
/// [OrgProvider] so we don't have to pass an orgId query param explicitly.
class ManagerHomeScreen extends StatefulWidget {
  const ManagerHomeScreen({super.key});

  @override
  State<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends State<ManagerHomeScreen> {
  Future<ApiResponse<dynamic>>? _ticketsFuture;
  String? _lastOrgId;

  Future<ApiResponse<dynamic>> _loadTickets() {
    return ApiClient.instance.get<dynamic>(
      '/tickets',
      queryParams: const {'status': 'open', 'limit': '50'},
    );
  }

  Future<void> _refresh() async {
    final f = _loadTickets();
    setState(() {
      _ticketsFuture = f;
    });
    await f;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final activeOrgId = context.watch<OrgProvider>().activeOrgId;
    if (_ticketsFuture == null || activeOrgId != _lastOrgId) {
      _lastOrgId = activeOrgId;
      _ticketsFuture = _loadTickets();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: const [
          OrgSwitcher(),
          SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<ApiResponse<dynamic>>(
          future: _ticketsFuture,
          builder: (context, snap) {
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome, ${session?.firstName ?? "Manager"}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          session?.tenantName ?? session?.email ?? '',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _buildTicketsSummary(snap),
                const SizedBox(height: 16),
                _QuickAction(
                  icon: Icons.assignment,
                  label: 'Work Orders',
                  onTap: () => context.go('/work-orders'),
                ),
                _QuickAction(
                  icon: Icons.checklist,
                  label: 'Inspections',
                  onTap: () => context.go('/inspections'),
                ),
                _QuickAction(
                  icon: Icons.people,
                  label: 'Occupancy',
                  onTap: () {},
                ),
                _QuickAction(
                  icon: Icons.payments,
                  label: 'Collections',
                  onTap: () {},
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildTicketsSummary(AsyncSnapshot<ApiResponse<dynamic>> snap) {
    if (snap.connectionState == ConnectionState.waiting) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    final resp = snap.data;
    if (resp == null || !resp.isOk) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  resp?.error ?? 'Unable to load tickets',
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
              TextButton(
                onPressed: _refresh,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    final data = resp.data;
    final items = data is List
        ? data
        : (data is Map && data['items'] is List
            ? (data['items'] as List)
            : const []);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.assignment_outlined),
                const SizedBox(width: 8),
                Text(
                  'Open tickets: ${items.length}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            if (items.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final raw in items.take(3))
                if (raw is Map<String, dynamic>)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.circle, size: 8),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            raw['title']?.toString() ??
                                raw['subject']?.toString() ??
                                'Ticket #${raw['id'] ?? ''}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (raw['priority'] != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              raw['priority'].toString(),
                              style: const TextStyle(fontSize: 11),
                            ),
                          ),
                      ],
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
