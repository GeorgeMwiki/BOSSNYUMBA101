// Repository for the Owner approvals queue.
//
// Talks to `/approvals` endpoints on the API. Relies on [ApiClient] for
// the bearer token; the `X-Active-Org` header, if required, is passed as
// a query string until the central client exposes a header override.

import '../api_client.dart';
import 'approval.dart';

/// Thin abstraction so tests can inject a fake client.
abstract class ApprovalsApi {
  Future<ApiResponse<dynamic>> get(String path,
      {Map<String, String>? queryParams});
  Future<ApiResponse<dynamic>> post(String path, {Object? body});
}

class _DefaultApprovalsApi implements ApprovalsApi {
  final ApiClient _api;
  _DefaultApprovalsApi(this._api);

  @override
  Future<ApiResponse<dynamic>> get(String path,
          {Map<String, String>? queryParams}) =>
      _api.get<dynamic>(path, queryParams: queryParams);

  @override
  Future<ApiResponse<dynamic>> post(String path, {Object? body}) =>
      _api.post<dynamic>(path, body: body);
}

class ApprovalsRepository {
  final ApprovalsApi _api;

  ApprovalsRepository({ApprovalsApi? api})
      : _api = api ?? _DefaultApprovalsApi(ApiClient.instance);

  /// Lists approvals for the active org. [type] is an optional filter
  /// (wire value, see [ApprovalTypeExt.wireValue]).
  Future<List<Approval>> listApprovals({
    String? type,
    required String activeOrgId,
  }) async {
    final params = <String, String>{
      'orgId': activeOrgId,
      if (type != null && type.isNotEmpty) 'type': type,
    };
    final resp = await _api.get('/approvals', queryParams: params);
    if (!resp.isOk) {
      throw ApprovalsException(resp.error ?? 'Failed to load approvals');
    }
    final data = resp.data;
    final List<dynamic> items = data is List
        ? data
        : data is Map && data['items'] is List
            ? List<dynamic>.from(data['items'] as List)
            : const [];
    return items
        .whereType<Map>()
        .map((e) => Approval.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Approval> getApproval(String id) async {
    final resp = await _api.get('/approvals/$id');
    if (!resp.isOk) {
      throw ApprovalsException(resp.error ?? 'Failed to load approval');
    }
    final data = resp.data;
    if (data is Map) {
      return Approval.fromJson(Map<String, dynamic>.from(data));
    }
    throw ApprovalsException('Unexpected response shape');
  }

  Future<void> approve(String id, {String? note}) async {
    final resp = await _api.post(
      '/approvals/$id/approve',
      body: {if (note != null && note.isNotEmpty) 'note': note},
    );
    if (!resp.isOk) {
      throw ApprovalsException(resp.error ?? 'Failed to approve');
    }
  }

  Future<void> reject(String id, {required String reason}) async {
    final resp = await _api.post(
      '/approvals/$id/reject',
      body: {'reason': reason},
    );
    if (!resp.isOk) {
      throw ApprovalsException(resp.error ?? 'Failed to reject');
    }
  }
}

class ApprovalsException implements Exception {
  final String message;
  ApprovalsException(this.message);

  @override
  String toString() => message;
}
