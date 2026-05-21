/// ISO-4217-aware currency formatting helpers for the Flutter app.
///
/// Mirrors `packages/api-client/src/currency.ts` and
/// `packages/domain-models/src/common/currencies.ts` (the canonical
/// source of truth on the web side). Decimal counts come from the
/// ISO-4217 standard:
///   - 0 decimals: JPY, KRW, VND, UGX, RWF, TZS, XAF, XOF, XPF, BIF,
///                  CLP, DJF, GNF, ISK, KMF, PYG, VUV
///   - 3 decimals: BHD, JOD, KWD, OMR, TND, IQD, LYD
///   - 4 decimals: CLF
///   - 2 decimals: everything else (default)
///
/// Background:
///   `payments_screen.dart` previously rendered `'$amount $currency'`
///   with `currency ?? 'KES'` — silently mis-labelling every non-KES
///   tenant's invoice. This util enforces an explicit `currency` arg
///   (throws on null/empty) and uses the correct fractional precision.
library;

import 'package:intl/intl.dart';

/// ISO-4217 fractional-decimal table. Keep alphabetical for scan-
/// friendliness; ordering matches
/// `packages/domain-models/src/common/currencies.ts` exactly.
const Map<String, int> _iso4217Decimals = <String, int>{
  'AED': 2, 'AFN': 2, 'ALL': 2, 'AMD': 2, 'ANG': 2, 'AOA': 2, 'ARS': 2,
  'AUD': 2, 'AWG': 2, 'AZN': 2,
  'BAM': 2, 'BBD': 2, 'BDT': 2, 'BGN': 2, 'BHD': 3, 'BIF': 0, 'BMD': 2,
  'BND': 2, 'BOB': 2, 'BRL': 2, 'BSD': 2, 'BTN': 2, 'BWP': 2, 'BYN': 2,
  'BZD': 2,
  'CAD': 2, 'CDF': 2, 'CHF': 2, 'CLF': 4, 'CLP': 0, 'CNY': 2, 'COP': 2,
  'CRC': 2, 'CUP': 2, 'CVE': 2, 'CZK': 2,
  'DJF': 0, 'DKK': 2, 'DOP': 2, 'DZD': 2,
  'EGP': 2, 'ERN': 2, 'ETB': 2, 'EUR': 2,
  'FJD': 2, 'FKP': 2,
  'GBP': 2, 'GEL': 2, 'GHS': 2, 'GIP': 2, 'GMD': 2, 'GNF': 0, 'GTQ': 2,
  'GYD': 2,
  'HKD': 2, 'HNL': 2, 'HTG': 2, 'HUF': 2,
  'IDR': 2, 'ILS': 2, 'INR': 2, 'IQD': 3, 'IRR': 2, 'ISK': 0,
  'JMD': 2, 'JOD': 3, 'JPY': 0,
  'KES': 2, 'KGS': 2, 'KHR': 2, 'KMF': 0, 'KPW': 2, 'KRW': 0, 'KWD': 3,
  'KYD': 2, 'KZT': 2,
  'LAK': 2, 'LBP': 2, 'LKR': 2, 'LRD': 2, 'LSL': 2, 'LYD': 3,
  'MAD': 2, 'MDL': 2, 'MGA': 2, 'MKD': 2, 'MMK': 2, 'MNT': 2, 'MOP': 2,
  'MRU': 2, 'MUR': 2, 'MVR': 2, 'MWK': 2, 'MXN': 2, 'MYR': 2, 'MZN': 2,
  'NAD': 2, 'NGN': 2, 'NIO': 2, 'NOK': 2, 'NPR': 2, 'NZD': 2,
  'OMR': 3,
  'PAB': 2, 'PEN': 2, 'PGK': 2, 'PHP': 2, 'PKR': 2, 'PLN': 2, 'PYG': 0,
  'QAR': 2,
  'RON': 2, 'RSD': 2, 'RUB': 2, 'RWF': 0,
  'SAR': 2, 'SBD': 2, 'SCR': 2, 'SDG': 2, 'SEK': 2, 'SGD': 2, 'SHP': 2,
  'SLE': 2, 'SOS': 2, 'SRD': 2, 'SSP': 2, 'STN': 2, 'SYP': 2, 'SZL': 2,
  'THB': 2, 'TJS': 2, 'TMT': 2, 'TND': 3, 'TOP': 2, 'TRY': 2, 'TTD': 2,
  'TWD': 2, 'TZS': 0,
  'UAH': 2, 'UGX': 0, 'USD': 2, 'UYU': 2, 'UZS': 2,
  'VES': 2, 'VND': 0, 'VUV': 0,
  'WST': 2,
  'XAF': 0, 'XCD': 2, 'XOF': 0, 'XPF': 0,
  'YER': 2,
  'ZAR': 2, 'ZMW': 2, 'ZWG': 2,
};

/// Returns the ISO-4217 fractional-decimal count for [code]. Unknown
/// codes default to 2 (matches `decimalsForCurrency` on the web side).
int getCurrencyDecimals(String code) {
  return _iso4217Decimals[code.toUpperCase()] ?? 2;
}

/// Format [amount] as a localised currency string in [currency]
/// (ISO-4217 code).
///
/// Always uses the ISO precision from [getCurrencyDecimals]. Locale
/// defaults to the runtime's default locale; pass [locale] (e.g.
/// `'en_KE'`, `'sw_TZ'`) to control thousands separators.
///
/// [currency] is required at runtime. Passing `null` or an empty
/// string throws [ArgumentError] — refusing to silently mis-format
/// with a hardcoded default. The previous payments-screen formatter
/// defaulted to `'KES'`, silently mis-labelling every non-KES tenant.
///
/// Example:
///   formatCurrency(100000, 'KES')    -> 'KES 100,000.00'
///   formatCurrency(100000, 'JPY')    -> 'JPY 100,000'
///   formatCurrency(100, 'BHD')       -> 'BHD 100.000'
String formatCurrency(num amount, String? currency, {String? locale}) {
  if (currency == null || currency.trim().isEmpty) {
    throw ArgumentError(
      'formatCurrency: `currency` is required (ISO-4217 code). '
      'Refusing to silently default — pass the tenant/user currency.',
    );
  }

  final code = currency.trim().toUpperCase();
  final decimals = getCurrencyDecimals(code);

  if (!amount.isFinite) {
    return '$code —';
  }

  final formatter = NumberFormat.currency(
    locale: locale,
    name: code,
    decimalDigits: decimals,
  );
  return formatter.format(amount);
}
