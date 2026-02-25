import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth_provider.dart';
import 'router.dart';

class BossNyumbaApp extends StatelessWidget {
  const BossNyumbaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();
    final router = createGoRouter(auth);
    return MaterialApp.router(
      title: 'BOSSNYUMBA',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF1DB954),
          onPrimary: Colors.black,
          surface: const Color(0xFF121212),
          onSurface: Colors.white,
          surfaceContainerHighest: const Color(0xFF282828),
        ),
        scaffoldBackgroundColor: const Color(0xFF121212),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          centerTitle: true,
          backgroundColor: Color(0xFF121212),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        cardTheme: CardTheme(
          color: const Color(0xFF282828),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Color(0xFF121212),
          selectedItemColor: Color(0xFF1DB954),
          unselectedItemColor: Color(0xFFB3B3B3),
          type: BottomNavigationBarType.fixed,
        ),
      ),
      routerConfig: router,
    );
  }
}
