import '../api_client.dart';

/// Typed result for a Property row returned by the universal search endpoint.
class PropertyResult {
  final String id;
  final String name;
  final String? address;
  final int unitCount;
  final int occupiedUnits;

  PropertyResult({
    required this.id,
    required this.name,
    this.address,
    this.unitCount = 0,
    this.occupiedUnits = 0,
  });

  factory PropertyResult.fromJson(Map<String, dynamic> j) => PropertyResult(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? 'Unnamed property').toString(),
        address: j['address'] as String? ?? j['city'] as String?,
        unitCount: (j['unitCount'] ?? j['units'] ?? 0) as int,
        occupiedUnits: (j['occupiedUnits'] ?? 0) as int,
      );

  String get subtitle {
    final loc = (address == null || address!.isEmpty) ? '—' : address!;
    return '$unitCount units • $loc';
  }
}

/// Typed result for a Unit row returned by the universal search endpoint.
class UnitResult {
  final String id;
  final String label;
  final String? propertyId;
  final String? propertyName;
  final String? status; // vacant | occupied | reserved | maintenance
  final double? monthlyRent;

  UnitResult({
    required this.id,
    required this.label,
    this.propertyId,
    this.propertyName,
    this.status,
    this.monthlyRent,
  });

  factory UnitResult.fromJson(Map<String, dynamic> j) => UnitResult(
        id: (j['id'] ?? '').toString(),
        label: (j['label'] ?? j['number'] ?? j['name'] ?? 'Unit').toString(),
        propertyId: j['propertyId'] as String?,
        propertyName: j['propertyName'] as String? ?? j['property'] as String?,
        status: j['status'] as String?,
        monthlyRent: (j['monthlyRent'] as num?)?.toDouble(),
      );

  String get subtitle {
    final prop = (propertyName == null || propertyName!.isEmpty) ? '—' : propertyName!;
    final st = (status == null || status!.isEmpty) ? 'unknown' : status!;
    return '$prop • $st';
  }
}

/// Typed result for a Tenant row returned by the universal search endpoint.
class TenantResult {
  final String id;
  final String name;
  final String? unitLabel;
  final String? propertyName;
  final String? phone;
  final String? status;

  TenantResult({
    required this.id,
    required this.name,
    this.unitLabel,
    this.propertyName,
    this.phone,
    this.status,
  });

  factory TenantResult.fromJson(Map<String, dynamic> j) => TenantResult(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? j['fullName'] ?? 'Tenant').toString(),
        unitLabel: j['unitLabel'] as String? ?? j['unit'] as String?,
        propertyName: j['propertyName'] as String? ?? j['property'] as String?,
        phone: j['phone'] as String?,
        status: j['status'] as String?,
      );

  String get subtitle {
    final u = (unitLabel == null || unitLabel!.isEmpty) ? '—' : unitLabel!;
    final p = (propertyName == null || propertyName!.isEmpty) ? '' : ' @ $propertyName';
    return '$u$p';
  }
}

/// Aggregate payload returned from the universal search endpoint.
class SearchResults {
  final List<PropertyResult> properties;
  final List<UnitResult> units;
  final List<TenantResult> tenants;

  SearchResults({
    this.properties = const [],
    this.units = const [],
    this.tenants = const [],
  });

  bool get isEmpty =>
      properties.isEmpty && units.isEmpty && tenants.isEmpty;

  int get totalCount => properties.length + units.length + tenants.length;

  factory SearchResults.fromJson(Map<String, dynamic> j) {
    List<T> parseList<T>(String key, T Function(Map<String, dynamic>) f) {
      final raw = j[key];
      if (raw is List) {
        return raw
            .whereType<Map<String, dynamic>>()
            .map(f)
            .toList(growable: false);
      }
      return const [];
    }

    return SearchResults(
      properties: parseList('properties', PropertyResult.fromJson),
      units: parseList('units', UnitResult.fromJson),
      tenants: parseList('tenants', TenantResult.fromJson),
    );
  }

  static final SearchResults empty = SearchResults();
}

/// Repository that performs a universal search across properties/units/tenants
/// for the currently-active org. Uses the shared [ApiClient] which already
/// attaches the bearer + `X-Active-Org` headers.
class SearchRepository {
  final ApiClient _api;

  SearchRepository({ApiClient? api}) : _api = api ?? ApiClient.instance;

  Future<SearchResults> search(String query, String activeOrgId) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return SearchResults.empty;

    final resp = await _api.get<Map<String, dynamic>>(
      '/search',
      queryParams: {
        'q': trimmed,
        if (activeOrgId.isNotEmpty) 'orgId': activeOrgId,
      },
    );

    if (!resp.isOk || resp.data == null) {
      return SearchResults.empty;
    }
    return SearchResults.fromJson(resp.data!);
  }
}
