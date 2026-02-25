import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';

class ShellScreen extends StatelessWidget {
  final Widget child;

  const ShellScreen({super.key, required this.child});

  List<_NavItem> _navItems(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isTechnician) {
      return [
        _NavItem(icon: Icons.engineering, label: 'Jobs', path: '/'),
        _NavItem(icon: Icons.assignment, label: 'Work Orders', path: '/technician/jobs'),
        _NavItem(icon: Icons.person_rounded, label: 'Profile', path: '/profile'),
      ];
    }
    if (auth.isCustomer) {
      return [
        _NavItem(icon: Icons.home_rounded, label: 'Home', path: '/'),
        _NavItem(icon: Icons.credit_card, label: 'Pay', path: '/payments'),
        _NavItem(icon: Icons.build_rounded, label: 'Requests', path: '/maintenance'),
        _NavItem(icon: Icons.person_rounded, label: 'Profile', path: '/profile'),
      ];
    }
    if (auth.isEstateManager) {
      return [
        _NavItem(icon: Icons.dashboard_rounded, label: 'Dashboard', path: '/'),
        _NavItem(icon: Icons.assignment, label: 'Work Orders', path: '/work-orders'),
        _NavItem(icon: Icons.checklist, label: 'Inspections', path: '/inspections'),
        _NavItem(icon: Icons.person_rounded, label: 'Profile', path: '/profile'),
      ];
    }
    if (auth.isOwner) {
      return [
        _NavItem(icon: Icons.apartment_rounded, label: 'Portfolio', path: '/owner'),
        _NavItem(icon: Icons.person_rounded, label: 'Profile', path: '/profile'),
      ];
    }
    if (auth.isAdmin) {
      return [
        _NavItem(icon: Icons.admin_panel_settings, label: 'Admin', path: '/admin'),
        _NavItem(icon: Icons.person_rounded, label: 'Profile', path: '/profile'),
      ];
    }
    return [
      _NavItem(icon: Icons.home_rounded, label: 'Home', path: '/'),
      _NavItem(icon: Icons.person_rounded, label: 'Profile', path: '/profile'),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final navItems = _navItems(context);
    final auth = context.watch<AuthProvider>();
    final hasMultipleContexts = (auth.session?.contexts?.length ?? 0) > 1;

    return Scaffold(
      body: child,
      bottomNavigationBar: navItems.length > 1
          ? NavigationBar(
              selectedIndex: _selectedIndex(context, navItems),
              onDestinationSelected: (i) {
                if (hasMultipleContexts && i == navItems.length) {
                  context.go('/switch-context');
                  return;
                }
                context.go(navItems[i].path);
              },
              destinations: [
                ...navItems.map((n) => NavigationDestination(icon: Icon(n.icon), label: n.label)),
                if (hasMultipleContexts)
                  const NavigationDestination(icon: Icon(Icons.swap_horiz_rounded), label: 'Switch'),
              ],
            )
          : null,
    );
  }

  int _selectedIndex(BuildContext context, List<_NavItem> items) {
    final loc = GoRouterState.of(context).matchedLocation;
    if (loc == '/switch-context') return items.length;
    for (var i = 0; i < items.length; i++) {
      if (loc == items[i].path || (items[i].path != '/' && loc.startsWith(items[i].path))) return i;
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
