import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'core/auth_provider.dart';
import 'core/notifications/notifications_repository.dart';
import 'core/notifications/push_service.dart';
import 'l10n/generated/app_localizations.dart';
import 'router.dart';

class BossNyumbaApp extends StatelessWidget {
  const BossNyumbaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();
    final router = createGoRouter(auth);
    return MultiProvider(
      providers: [
        // Notifications repository is app-wide so the inbox, detail screen,
        // and the home dashboard's "Recent alerts" row all share one source
        // of truth for read state + unread counts.
        ChangeNotifierProvider<NotificationsRepository>(
          create: (_) => NotificationsRepository(),
        ),
      ],
      child: MaterialApp.router(
      title: 'BOSSNYUMBA',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en'),
        Locale('sw'),
      ],
      builder: (context, child) => NotificationsBootstrap(child: child),
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
    ),
    );
  }
}

/// Wraps the app body so push notifications are initialised exactly once,
/// after the user is authenticated, and torn down on logout. Kept as a
/// separate widget (rather than running in `main.dart`) so the lifecycle is
/// tied to the widget tree — tests can mount the app without FCM spinning up.
class NotificationsBootstrap extends StatefulWidget {
  final Widget? child;
  const NotificationsBootstrap({super.key, required this.child});

  @override
  State<NotificationsBootstrap> createState() => _NotificationsBootstrapState();
}

class _NotificationsBootstrapState extends State<NotificationsBootstrap> {
  StreamSubscription<RemoteMessage>? _fgSub;
  String? _bootstrappedUserId;

  Future<void> _maybeBootstrap() async {
    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    final repo = context.read<NotificationsRepository>();

    if (!auth.isAuthenticated) {
      if (_bootstrappedUserId != null) {
        // Logged out since we last bootstrapped — unregister and reset.
        await PushService.instance.unregister();
        await _fgSub?.cancel();
        _fgSub = null;
        _bootstrappedUserId = null;
      }
      return;
    }

    final userId = auth.userId;
    if (userId == null || userId.isEmpty) return;
    if (_bootstrappedUserId == userId) return;
    _bootstrappedUserId = userId;

    // Fire and forget — the push service itself swallows any bootstrap errors.
    // ignore: discarded_futures
    PushService.instance.initialize(userId: userId);

    // Warm the inbox once on first auth so home dashboard "recent alerts"
    // has something to show without a user-initiated pull-to-refresh.
    // ignore: discarded_futures
    repo.refresh();

    _fgSub?.cancel();
    _fgSub = PushService.instance.foregroundMessages.listen((_) {
      // When a push lands in the foreground we optimistically refetch so
      // the inbox reflects the new item and the badge is correct.
      // ignore: discarded_futures
      repo.refresh();
    });
  }

  @override
  void dispose() {
    _fgSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Subscribe to auth so we re-run the bootstrap logic whenever
    // authentication state flips. Using `watch` here means the framework
    // will rebuild us on every login/logout tick.
    context.watch<AuthProvider>();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeBootstrap());
    return widget.child ?? const SizedBox.shrink();
  }
}
