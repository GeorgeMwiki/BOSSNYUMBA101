import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

class ManagerHomeScreen extends StatefulWidget {
  const ManagerHomeScreen({super.key});

  @override
  State<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends State<ManagerHomeScreen> {
  Map<String, dynamic>? _dashData;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient.instance.get<Map<String, dynamic>>('/bff/estate-manager/dashboard');
      if (!mounted) return;
      if (resp.isOk && resp.data != null) {
        setState(() { _dashData = resp.data; _loading = false; });
      } else {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {})],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadDashboard,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Welcome, ${session?.firstName ?? "Manager"}', style: theme.textTheme.titleLarge),
                        const SizedBox(height: 4),
                        Text(session?.tenantName ?? session?.email ?? '', style: theme.textTheme.bodyMedium),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Stats
                  if (_dashData != null) ...[
                    Row(children: [
                      Expanded(child: _StatCard(
                        label: 'Work Orders',
                        value: '${_dashData!['workOrders']?['total'] ?? _dashData!['stats']?['workOrders'] ?? 0}',
                        color: cs.primary,
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _StatCard(
                        label: 'Occupancy',
                        value: '${_dashData!['stats']?['occupancy'] ?? _dashData!['occupancy']?['rate'] ?? '—'}%',
                        color: const Color(0xFF10B981),
                      )),
                    ]),
                    const SizedBox(height: 24),
                  ],

                  // Quick actions
                  _QuickAction(icon: Icons.assignment, label: 'Work Orders', onTap: () => context.go('/work-orders')),
                  _QuickAction(icon: Icons.checklist, label: 'Inspections', onTap: () => context.go('/inspections')),
                  _QuickAction(icon: Icons.people, label: 'Occupancy', onTap: () {}),
                  _QuickAction(icon: Icons.payments, label: 'Collections', onTap: () {}),
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
        Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 12, color: color)),
      ]),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.onTap});

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
