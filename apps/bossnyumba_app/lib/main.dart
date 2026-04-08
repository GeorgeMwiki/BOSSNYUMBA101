import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/auth_provider.dart';
import 'core/api_client.dart';
import 'core/org_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  // Construct with autoRestore disabled so we can await the restore explicitly
  // before the first frame / router decision.
  final auth = AuthProvider(api: api, autoRestore: false);
  await auth.restoreSession();
  runApp(
    MultiProvider(
      providers: [
        // AuthProvider was constructed above with autoRestore disabled and
        // restoreSession() awaited, so the router has correct auth state on
        // the very first frame.
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        // OrgProvider wires itself into ApiClient via activeOrgIdProvider so
        // every request picks up the `X-Active-Org` header automatically.
        ChangeNotifierProvider(create: (_) => OrgProvider(api: api)),
        Provider<ApiClient>.value(value: api),
      ],
      child: const BossNyumbaApp(),
    ),
  );
}
