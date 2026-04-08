import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../widgets/org_switcher.dart';

class ShellScreen extends StatelessWidget {
  final Widget child;

  const ShellScreen({super.key, required this.child});

  List<_NavItem> _navItems(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isCustomer) {
      return [
        _NavItem(icon: Icons.home, label: 'Home', path: '/'),
        _NavItem(icon: Icons.credit_card, label: 'Pay', path: '/payments'),
        _NavItem(icon: Icons.build, label: 'Requests', path: '/maintenance'),
        _NavItem(icon: Icons.person, label: 'Profile', path: '/profile'),
      ];
    }
    if (auth.isEstateManager) {
      return [
        _NavItem(icon: Icons.dashboard, label: 'Dashboard', path: '/'),
        _NavItem(icon: Icons.assignment, label: 'Work Orders', path: '/work-orders'),
        _NavItem(icon: Icons.checklist, label: 'Inspections', path: '/inspections'),
        _NavItem(icon: Icons.person, label: 'Profile', path: '/profile'),
      ];
    }
    if (auth.isOwner) {
      return [
        _NavItem(icon: Icons.apartment, label: 'Portfolio', path: '/owner'),
        _NavItem(icon: Icons.person, label: 'Profile', path: '/profile'),
      ];
    }
    if (auth.isAdmin) {
      return [
        _NavItem(icon: Icons.admin_panel_settings, label: 'Admin', path: '/admin'),
        _NavItem(icon: Icons.person, label: 'Profile', path: '/profile'),
      ];
    }
    return [
      _NavItem(icon: Icons.home, label: 'Home', path: '/'),
      _NavItem(icon: Icons.person, label: 'Profile', path: '/profile'),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final navItems = _navItems(context);
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      // The drawer surfaces the full-width OrgSwitcher (non-compact) so users
      // can discover tenant switching from anywhere in the shell. Individual
      // screen AppBars may also mount the compact switcher as an action.
      drawer: Drawer(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Organization',
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              const OrgSwitcher(compact: false),
              const Divider(height: 32),
              if (auth.session != null) ...[
                Text(
                  auth.session!.displayName,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  auth.session!.email,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: const Text('Sign out'),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await auth.logout();
                  },
                ),
              ],
            ],
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: navItems.length > 1
          ? NavigationBar(
              selectedIndex: _selectedIndex(context, navItems),
              onDestinationSelected: (i) =>
                  context.go(navItems[i].path),
              destinations: navItems
                  .map((n) => NavigationDestination(
                        icon: Icon(n.icon),
                        label: n.label,
                      ))
                  .toList(),
            )
          : null,
    );
  }

  int _selectedIndex(BuildContext context, List<_NavItem> items) {
    final loc = GoRouterState.of(context).matchedLocation;
    for (var i = 0; i < items.length; i++) {
      if (loc == items[i].path || (items[i].path != '/' && loc.startsWith(items[i].path))) {
        return i;
      }
    }
    return 0;
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  final String path;

  _NavItem({required this.icon, required this.label, required this.path});
}
