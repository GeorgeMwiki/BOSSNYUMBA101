import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';
import '../../core/org_provider.dart';
import '../../widgets/org_switcher.dart';

/// Admin home. Fetches the users list for the active org via the shared
/// [ApiClient] and surfaces a total count + the first few users as a preview.
class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  Future<ApiResponse<dynamic>>? _usersFuture;
  String? _lastOrgId;

  Future<ApiResponse<dynamic>> _loadUsers() {
    return ApiClient.instance.get<dynamic>('/users',
        queryParams: const {'limit': '100'});
  }

  Future<void> _refresh() async {
    final f = _loadUsers();
    setState(() {
      _usersFuture = f;
    });
    await f;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final activeOrgId = context.watch<OrgProvider>().activeOrgId;
    if (_usersFuture == null || activeOrgId != _lastOrgId) {
      _lastOrgId = activeOrgId;
      _usersFuture = _loadUsers();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin'),
        actions: const [
          OrgSwitcher(),
          SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<ApiResponse<dynamic>>(
          future: _usersFuture,
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
                          'Welcome, ${session?.firstName ?? "Admin"}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          session?.role.name ?? 'Admin',
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
                _buildUsersCard(snap),
                const SizedBox(height: 16),
                _QuickAction(
                  icon: Icons.business,
                  label: 'Tenants',
                  onTap: () {},
                ),
                _QuickAction(
                  icon: Icons.people,
                  label: 'Users & Roles',
                  onTap: () {},
                ),
                _QuickAction(
                  icon: Icons.support_agent,
                  label: 'Support',
                  onTap: () {},
                ),
                _QuickAction(
                  icon: Icons.settings,
                  label: 'Platform Settings',
                  onTap: () {},
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildUsersCard(AsyncSnapshot<ApiResponse<dynamic>> snap) {
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
                  resp?.error ?? 'Unable to load users',
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
                const Icon(Icons.people_outline),
                const SizedBox(width: 8),
                Text(
                  '${items.length} users',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            if (items.isNotEmpty) ...[
              const Divider(height: 24),
              for (final raw in items.take(5))
                if (raw is Map<String, dynamic>)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.account_circle_outlined, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${raw['firstName'] ?? ''} ${raw['lastName'] ?? raw['email'] ?? ''}'
                                .trim(),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (raw['role'] != null)
                          Text(
                            raw['role'].toString(),
                            style: TextStyle(
                                fontSize: 11, color: Colors.grey[500]),
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
