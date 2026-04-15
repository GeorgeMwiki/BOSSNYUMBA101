import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/auth_provider.dart';
import 'core/api_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  final auth = AuthProvider(api: api);
  // Clear session + token on any 401 so a stale/expired token bounces the
  // user back to /login instead of silently failing every subsequent call.
  api.setUnauthorizedHandler(() => auth.logout());
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        Provider<ApiClient>.value(value: api),
      ],
      child: const BossNyumbaApp(),
    ),
  );
}
