import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/api_client.dart';
import 'core/auth_provider.dart';
import 'core/cache/owner_cache.dart';
import 'core/org_provider.dart';
import 'router.dart' show onboardingListenable;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Singletons that must be ready before the first frame.
  await OwnerCache.instance.init();
  // Prime the onboarded flag so the router's first redirect pass sees it.
  await onboardingListenable.refresh();

  final api = ApiClient();
  final auth = AuthProvider(api: api);
  final orgs = OrgProvider();

  // Restore any persisted session before building the router so the initial
  // redirect logic can see the real authenticated state.
  await auth.restoreSession();
  if (auth.isAuthenticated) {
    await orgs.setAvailableOrgs(auth.memberships);
  }

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider<OrgProvider>.value(value: orgs),
        Provider<OwnerCache>.value(value: OwnerCache.instance),
      ],
      child: const BossNyumbaApp(),
    ),
  );
}
