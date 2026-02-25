import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
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
      final resp = await ApiClient.instance.get<Map<String, dynamic>>('/bff/admin/dashboard');
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
      appBar: AppBar(title: const Text('Admin')),
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
                        Text('Welcome, ${session?.firstName ?? "Admin"}', style: theme.textTheme.titleLarge),
                        const SizedBox(height: 4),
                        Text(session?.role.name ?? 'Admin', style: theme.textTheme.bodyMedium),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Platform stats
                  if (_dashData != null) ...[
                    Row(children: [
                      Expanded(child: _StatCard(
                        label: 'Tenants',
                        value: '${_dashData!['platformMetrics']?['totalTenants'] ?? '—'}',
                        color: cs.primary,
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _StatCard(
                        label: 'Users',
                        value: '${_dashData!['platformMetrics']?['totalUsers'] ?? '—'}',
                        color: const Color(0xFF8B5CF6),
                      )),
                    ]),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _StatCard(
                        label: 'Properties',
                        value: '${_dashData!['platformMetrics']?['totalProperties'] ?? '—'}',
                        color: const Color(0xFF10B981),
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _StatCard(
                        label: 'Uptime',
                        value: '${_dashData!['systemHealth']?['uptime'] ?? 99.9}%',
                        color: const Color(0xFFF59E0B),
                      )),
                    ]),
                    const SizedBox(height: 24),
                  ],

                  _QuickAction(icon: Icons.business, label: 'Tenants', onTap: () {}),
                  _QuickAction(icon: Icons.people, label: 'Users & Roles', onTap: () {}),
                  _QuickAction(icon: Icons.support_agent, label: 'Support', onTap: () {}),
                  _QuickAction(icon: Icons.settings, label: 'Platform Settings', onTap: () {}),
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
