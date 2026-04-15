import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  String _initial(String first, String last, String email) {
    final combined = (first + last).trim();
    if (combined.isNotEmpty) return combined.substring(0, 1).toUpperCase();
    if (email.isNotEmpty) return email.substring(0, 1).toUpperCase();
    return '?';
  }

  Future<void> _confirmSignOut(BuildContext context, AuthProvider auth) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will need to sign in again to access your account.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await auth.logout();
      if (context.mounted) context.go('/login');
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sign-out failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (session != null) ...[
            ListTile(
              leading: CircleAvatar(
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Text(
                  _initial(session.firstName, session.lastName, session.email),
                ),
              ),
              title: Text(
                session.displayName.isEmpty ? session.email : session.displayName,
              ),
              subtitle: Text(session.email),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('Role'),
              subtitle: Text(session.role.name),
            ),
            if (session.tenantName != null)
              ListTile(
                leading: const Icon(Icons.apartment_outlined),
                title: const Text('Tenant'),
                subtitle: Text(session.tenantName!),
              ),
            const Divider(),
          ],
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Sign out'),
            onTap: () => _confirmSignOut(context, auth),
          ),
        ],
      ),
    );
  }
}
