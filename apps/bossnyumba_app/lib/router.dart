import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/onboarding/region_picker_screen.dart';
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
import 'screens/owner/owner_ai_screen.dart';
import 'screens/owner/owner_approvals_screen.dart';
import 'screens/owner/approval_detail_screen.dart';
import 'screens/owner/owner_search_screen.dart';
import 'screens/owner/owner_tenant_detail_screen.dart';
import 'screens/owner/owner_property_detail_screen.dart';
import 'screens/owner/owner_unit_detail_screen.dart';
import 'screens/owner/notifications_inbox_screen.dart';
import 'screens/owner/notification_detail_screen.dart';
import 'screens/owner/portfolio_map_screen.dart';
import 'screens/owner/quick_report_screen.dart';
import 'screens/owner/document_viewer_screen.dart';
import 'screens/owner/morning_briefing_screen.dart';
import 'screens/owner/tenant_messages_screen.dart';
import 'screens/admin/admin_home_screen.dart';

/// Refresh-notifier that rebuilds the router when the onboarded flag flips
/// (e.g. after the user completes the region picker).
class OnboardingListenable extends ChangeNotifier {
  bool _onboarded = false;
  bool get onboarded => _onboarded;

  OnboardingListenable() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _onboarded = prefs.getBool(RegionPickerScreen.onboardedFlagKey) ?? false;
    notifyListeners();
  }

  Future<void> refresh() => _load();
}

final onboardingListenable = OnboardingListenable();

GoRouter createGoRouter(AuthProvider auth) {
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: Listenable.merge([auth, onboardingListenable]),
    redirect: (context, state) {
      final loc = state.matchedLocation;

      // Gate: first-launch region picker comes before anything else.
      if (!onboardingListenable.onboarded) {
        if (loc == '/region-picker') return null;
        return '/region-picker';
      }

      // Once onboarded, block access to the picker.
      if (loc == '/region-picker') return '/login';

      if (auth.loading) return null;
      final atLogin = loc == '/login' || loc == '/register';
      if (!auth.isAuthenticated && !atLogin) return '/login';
      if (auth.isAuthenticated && atLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/region-picker',
        builder: (_, __) => const RegionPickerScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (_, __) => const RegisterScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => ShellScreen(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (_, __) => const RoleAwareHomeScreen(),
          ),
          GoRoute(
            path: '/payments',
            builder: (_, __) => const PaymentsScreen(),
          ),
          GoRoute(
            path: '/maintenance',
            builder: (_, __) => const MaintenanceScreen(),
          ),
          GoRoute(
            path: '/lease',
            builder: (_, __) => const LeaseScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (_, __) => const ProfileScreen(),
          ),
          GoRoute(
            path: '/work-orders',
            builder: (_, __) => const WorkOrdersScreen(),
          ),
          GoRoute(
            path: '/inspections',
            builder: (_, __) => const InspectionsScreen(),
          ),
          // Owner surface -------------------------------------------------
          GoRoute(
            path: '/owner',
            builder: (_, __) => const OwnerHomeScreen(),
          ),
          GoRoute(
            path: '/owner/ai',
            builder: (_, __) => const OwnerAiScreen(),
          ),
          GoRoute(
            path: '/owner/approvals',
            builder: (_, __) => const OwnerApprovalsScreen(),
          ),
          GoRoute(
            path: '/owner/approvals/:id',
            builder: (_, state) => ApprovalDetailScreen(
              approvalId: state.pathParameters['id'] ?? '',
            ),
          ),
          GoRoute(
            path: '/owner/search',
            builder: (_, __) => const OwnerSearchScreen(),
          ),
          GoRoute(
            path: '/owner/tenants/:id',
            builder: (_, state) => OwnerTenantDetailScreen(
              tenantId: state.pathParameters['id'] ?? '',
            ),
          ),
          GoRoute(
            path: '/owner/properties/:id',
            builder: (_, state) => OwnerPropertyDetailScreen(
              propertyId: state.pathParameters['id'] ?? '',
            ),
          ),
          GoRoute(
            path: '/owner/units/:id',
            builder: (_, state) => OwnerUnitDetailScreen(
              unitId: state.pathParameters['id'] ?? '',
            ),
          ),
          GoRoute(
            path: '/owner/notifications',
            builder: (_, __) => const NotificationsInboxScreen(),
          ),
          GoRoute(
            path: '/owner/notifications/:id',
            builder: (_, state) => NotificationDetailScreen(
              notificationId: state.pathParameters['id'] ?? '',
            ),
          ),
          GoRoute(
            path: '/owner/map',
            builder: (_, __) => const PortfolioMapScreen(),
          ),
          GoRoute(
            path: '/owner/quick-report',
            builder: (_, __) => const QuickReportScreen(),
          ),
          GoRoute(
            path: '/owner/documents/:id',
            builder: (_, state) => DocumentViewerScreen(
              documentId: state.pathParameters['id'] ?? '',
            ),
          ),
          GoRoute(
            path: '/owner/briefing',
            builder: (_, __) => const MorningBriefingScreen(),
          ),
          GoRoute(
            path: '/owner/messages',
            builder: (_, __) => const TenantMessagesScreen(),
          ),
          // ---------------------------------------------------------------
          GoRoute(
            path: '/admin',
            builder: (_, __) => const AdminHomeScreen(),
          ),
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
    if (auth.isCustomer) return const CustomerHomeScreen();
    if (auth.isEstateManager) return const ManagerHomeScreen();
    if (auth.isOwner || auth.isAccountant) return const OwnerHomeScreen();
    if (auth.isAdmin) return const AdminHomeScreen();
    return const CustomerHomeScreen();
  }
}
