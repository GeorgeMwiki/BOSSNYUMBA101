import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../widgets/org_switcher.dart';

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
        _NavItem(icon: Icons.apartment, label: 'Portfolio', path: '/owner'),
        _NavItem(icon: Icons.auto_awesome, label: 'AI', path: '/owner/ai'),
        _NavItem(icon: Icons.person, label: 'Profile', path: '/profile'),
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
    // Pick the longest-prefix match so `/owner/approvals` selects the
    // Approvals tab rather than the Home (`/owner`) tab.
    int bestIdx = 0;
    int bestLen = -1;
    for (var i = 0; i < items.length; i++) {
      final p = items[i].path;
      final matches = loc == p ||
          (p != '/' && (loc == p || loc.startsWith('$p/')));
      if (matches && p.length > bestLen) {
        bestIdx = i;
        bestLen = p.length;
      }
    }
    return bestIdx;
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  final String path;

  _NavItem({required this.icon, required this.label, required this.path});
}
