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
///
/// Names mirror the web design-system semantic tokens (primary,
/// secondary, surface, etc.) so cross-platform components stay
/// visually consistent.
class BossnyumbaColors {
  BossnyumbaColors._();

  // ── Brand ──────────────────────────────────────────────────────────────
  /// Primary brand colour — BOSSNYUMBA blue.
  static const primary = Color(0xFF1E40AF);
  static const primaryHover = Color(0xFF1D4ED8);
  static const primaryPressed = Color(0xFF1E3A8A);

  /// Accent — used for CTAs, payment confirmation, etc.
  static const accent = Color(0xFFF59E0B);
  static const accentHover = Color(0xFFD97706);

  // ── Status ─────────────────────────────────────────────────────────────
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFDC2626);
  static const info = Color(0xFF0EA5E9);

  // ── Neutrals ───────────────────────────────────────────────────────────
  static const neutral0 = Color(0xFFFFFFFF);
  static const neutral50 = Color(0xFFF9FAFB);
  static const neutral100 = Color(0xFFF3F4F6);
  static const neutral200 = Color(0xFFE5E7EB);
  static const neutral400 = Color(0xFF9CA3AF);
  static const neutral600 = Color(0xFF4B5563);
  static const neutral800 = Color(0xFF1F2937);
  static const neutral900 = Color(0xFF111827);

  // ── Light theme semantic ───────────────────────────────────────────────
  static const lightBackground = neutral50;
  static const lightSurface = neutral0;
  static const lightOnBackground = neutral900;
  static const lightOnSurface = neutral800;
  static const lightBorder = neutral200;

  // ── Dark theme semantic ────────────────────────────────────────────────
  static const darkBackground = Color(0xFF0B1220);
  static const darkSurface = Color(0xFF111827);
  static const darkOnBackground = Color(0xFFE5E7EB);
  static const darkOnSurface = Color(0xFFF3F4F6);
  static const darkBorder = Color(0xFF1F2937);
}

/// Typography tokens (Plus Jakarta Sans).
///
/// The concrete `TextStyle`s are produced by `google_fonts` at
/// runtime — these constants are placeholders for now.
class BossnyumbaTextStyles {
  BossnyumbaTextStyles._();

  /// Display: 32sp / 700 weight — used for screen headers.
  static const double displayFontSize = 32;
  static const FontWeight displayFontWeight = FontWeight.w700;

  /// Title: 22sp / 600 — section headers.
  static const double titleFontSize = 22;
  static const FontWeight titleFontWeight = FontWeight.w600;

  /// Body: 16sp / 400 — default paragraph text.
  static const double bodyFontSize = 16;
  static const FontWeight bodyFontWeight = FontWeight.w400;

  /// Caption: 13sp / 500 — metadata, timestamps.
  static const double captionFontSize = 13;
  static const FontWeight captionFontWeight = FontWeight.w500;
}

/// ThemeData factories.
class BossnyumbaTheme {
  BossnyumbaTheme._();

  /// Light theme — call from `MaterialApp(theme: BossnyumbaTheme.light())`.
  static ThemeData light() {
    throw UnimplementedError(
      'BossnyumbaTheme.light() — implementation pending. '
      'Will produce a ThemeData built from BossnyumbaColors + Plus Jakarta Sans.',
    );
  }

  /// Dark theme — call from `MaterialApp(darkTheme: BossnyumbaTheme.dark())`.
  static ThemeData dark() {
    throw UnimplementedError(
      'BossnyumbaTheme.dark() — implementation pending.',
    );
  }
}
