import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../auth_provider.dart';
import '../org_provider.dart';
import 'push_service.dart';

/// Widget that wraps the app body and reacts to authentication state.
/// When the user becomes authenticated it:
///   * calls [PushService.initialize]
///   * syncs the current user's memberships into [OrgProvider]
/// When the user logs out it resets push state.
class NotificationsBootstrap extends StatefulWidget {
  final Widget child;
  const NotificationsBootstrap({super.key, required this.child});

  @override
  State<NotificationsBootstrap> createState() => _NotificationsBootstrapState();
}

class _NotificationsBootstrapState extends State<NotificationsBootstrap> {
  bool _wasAuthenticated = false;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    auth.addListener(_onAuthChanged);
    // Handle initial state (e.g. restored session).
    WidgetsBinding.instance.addPostFrameCallback((_) => _onAuthChanged());
  }

  @override
  void dispose() {
    context.read<AuthProvider>().removeListener(_onAuthChanged);
    super.dispose();
  }

  Future<void> _onAuthChanged() async {
    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    final orgs = context.read<OrgProvider>();
    final authenticated = auth.isAuthenticated;

    if (authenticated && !_wasAuthenticated) {
      await PushService.instance.initialize(userId: auth.session?.id);
      await orgs.setAvailableOrgs(auth.memberships);
    } else if (!authenticated && _wasAuthenticated) {
      await PushService.instance.reset();
      await orgs.clear();
    } else if (authenticated) {
      // Refresh org list on any authenticated update (e.g. memberships changed).
      await orgs.setAvailableOrgs(auth.memberships);
    }
    _wasAuthenticated = authenticated;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
