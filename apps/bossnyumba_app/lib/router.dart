import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'core/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/shell/shell_screen.dart';
import 'screens/customer/customer_home_screen.dart';
import 'screens/customer/payments_screen.dart';
import 'screens/customer/maintenance_screen.dart';
import 'screens/customer/lease_screen.dart';
import 'screens/customer/profile_screen.dart';
import 'screens/manager/manager_home_screen.dart';
import 'screens/manager/work_orders_screen.dart';
import 'screens/manager/inspections_screen.dart';
import 'screens/owner/owner_home_screen.dart';
import 'screens/admin/admin_home_screen.dart';
import 'screens/technician/technician_home_screen.dart';

GoRouter createGoRouter(AuthProvider auth) {
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: auth,
    redirect: (context, state) {
      if (auth.loading) return null;
      final atLogin = state.matchedLocation == '/login' || state.matchedLocation == '/register';
      if (!auth.isAuthenticated && !atLogin) return '/login';
      if (auth.isAuthenticated && atLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      ShellRoute(
        builder: (context, state, child) => ShellScreen(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const RoleAwareHomeScreen()),
          // Customer routes
          GoRoute(path: '/payments', builder: (_, __) => const PaymentsScreen()),
          GoRoute(path: '/maintenance', builder: (_, __) => const MaintenanceScreen()),
          GoRoute(path: '/lease', builder: (_, __) => const LeaseScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          // Manager routes
          GoRoute(path: '/work-orders', builder: (_, __) => const WorkOrdersScreen()),
          GoRoute(path: '/inspections', builder: (_, __) => const InspectionsScreen()),
          // Owner routes
          GoRoute(path: '/owner', builder: (_, __) => const OwnerHomeScreen()),
          // Admin routes
          GoRoute(path: '/admin', builder: (_, __) => const AdminHomeScreen()),
          // Technician routes
          GoRoute(path: '/technician', builder: (_, __) => const TechnicianHomeScreen()),
          GoRoute(path: '/technician/jobs', builder: (_, __) => const WorkOrdersScreen()),
          // Context switching
          GoRoute(path: '/switch-context', builder: (_, __) => const ContextSwitchScreen()),
        ],
      ),
    ],
  );
}

class RoleAwareHomeScreen extends StatelessWidget {
  const RoleAwareHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isTechnician) return const TechnicianHomeScreen();
    if (auth.isCustomer) return const CustomerHomeScreen();
    if (auth.isEstateManager) return const ManagerHomeScreen();
    if (auth.isOwner || auth.isAccountant) return const OwnerHomeScreen();
    if (auth.isAdmin) return const AdminHomeScreen();
    return const CustomerHomeScreen();
  }
}

class ContextSwitchScreen extends StatelessWidget {
  const ContextSwitchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Switch Context')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Your roles & contexts', style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text('You can be both an owner and tenant', style: theme.textTheme.bodySmall),
          const SizedBox(height: 16),
          if (session?.contexts != null && session!.contexts!.isNotEmpty)
            ...session.contexts!.map((ctx) {
              final isActive = session.activeContext?.id == ctx.id;
              return Card(
                color: isActive ? cs.primary.withAlpha(25) : null,
                child: ListTile(
                  leading: Icon(
                    _iconForContext(ctx.contextType),
                    color: isActive ? cs.primary : null,
                  ),
                  title: Text(ctx.contextType.toUpperCase()),
                  subtitle: Text(ctx.tenantName ?? ctx.propertyName ?? ''),
                  trailing: isActive
                      ? Chip(label: const Text('Active'), backgroundColor: cs.primary.withAlpha(38))
                      : TextButton(
                          onPressed: () => auth.switchContext(ctx.id),
                          child: const Text('Switch'),
                        ),
                ),
              );
            }),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _showCreateContext(context),
            icon: const Icon(Icons.add),
            label: const Text('Add new role'),
          ),
        ],
      ),
    );
  }

  IconData _iconForContext(String type) {
    switch (type.toLowerCase()) {
      case 'owner': return Icons.apartment;
      case 'customer': return Icons.home;
      case 'estate_manager': return Icons.manage_accounts;
      case 'technician': return Icons.engineering;
      case 'admin': return Icons.admin_panel_settings;
      default: return Icons.person;
    }
  }

  void _showCreateContext(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Add a role', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.apartment),
              title: const Text('Property Owner'),
              subtitle: const Text('List and manage your properties'),
              onTap: () {
                context.read<AuthProvider>().createContext('OWNER');
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.home),
              title: const Text('Tenant'),
              subtitle: const Text('Rent and manage your home'),
              onTap: () {
                context.read<AuthProvider>().createContext('CUSTOMER');
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
}
