// Tests for the ISO-4217-aware currency formatter on the Flutter side.
//
// Mirrors `packages/api-client/src/currency.test.ts`. Pins the contract:
//   - 2-decimal currencies (KES/USD/EUR) render with `.00`
//   - 0-decimal currencies (JPY/UGX/TZS) render without decimals
//   - 3-decimal currencies (BHD/KWD/JOD) render with `.000`
//   - Missing currency arg throws ArgumentError
//   - Unknown ISO codes fall back to 2 decimals
//
// `intl` may format with locale-specific separators, so we assert on
// regex shape (currency code + correct decimal count) rather than
// exact glyphs.

import 'package:flutter_test/flutter_test.dart';
import 'package:bossnyumba_app/utils/currency.dart';

void main() {
  group('getCurrencyDecimals', () {
    test('returns 2 for KES, USD, EUR, GBP', () {
      expect(getCurrencyDecimals('KES'), 2);
      expect(getCurrencyDecimals('USD'), 2);
      expect(getCurrencyDecimals('EUR'), 2);
      expect(getCurrencyDecimals('GBP'), 2);
    });

    test('returns 0 for JPY, KRW, UGX, RWF, TZS, VND', () {
      expect(getCurrencyDecimals('JPY'), 0);
      expect(getCurrencyDecimals('KRW'), 0);
      expect(getCurrencyDecimals('UGX'), 0);
      expect(getCurrencyDecimals('RWF'), 0);
      expect(getCurrencyDecimals('TZS'), 0);
      expect(getCurrencyDecimals('VND'), 0);
    });

    test('returns 3 for BHD, KWD, JOD, OMR, TND, IQD, LYD', () {
      expect(getCurrencyDecimals('BHD'), 3);
      expect(getCurrencyDecimals('KWD'), 3);
      expect(getCurrencyDecimals('JOD'), 3);
      expect(getCurrencyDecimals('OMR'), 3);
      expect(getCurrencyDecimals('TND'), 3);
      expect(getCurrencyDecimals('IQD'), 3);
      expect(getCurrencyDecimals('LYD'), 3);
    });

    test('returns 4 for CLF', () {
      expect(getCurrencyDecimals('CLF'), 4);
    });

    test('defaults to 2 for unknown codes', () {
      expect(getCurrencyDecimals('XYZ'), 2);
      expect(getCurrencyDecimals('ZZZ'), 2);
    });

    test('upper-cases lowercase input before lookup', () {
      expect(getCurrencyDecimals('jpy'), 0);
      expect(getCurrencyDecimals('bhd'), 3);
    });
  });

  group('formatCurrency — 2-decimal currencies', () {
    test('formats KES 100000 with two decimals', () {
      final result = formatCurrency(100000, 'KES', locale: 'en_US');
      expect(result, contains('KES'));
      expect(result, matches(r'100[,.]000\.00'));
    });

    test('formats USD with two decimals', () {
      final result = formatCurrency(1234.5, 'USD', locale: 'en_US');
      expect(result, contains('USD'));
      expect(result, matches(r'1[,.]234\.50'));
    });
  });

  group('formatCurrency — 0-decimal currencies', () {
    test('formats JPY 100000 without decimals', () {
      final result = formatCurrency(100000, 'JPY', locale: 'en_US');
      expect(result, contains('JPY'));
      expect(result, matches(r'100[,.]000(?!\.)'));
      expect(result, isNot(matches(r'\.\d')));
    });

    test('formats TZS without decimals', () {
      final result = formatCurrency(50000, 'TZS', locale: 'en_US');
      expect(result, contains('TZS'));
      expect(result, isNot(matches(r'\.\d')));
    });

    test('formats UGX without decimals', () {
      final result = formatCurrency(75000, 'UGX', locale: 'en_US');
      expect(result, contains('UGX'));
      expect(result, isNot(matches(r'\.\d')));
    });
  });

  group('formatCurrency — 3-decimal currencies', () {
    test('formats BHD 100 with three decimals', () {
      final result = formatCurrency(100, 'BHD', locale: 'en_US');
      expect(result, contains('BHD'));
      expect(result, matches(r'100\.000'));
    });

    test('formats KWD 50.5 with three decimals', () {
      final result = formatCurrency(50.5, 'KWD', locale: 'en_US');
      expect(result, contains('KWD'));
      expect(result, matches(r'50\.500'));
    });
  });

  group('formatCurrency — 4-decimal currencies', () {
    test('formats CLF with four decimals', () {
      final result = formatCurrency(1, 'CLF', locale: 'en_US');
      expect(result, contains('CLF'));
      expect(result, matches(r'1\.0000'));
    });
  });

  group('formatCurrency — case insensitivity', () {
    test('upper-cases lowercase input before formatting', () {
      final result = formatCurrency(100, 'jpy', locale: 'en_US');
      expect(result, contains('JPY'));
      expect(result, isNot(matches(r'\.\d')));
    });
  });

  group('formatCurrency — non-finite amounts', () {
    test('renders a safe placeholder for NaN', () {
      expect(formatCurrency(double.nan, 'KES'), 'KES —');
    });

    test('renders a safe placeholder for Infinity', () {
      expect(formatCurrency(double.infinity, 'USD'), 'USD —');
    });
  });

  group('formatCurrency — required currency arg', () {
    test('throws ArgumentError when currency is null', () {
      expect(() => formatCurrency(100, null), throwsArgumentError);
    });

    test('throws ArgumentError when currency is empty', () {
      expect(() => formatCurrency(100, ''), throwsArgumentError);
    });

    test('throws ArgumentError when currency is whitespace only', () {
      expect(() => formatCurrency(100, '   '), throwsArgumentError);
    });
  });
}
