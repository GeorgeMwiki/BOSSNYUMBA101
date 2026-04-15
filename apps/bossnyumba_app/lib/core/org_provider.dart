import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'auth_provider.dart';

/// Tracks the set of organizations the current user belongs to and which one
/// is currently active. Works alongside [AuthProvider]: when the auth state
/// becomes authenticated, callers should invoke [setAvailableOrgs] with the
/// user's memberships.
class OrgProvider extends ChangeNotifier {
  static const _kActiveOrgKey = 'bossnyumba:active_org_id';

  List<Membership> _orgs = const [];
  String? _activeOrgId;

  List<Membership> get orgs => _orgs;
  String? get activeOrgId => _activeOrgId;

  Membership? get activeOrg {
    if (_activeOrgId == null) return null;
    for (final o in _orgs) {
      if (o.orgId == _activeOrgId) return o;
    }
    return null;
  }

  bool get hasMultipleOrgs => _orgs.length > 1;

  Future<void> setAvailableOrgs(List<Membership> memberships) async {
    _orgs = List.unmodifiable(memberships);
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_kActiveOrgKey);
    if (stored != null && memberships.any((m) => m.orgId == stored)) {
      _activeOrgId = stored;
    } else if (memberships.isNotEmpty) {
      _activeOrgId = memberships.first.orgId;
      await prefs.setString(_kActiveOrgKey, _activeOrgId!);
    } else {
      _activeOrgId = null;
      await prefs.remove(_kActiveOrgKey);
    }
    notifyListeners();
  }

  Future<void> setActiveOrg(String orgId) async {
    if (!_orgs.any((m) => m.orgId == orgId)) return;
    _activeOrgId = orgId;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kActiveOrgKey, orgId);
    notifyListeners();
  }

  Future<void> clear() async {
    _orgs = const [];
    _activeOrgId = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kActiveOrgKey);
    notifyListeners();
  }
}
