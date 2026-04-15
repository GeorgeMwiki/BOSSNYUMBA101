import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/auth_provider.dart';
import 'core/api_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  // AuthProvider wires api.setUnauthorizedHandler internally so that any 401
  // response clears the session and the router bounces the user to /login.
  final auth = AuthProvider(api: api);
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
