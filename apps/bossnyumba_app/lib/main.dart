import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/auth_provider.dart';
import 'core/api_client.dart';
import 'core/org_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(api: api)),
        // OrgProvider wires itself into ApiClient via activeOrgIdProvider so
        // every request picks up the `X-Active-Org` header automatically.
        ChangeNotifierProvider(create: (_) => OrgProvider(api: api)),
        Provider<ApiClient>.value(value: api),
      ],
      child: const BossNyumbaApp(),
    ),
  );
}
