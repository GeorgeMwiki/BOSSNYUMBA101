import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  Map<String, dynamic>? _homeData;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadHome();
  }

  Future<void> _loadHome() async {
    setState(() { _loading = true; _error = null; });
    try {
      final resp = await ApiClient.instance.get<Map<String, dynamic>>('/bff/customer-app/home');
      if (!mounted) return;
      if (resp.isOk && resp.data != null) {
        setState(() { _homeData = resp.data; _loading = false; });
      } else {
        setState(() { _error = resp.error ?? 'Failed to load'; _loading = false; });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
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
        title: Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [cs.primary, cs.primary.withAlpha(180)]),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Center(child: Text('BN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white))),
          ),
          const SizedBox(width: 8),
          const Text('BOSSNYUMBA'),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {}),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadHome,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    children: [
                      // Greeting
                      Text(
                        'Welcome back, ${session?.firstName ?? "Resident"}',
                        style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _homeData?['property']?['name'] ?? 'Your property dashboard',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 20),

                      // Balance card
                      _BalanceCard(data: _homeData, onTap: () => context.go('/payments')),
                      const SizedBox(height: 16),

                      // Quick actions
                      Row(children: [
                        Expanded(child: _QuickAction(
                          icon: Icons.credit_card, label: 'Pay Rent',
                          color: cs.primary, onTap: () => context.go('/payments'),
                        )),
                        const SizedBox(width: 12),
                        Expanded(child: _QuickAction(
                          icon: Icons.build_rounded, label: 'Request',
                          color: cs.secondary, onTap: () => context.go('/maintenance'),
                        )),
                        const SizedBox(width: 12),
                        Expanded(child: _QuickAction(
                          icon: Icons.description, label: 'Lease',
                          color: const Color(0xFF8B5CF6), onTap: () => context.go('/lease'),
                        )),
                      ]),
                      const SizedBox(height: 24),

                      // Recent maintenance
                      _SectionHeader(title: 'Maintenance Requests', onSeeAll: () => context.go('/maintenance')),
                      const SizedBox(height: 8),
                      ..._buildMaintenanceCards(),

                      const SizedBox(height: 24),

                      // Recent notifications
                      _SectionHeader(title: 'Notifications', onSeeAll: () {}),
                      const SizedBox(height: 8),
                      ..._buildNotificationCards(),

                      const SizedBox(height: 24),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.cloud_off, size: 64, color: Colors.grey[600]),
        const SizedBox(height: 16),
        Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        const SizedBox(height: 16),
        FilledButton.icon(onPressed: _loadHome, icon: const Icon(Icons.refresh), label: const Text('Retry')),
      ],
    ));
  }

  List<Widget> _buildMaintenanceCards() {
    final requests = _homeData?['maintenance'] as List<dynamic>? ?? [];
    if (requests.isEmpty) {
      return [
        Card(child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Icon(Icons.check_circle, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            const Text('No open maintenance requests'),
          ]),
        )),
      ];
    }
    return requests.take(3).map((r) {
      final m = r as Map<String, dynamic>;
      return Card(child: ListTile(
        leading: _statusIcon(m['status'] ?? 'PENDING'),
        title: Text(m['title'] ?? m['description'] ?? 'Request'),
        subtitle: Text('${m['status'] ?? 'PENDING'} ${m['priority'] != null ? " • ${m['priority']}" : ""}'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.go('/maintenance'),
      ));
    }).toList();
  }

  List<Widget> _buildNotificationCards() {
    final notifs = _homeData?['notifications'] as List<dynamic>? ?? [];
    if (notifs.isEmpty) {
      return [
        Card(child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Icon(Icons.notifications_none, color: Colors.grey[600]),
            const SizedBox(width: 12),
            const Text('No new notifications'),
          ]),
        )),
      ];
    }
    return notifs.take(3).map((n) {
      final notif = n as Map<String, dynamic>;
      return Card(child: ListTile(
        leading: Icon(Icons.circle_notifications, color: Theme.of(context).colorScheme.primary),
        title: Text(notif['title'] ?? 'Notification'),
        subtitle: Text(notif['message'] ?? ''),
      ));
    }).toList();
  }

  Widget _statusIcon(String status) {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return const Icon(Icons.check_circle, color: Color(0xFF10B981));
      case 'IN_PROGRESS': return const Icon(Icons.autorenew, color: Color(0xFFF59E0B));
      case 'PENDING': return const Icon(Icons.schedule, color: Color(0xFF64748B));
      default: return const Icon(Icons.circle, color: Color(0xFF64748B));
    }
  }
}

class _BalanceCard extends StatelessWidget {
  final Map<String, dynamic>? data;
  final VoidCallback onTap;

  const _BalanceCard({this.data, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final balance = data?['balance'];
    final amount = balance?['totalDue'] ?? balance?['amount'] ?? 0;
    final currency = balance?['currency'] ?? 'KES';
    final nextDue = balance?['nextDueDate'] ?? '';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [cs.primary, cs.primary.withAlpha(200)],
            begin: Alignment.topLeft, end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Balance Due', style: TextStyle(color: Colors.white70, fontSize: 14)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: Colors.white.withAlpha(38), borderRadius: BorderRadius.circular(8)),
              child: const Text('Pay Now', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ]),
          const SizedBox(height: 8),
          Text(
            '$currency ${_formatAmount(amount)}',
            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
          ),
          if (nextDue.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('Next due: $nextDue', style: const TextStyle(color: Colors.white60, fontSize: 12)),
          ],
        ]),
      ),
    );
  }

  String _formatAmount(dynamic amount) {
    if (amount is num) {
      return amount.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );
    }
    return amount.toString();
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withAlpha(25),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withAlpha(51)),
        ),
        child: Column(children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onSeeAll;

  const _SectionHeader({required this.title, this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
      if (onSeeAll != null) TextButton(onPressed: onSeeAll, child: const Text('See all')),
    ]);
  }
}
