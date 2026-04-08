import 'package:flutter/foundation.dart';
import 'api_client.dart';

/// Lightweight tenant/org model used by the org switcher.
///
/// This mirrors the shape the parallel auth agent is expected to expose on
/// `AuthProvider.availableOrgs`. Keeping it standalone means the org switcher
/// can work even before that integration lands.
class Org {
  final String id;
  final String name;
  final String? slug;

  const Org({required this.id, required this.name, this.slug});

  factory Org.fromJson(Map<String, dynamic> json) => Org(
        id: (json['id'] ?? json['tenantId'] ?? '').toString(),
        name: (json['name'] ?? json['tenantName'] ?? json['slug'] ?? 'Unknown')
            .toString(),
        slug: json['slug'] as String?,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is Org && other.id == id;

  @override
  int get hashCode => id.hashCode;
}

/// Holds the list of tenants a user can switch between plus the currently
/// active one. `ApiClient` reads [activeOrgId] via a provided getter so every
/// request gets a consistent `X-Active-Org` header.
class OrgProvider extends ChangeNotifier {
  final ApiClient _api;
  List<Org> _availableOrgs = const [];
  String? _activeOrgId;
  bool _loading = false;
  String? _error;

  OrgProvider({required ApiClient api}) : _api = api {
    // Wire api client -> this provider so every request gets the header.
    _api.activeOrgIdProvider = () => _activeOrgId;
  }

  List<Org> get availableOrgs => _availableOrgs;
  String? get activeOrgId => _activeOrgId;
  bool get loading => _loading;
  String? get error => _error;

  Org? get activeOrg {
    if (_activeOrgId == null) return null;
    for (final o in _availableOrgs) {
      if (o.id == _activeOrgId) return o;
    }
    return null;
  }

  /// Seed the list of available orgs (e.g. from the `/auth/me` payload once
  /// the parallel auth agent extends it). Also picks a sane default active id.
  void setAvailableOrgs(List<Org> orgs, {String? preferredActiveId}) {
    _availableOrgs = List.unmodifiable(orgs);
    if (preferredActiveId != null &&
        orgs.any((o) => o.id == preferredActiveId)) {
      _activeOrgId = preferredActiveId;
    } else if (_activeOrgId == null && orgs.isNotEmpty) {
      _activeOrgId = orgs.first.id;
    } else if (_activeOrgId != null &&
        !orgs.any((o) => o.id == _activeOrgId)) {
      _activeOrgId = orgs.isNotEmpty ? orgs.first.id : null;
    }
    notifyListeners();
  }

  /// Switches the active tenant. Subsequent API calls will include the new id
  /// in the `X-Active-Org` header.
  void setActiveOrg(String orgId) {
    if (_activeOrgId == orgId) return;
    _activeOrgId = orgId;
    notifyListeners();
  }

  /// Fetches the current user's orgs from the backend. Called on bootstrap
  /// or whenever the active session changes.
  Future<void> loadOrgs() async {
    _loading = true;
    _error = null;
    notifyListeners();
    final resp = await _api.get<dynamic>('/tenants/me');
    if (resp.isOk) {
      final data = resp.data;
      final List<dynamic> list = data is List
          ? data
          : (data is Map && data['items'] is List
              ? data['items'] as List<dynamic>
              : const []);
      final parsed = list
          .whereType<Map<String, dynamic>>()
          .map(Org.fromJson)
          .toList();
      setAvailableOrgs(parsed);
    } else {
      _error = resp.error;
    }
    _loading = false;
    notifyListeners();
  }

  void clear() {
    _availableOrgs = const [];
    _activeOrgId = null;
    _error = null;
    notifyListeners();
  }
}
