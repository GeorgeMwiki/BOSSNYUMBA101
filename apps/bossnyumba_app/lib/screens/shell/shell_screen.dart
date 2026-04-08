import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../l10n/generated/app_localizations.dart';

class ShellScreen extends StatelessWidget {
  final Widget child;

  const ShellScreen({super.key, required this.child});

  List<_NavItem> _navItems(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final l10n = AppLocalizations.of(context);
    if (auth.isCustomer) {
      return [
        _NavItem(icon: Icons.home, label: l10n.navHome, path: '/'),
        _NavItem(icon: Icons.credit_card, label: l10n.navPay, path: '/payments'),
        _NavItem(icon: Icons.build, label: l10n.navRequests, path: '/maintenance'),
        _NavItem(icon: Icons.person, label: l10n.navProfile, path: '/profile'),
      ];
    }
    if (auth.isEstateManager) {
      return [
        _NavItem(icon: Icons.dashboard, label: l10n.navDashboard, path: '/'),
        _NavItem(icon: Icons.assignment, label: l10n.navWorkOrders, path: '/work-orders'),
        _NavItem(icon: Icons.checklist, label: l10n.navInspections, path: '/inspections'),
        _NavItem(icon: Icons.person, label: l10n.navProfile, path: '/profile'),
      ];
    }
    if (auth.isOwner) {
      return [
        _NavItem(icon: Icons.apartment, label: l10n.navPortfolio, path: '/owner'),
        _NavItem(icon: Icons.person, label: l10n.navProfile, path: '/profile'),
      ];
    }
    if (auth.isAdmin) {
      return [
        _NavItem(icon: Icons.admin_panel_settings, label: l10n.navAdmin, path: '/admin'),
        _NavItem(icon: Icons.person, label: l10n.navProfile, path: '/profile'),
      ];
    }
    return [
      _NavItem(icon: Icons.home, label: l10n.navHome, path: '/'),
      _NavItem(icon: Icons.person, label: l10n.navProfile, path: '/profile'),
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
