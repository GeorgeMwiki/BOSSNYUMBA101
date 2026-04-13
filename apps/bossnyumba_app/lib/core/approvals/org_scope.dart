// Lightweight bridge to the active-org concept.
//
// The monorepo is evolving towards a central `OrgProvider`. Until that
// provider lands (a parallel agent owns it), this file offers a minimal
// ChangeNotifier with the same shape so the approvals screen can depend
// on it today without blocking on cross-agent coordination.
//
// When the real provider ships, callers can delete this file and import
// the central one; the public surface (`activeOrgId`, `setActiveOrgId`,
// `ChangeNotifier` semantics) is intentionally identical.

import 'package:flutter/foundation.dart';

class OrgProvider extends ChangeNotifier {
  String? _activeOrgId;

  OrgProvider({String? initialOrgId}) : _activeOrgId = initialOrgId;

  String? get activeOrgId => _activeOrgId;

  void setActiveOrgId(String? id) {
    if (_activeOrgId == id) return;
    _activeOrgId = id;
    notifyListeners();
  }
}
