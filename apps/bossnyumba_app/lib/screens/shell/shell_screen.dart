import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';

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
        _NavItem(icon: Icons.home_rounded, label: 'Home', path: '/owner'),
        _NavItem(icon: Icons.approval, label: 'Approvals', path: '/owner/approvals'),
        _NavItem(icon: Icons.search, label: 'Search', path: '/owner/search'),
        _NavItem(icon: Icons.auto_awesome, label: 'AI', path: '/owner/ai'),
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
    return Scaffold(
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
    // Prefer the longest matching prefix so '/owner/approvals' beats '/owner'.
    int best = 0;
    int bestLen = -1;
    for (var i = 0; i < items.length; i++) {
      final p = items[i].path;
      final isMatch = loc == p || (p != '/' && loc.startsWith(p));
      if (isMatch && p.length > bestLen) {
        best = i;
        bestLen = p.length;
      }
    }
    return best;
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  final String path;

  _NavItem({required this.icon, required this.label, required this.path});
}
