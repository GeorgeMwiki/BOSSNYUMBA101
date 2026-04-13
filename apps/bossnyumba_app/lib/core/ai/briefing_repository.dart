import '../api_client.dart';

/// Structured morning briefing returned by `GET /api/v1/ai/briefing`.
///
/// The endpoint is expected to return a payload shaped like:
/// ```json
/// {
///   "briefingDate": "2026-04-08",
///   "generatedAt": "2026-04-08T07:00:00+03:00",
///   "summary": "Calm day: collections on track, one lease needs sign-off.",
///   "money": {
///     "headline": "KES 145,000 in arrears across 4 tenants",
///     "collectionRate": 0.87,
///     "arrearsTotal": 145000,
///     "expectedTodayTotal": 320000,
///     "currency": "KES",
///     "deepLink": "/owner/finance"
///   },
///   "occupancy": {
///     "headline": "Occupancy 87% (-2pts week over week)",
///     "occupied": 52,
///     "total": 60,
///     "vacanciesNeedingAttention": 3,
///     "deepLink": "/owner/occupancy"
///   },
///   "pendingSignOff": {
///     "headline": "3 items waiting on you",
///     "count": 3,
///     "items": [
///       { "id": "l_1", "title": "Lease renewal – Unit 4B", "subtitle": "Jane Mwangi" },
///       { "id": "l_2", "title": "Rent review – Unit 2A", "subtitle": "John Otieno" },
///       { "id": "i_9", "title": "Vendor invoice – ACME Plumbing", "subtitle": "KES 18,500" }
///     ],
///     "deepLink": "/owner/sign-off"
///   },
///   "maintenance": {
///     "headline": "1 critical ticket, 0 escalations",
///     "criticalCount": 1,
///     "escalationsCount": 0,
///     "deepLink": "/owner/maintenance"
///   },
///   "taxCompliance": {
///     "headline": "eTIMS – all invoices submitted",
///     "status": "ok",
///     "provider": "eTIMS",
///     "deepLink": "/owner/compliance"
///   },
///   "riskFlags": {
///     "headline": "1 tenant late 3 months in a row",
///     "flags": [
///       { "id": "r_1", "severity": "high", "message": "Tenant Kamau late 3 months in a row" }
///     ],
///     "deepLink": "/owner/risks"
///   }
/// }
/// ```
class DailyBriefing {
  final DateTime briefingDate;
  final DateTime? generatedAt;
  final String summary;
  final MoneySection money;
  final OccupancySection occupancy;
  final PendingSignOffSection pendingSignOff;
  final MaintenanceSection maintenance;
  final TaxComplianceSection taxCompliance;
  final RiskFlagsSection riskFlags;

  const DailyBriefing({
    required this.briefingDate,
    required this.generatedAt,
    required this.summary,
    required this.money,
    required this.occupancy,
    required this.pendingSignOff,
    required this.maintenance,
    required this.taxCompliance,
    required this.riskFlags,
  });

  factory DailyBriefing.fromJson(Map<String, dynamic> json) {
    return DailyBriefing(
      briefingDate: _parseDate(json['briefingDate']) ?? DateTime.now(),
      generatedAt: _parseDateTime(json['generatedAt']),
      summary: (json['summary'] as String?) ?? '',
      money: MoneySection.fromJson(
          (json['money'] as Map?)?.cast<String, dynamic>() ?? const {}),
      occupancy: OccupancySection.fromJson(
          (json['occupancy'] as Map?)?.cast<String, dynamic>() ?? const {}),
      pendingSignOff: PendingSignOffSection.fromJson(
          (json['pendingSignOff'] as Map?)?.cast<String, dynamic>() ?? const {}),
      maintenance: MaintenanceSection.fromJson(
          (json['maintenance'] as Map?)?.cast<String, dynamic>() ?? const {}),
      taxCompliance: TaxComplianceSection.fromJson(
          (json['taxCompliance'] as Map?)?.cast<String, dynamic>() ?? const {}),
      riskFlags: RiskFlagsSection.fromJson(
          (json['riskFlags'] as Map?)?.cast<String, dynamic>() ?? const {}),
    );
  }
}

class MoneySection {
  final String headline;
  final double collectionRate;
  final double arrearsTotal;
  final double expectedTodayTotal;
  final String currency;
  final String? deepLink;

  const MoneySection({
    required this.headline,
    required this.collectionRate,
    required this.arrearsTotal,
    required this.expectedTodayTotal,
    required this.currency,
    this.deepLink,
  });

  factory MoneySection.fromJson(Map<String, dynamic> json) => MoneySection(
        headline: (json['headline'] as String?) ?? '',
        collectionRate: _toDouble(json['collectionRate']) ?? 0,
        arrearsTotal: _toDouble(json['arrearsTotal']) ?? 0,
        expectedTodayTotal: _toDouble(json['expectedTodayTotal']) ?? 0,
        currency: (json['currency'] as String?) ?? 'KES',
        deepLink: json['deepLink'] as String?,
      );
}

class OccupancySection {
  final String headline;
  final int occupied;
  final int total;
  final int vacanciesNeedingAttention;
  final String? deepLink;

  const OccupancySection({
    required this.headline,
    required this.occupied,
    required this.total,
    required this.vacanciesNeedingAttention,
    this.deepLink,
  });

  factory OccupancySection.fromJson(Map<String, dynamic> json) =>
      OccupancySection(
        headline: (json['headline'] as String?) ?? '',
        occupied: (json['occupied'] as num?)?.toInt() ?? 0,
        total: (json['total'] as num?)?.toInt() ?? 0,
        vacanciesNeedingAttention:
            (json['vacanciesNeedingAttention'] as num?)?.toInt() ?? 0,
        deepLink: json['deepLink'] as String?,
      );
}

class PendingSignOffItem {
  final String id;
  final String title;
  final String? subtitle;

  const PendingSignOffItem({
    required this.id,
    required this.title,
    this.subtitle,
  });

  factory PendingSignOffItem.fromJson(Map<String, dynamic> json) =>
      PendingSignOffItem(
        id: (json['id'] as String?) ?? '',
        title: (json['title'] as String?) ?? '',
        subtitle: json['subtitle'] as String?,
      );
}

class PendingSignOffSection {
  final String headline;
  final int count;
  final List<PendingSignOffItem> items;
  final String? deepLink;

  const PendingSignOffSection({
    required this.headline,
    required this.count,
    required this.items,
    this.deepLink,
  });

  factory PendingSignOffSection.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List?) ?? const [];
    return PendingSignOffSection(
      headline: (json['headline'] as String?) ?? '',
      count: (json['count'] as num?)?.toInt() ?? rawItems.length,
      items: rawItems
          .whereType<Map>()
          .map((e) => PendingSignOffItem.fromJson(e.cast<String, dynamic>()))
          .toList(),
      deepLink: json['deepLink'] as String?,
    );
  }
}

class MaintenanceSection {
  final String headline;
  final int criticalCount;
  final int escalationsCount;
  final String? deepLink;

  const MaintenanceSection({
    required this.headline,
    required this.criticalCount,
    required this.escalationsCount,
    this.deepLink,
  });

  factory MaintenanceSection.fromJson(Map<String, dynamic> json) =>
      MaintenanceSection(
        headline: (json['headline'] as String?) ?? '',
        criticalCount: (json['criticalCount'] as num?)?.toInt() ?? 0,
        escalationsCount: (json['escalationsCount'] as num?)?.toInt() ?? 0,
        deepLink: json['deepLink'] as String?,
      );
}

class TaxComplianceSection {
  final String headline;
  final String status; // ok | pending | failing
  final String provider; // eTIMS | TRA | ...
  final String? deepLink;

  const TaxComplianceSection({
    required this.headline,
    required this.status,
    required this.provider,
    this.deepLink,
  });

  factory TaxComplianceSection.fromJson(Map<String, dynamic> json) =>
      TaxComplianceSection(
        headline: (json['headline'] as String?) ?? '',
        status: (json['status'] as String?) ?? 'ok',
        provider: (json['provider'] as String?) ?? 'eTIMS',
        deepLink: json['deepLink'] as String?,
      );
}

class RiskFlag {
  final String id;
  final String severity; // low | medium | high
  final String message;

  const RiskFlag({
    required this.id,
    required this.severity,
    required this.message,
  });

  factory RiskFlag.fromJson(Map<String, dynamic> json) => RiskFlag(
        id: (json['id'] as String?) ?? '',
        severity: (json['severity'] as String?) ?? 'medium',
        message: (json['message'] as String?) ?? '',
      );
}

class RiskFlagsSection {
  final String headline;
  final List<RiskFlag> flags;
  final String? deepLink;

  const RiskFlagsSection({
    required this.headline,
    required this.flags,
    this.deepLink,
  });

  factory RiskFlagsSection.fromJson(Map<String, dynamic> json) {
    final rawFlags = (json['flags'] as List?) ?? const [];
    return RiskFlagsSection(
      headline: (json['headline'] as String?) ?? '',
      flags: rawFlags
          .whereType<Map>()
          .map((e) => RiskFlag.fromJson(e.cast<String, dynamic>()))
          .toList(),
      deepLink: json['deepLink'] as String?,
    );
  }
}

/// Thin repository wrapping `GET /api/v1/ai/briefing`.
///
/// The X-Active-Org header is injected globally by ApiClient once
/// the org_provider lands; until then we pass `orgId` as a query param
/// so this call is usable today.
class BriefingRepository {
  final ApiClient _api;

  BriefingRepository({ApiClient? api}) : _api = api ?? ApiClient.instance;

  Future<DailyBriefing> fetchBriefing({
    required String orgId,
    DateTime? forDate,
  }) async {
    final params = <String, String>{
      'orgId': orgId,
      if (forDate != null) 'date': _formatDate(forDate),
    };
    final resp =
        await _api.get<Map<String, dynamic>>('/ai/briefing', queryParams: params);
    if (!resp.isOk || resp.data == null) {
      throw BriefingRepositoryException(
        resp.error ?? 'Failed to load briefing',
        statusCode: resp.statusCode,
      );
    }
    return DailyBriefing.fromJson(resp.data!);
  }
}

class BriefingRepositoryException implements Exception {
  final String message;
  final int? statusCode;

  BriefingRepositoryException(this.message, {this.statusCode});

  @override
  String toString() => 'BriefingRepositoryException($statusCode): $message';
}

DateTime? _parseDate(dynamic v) {
  if (v is String && v.isNotEmpty) {
    try {
      return DateTime.parse(v);
    } catch (_) {}
  }
  return null;
}

DateTime? _parseDateTime(dynamic v) {
  if (v is String && v.isNotEmpty) {
    try {
      return DateTime.parse(v);
    } catch (_) {}
  }
  return null;
}

double? _toDouble(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

String _formatDate(DateTime d) {
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}
