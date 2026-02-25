import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/auth_provider.dart';
import 'core/api_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(api: api)),
        Provider<ApiClient>.value(value: api),
      ],
      child: const BossNyumbaApp(),
    ),
  );
}
