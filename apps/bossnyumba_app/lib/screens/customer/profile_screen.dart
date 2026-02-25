import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profileData;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final resp = await ApiClient.instance.get<Map<String, dynamic>>('/bff/customer-app/profile');
      if (!mounted) return;
      if (resp.isOk && resp.data != null) {
        setState(() => _profileData = resp.data);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(child: Column(children: [
            CircleAvatar(
              radius: 40, backgroundColor: cs.primary,
              child: Text(
                session != null ? '${session.firstName[0]}${session.lastName[0]}' : '?',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white),
              ),
            ),
            const SizedBox(height: 12),
            Text(session?.displayName ?? 'User', style: theme.textTheme.titleLarge),
            Text(session?.email ?? '', style: theme.textTheme.bodyMedium),
            if (session?.phone != null && session!.phone!.isNotEmpty)
              Text(session.phone!, style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: cs.primary.withAlpha(25), borderRadius: BorderRadius.circular(12)),
              child: Text(session?.role.name.toUpperCase() ?? 'USER', style: TextStyle(color: cs.primary, fontWeight: FontWeight.w600, fontSize: 12)),
            ),
          ])),
          const SizedBox(height: 24),

          if (session?.contexts != null && session!.contexts!.length > 1) ...[
            Text('Your Roles', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...session.contexts!.map((ctx) {
              final isActive = session.activeContext?.id == ctx.id;
              return Card(
                color: isActive ? cs.primary.withAlpha(15) : null,
                child: ListTile(
                  leading: Icon(_roleIcon(ctx.contextType), color: isActive ? cs.primary : null),
                  title: Text(ctx.contextType.replaceAll('_', ' ')),
                  subtitle: Text(ctx.tenantName ?? ctx.propertyName ?? ''),
                  trailing: isActive
                      ? const Icon(Icons.check_circle, color: Color(0xFF10B981))
                      : TextButton(onPressed: () async { await auth.switchContext(ctx.id); if (mounted) context.go('/'); }, child: const Text('Switch')),
                ),
              );
            }),
            const SizedBox(height: 8),
            OutlinedButton.icon(onPressed: () => context.go('/switch-context'), icon: const Icon(Icons.swap_horiz), label: const Text('Manage roles')),
            const SizedBox(height: 24),
          ],

          if (_profileData != null) ...[
            Text('Details', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            if (_profileData!['lease'] != null)
              Card(child: ListTile(
                leading: const Icon(Icons.description), title: const Text('Active Lease'),
                subtitle: Text('Unit ${_profileData!['lease']?['unitId'] ?? ''} • ${_profileData!['lease']?['status'] ?? 'ACTIVE'}'),
                trailing: const Icon(Icons.chevron_right), onTap: () => context.go('/lease'),
              )),
            if (_profileData!['property'] != null)
              Card(child: ListTile(
                leading: const Icon(Icons.apartment), title: Text(_profileData!['property']?['name'] ?? 'Property'),
                subtitle: Text(_profileData!['property']?['address'] ?? ''),
              )),
            const SizedBox(height: 24),
          ],

          Text('Account', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Card(child: Column(children: [
            ListTile(leading: const Icon(Icons.settings_outlined), title: const Text('Settings'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
            const Divider(height: 1),
            ListTile(leading: const Icon(Icons.help_outline), title: const Text('Help & Support'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.logout, color: cs.error),
              title: Text('Sign out', style: TextStyle(color: cs.error)),
              onTap: () async { await auth.logout(); if (context.mounted) context.go('/login'); },
            ),
          ])),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  IconData _roleIcon(String type) {
    switch (type.toLowerCase()) {
      case 'owner': return Icons.apartment;
      case 'customer': return Icons.home;
      case 'estate_manager': return Icons.manage_accounts;
      case 'technician': return Icons.engineering;
      default: return Icons.person;
    }
  }
}
