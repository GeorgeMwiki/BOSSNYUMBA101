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
import 'screens/owner/owner_approvals_screen.dart';
import 'screens/admin/admin_home_screen.dart';

GoRouter createGoRouter(AuthProvider auth) {
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: auth,
    redirect: (context, state) {
      if (auth.loading) return null;
      final atLogin = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';
      if (!auth.isAuthenticated && !atLogin) return '/login';
      if (auth.isAuthenticated && atLogin) return '/';
      return null;
    },
    routes: [
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
          GoRoute(
            path: '/owner',
            builder: (_, __) => const OwnerHomeScreen(),
          ),
          GoRoute(
            path: '/owner/approvals',
            builder: (_, __) => const OwnerApprovalsScreen(),
          ),
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
