// ---------------------------------------------------------------------------
// theme.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA mobile design tokens + ThemeData factory.
//
// What BELONGS in this file:
//   * `BossnyumbaColors` — the canonical colour palette mirroring
//     the web design-system package (Tailwind / OKLCH tokens). When
//     the web theme changes, these values change in lockstep.
//   * `BossnyumbaTextStyles` — typography scale (Plus Jakarta Sans).
//   * `BossnyumbaTheme.light` / `BossnyumbaTheme.dark` — ThemeData
//     factories the app shells call once at startup.
//
// What does NOT belong here:
//   * Widget implementations — those live under `widgets/`.
//   * Per-screen styling — that's screen-local.
//
// Mirror policy: every time the web design-system updates its OKLCH
// tokens, this file must be regenerated. A future task adds a
// codegen pipeline that reads `packages/design-system/src/tokens.json`
// from the web codebase and rewrites these constants automatically.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

/// BOSSNYUMBA brand colour tokens.
class BossnyumbaColors {
  BossnyumbaColors._();

  // ── Brand ──────────────────────────────────────────────────────────────
  /// Primary brand colour — BOSSNYUMBA blue.
  static const Color primary = Color(0xFF1E40AF);
  static const Color primaryHover = Color(0xFF1D4ED8);
  static const Color primaryPressed = Color(0xFF1E3A8A);

  /// Accent — used for CTAs, payment confirmation, etc.
  static const Color accent = Color(0xFFF59E0B);
  static const Color accentHover = Color(0xFFD97706);

  // ── Status ─────────────────────────────────────────────────────────────
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFDC2626);
  static const Color info = Color(0xFF0EA5E9);

  // ── Neutrals ───────────────────────────────────────────────────────────
  static const Color neutral0 = Color(0xFFFFFFFF);
  static const Color neutral50 = Color(0xFFF9FAFB);
  static const Color neutral100 = Color(0xFFF3F4F6);
  static const Color neutral200 = Color(0xFFE5E7EB);
  static const Color neutral400 = Color(0xFF9CA3AF);
  static const Color neutral600 = Color(0xFF4B5563);
  static const Color neutral800 = Color(0xFF1F2937);
  static const Color neutral900 = Color(0xFF111827);

  // ── Light theme semantic ───────────────────────────────────────────────
  static const Color lightBackground = neutral50;
  static const Color lightSurface = neutral0;
  static const Color lightOnBackground = neutral900;
  static const Color lightOnSurface = neutral800;
  static const Color lightBorder = neutral200;

  // ── Dark theme semantic ────────────────────────────────────────────────
  static const Color darkBackground = Color(0xFF0B1220);
  static const Color darkSurface = Color(0xFF111827);
  static const Color darkOnBackground = Color(0xFFE5E7EB);
  static const Color darkOnSurface = Color(0xFFF3F4F6);
  static const Color darkBorder = Color(0xFF1F2937);
}

/// Typography tokens (Plus Jakarta Sans).
class BossnyumbaTextStyles {
  BossnyumbaTextStyles._();

  static const double displayFontSize = 32;
  static const FontWeight displayFontWeight = FontWeight.w700;

  static const double titleFontSize = 22;
  static const FontWeight titleFontWeight = FontWeight.w600;

  static const double bodyFontSize = 16;
  static const FontWeight bodyFontWeight = FontWeight.w400;

  static const double captionFontSize = 13;
  static const FontWeight captionFontWeight = FontWeight.w500;
}

/// ThemeData factories.
class BossnyumbaTheme {
  BossnyumbaTheme._();

  /// Light theme — call from `MaterialApp(theme: BossnyumbaTheme.light())`.
  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      colorScheme: const ColorScheme.light(
        primary: BossnyumbaColors.primary,
        onPrimary: BossnyumbaColors.neutral0,
        secondary: BossnyumbaColors.accent,
        onSecondary: BossnyumbaColors.neutral900,
        surface: BossnyumbaColors.lightSurface,
        onSurface: BossnyumbaColors.lightOnSurface,
        error: BossnyumbaColors.danger,
        onError: BossnyumbaColors.neutral0,
      ),
      scaffoldBackgroundColor: BossnyumbaColors.lightBackground,
      textTheme: _textTheme(BossnyumbaColors.lightOnBackground),
      appBarTheme: const AppBarTheme(
        backgroundColor: BossnyumbaColors.lightSurface,
        foregroundColor: BossnyumbaColors.lightOnSurface,
        elevation: 0,
      ),
      dividerColor: BossnyumbaColors.lightBorder,
    );
  }

  /// Dark theme — call from `MaterialApp(darkTheme: BossnyumbaTheme.dark())`.
  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      colorScheme: const ColorScheme.dark(
        primary: BossnyumbaColors.primaryHover,
        onPrimary: BossnyumbaColors.neutral0,
        secondary: BossnyumbaColors.accent,
        onSecondary: BossnyumbaColors.neutral900,
        surface: BossnyumbaColors.darkSurface,
        onSurface: BossnyumbaColors.darkOnSurface,
        error: BossnyumbaColors.danger,
        onError: BossnyumbaColors.neutral0,
      ),
      scaffoldBackgroundColor: BossnyumbaColors.darkBackground,
      textTheme: _textTheme(BossnyumbaColors.darkOnBackground),
      appBarTheme: const AppBarTheme(
        backgroundColor: BossnyumbaColors.darkSurface,
        foregroundColor: BossnyumbaColors.darkOnSurface,
        elevation: 0,
      ),
      dividerColor: BossnyumbaColors.darkBorder,
    );
  }

  static TextTheme _textTheme(Color onBg) {
    return TextTheme(
      displayLarge: TextStyle(
        fontSize: BossnyumbaTextStyles.displayFontSize,
        fontWeight: BossnyumbaTextStyles.displayFontWeight,
        color: onBg,
      ),
      titleLarge: TextStyle(
        fontSize: BossnyumbaTextStyles.titleFontSize,
        fontWeight: BossnyumbaTextStyles.titleFontWeight,
        color: onBg,
      ),
      bodyMedium: TextStyle(
        fontSize: BossnyumbaTextStyles.bodyFontSize,
        fontWeight: BossnyumbaTextStyles.bodyFontWeight,
        color: onBg,
      ),
      labelSmall: TextStyle(
        fontSize: BossnyumbaTextStyles.captionFontSize,
        fontWeight: BossnyumbaTextStyles.captionFontWeight,
        color: onBg,
      ),
    );
  }
}
