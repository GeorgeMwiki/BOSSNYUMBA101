import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

/// Signature for a callback that returns the current access token, or null.
typedef TokenProvider = String? Function();

class ApiClient {
  static ApiClient? _instance;
  static ApiClient get instance => _instance ??= ApiClient();

  /// Legacy single-token slot — kept so callers that still use `setToken`
  /// don't break, but [tokenProvider] wins when set.
  String? _token;
  String? _activeOrgId;
  final String baseUrl = ApiConfig.baseUrl;

  /// Integration point for the multi-tenant org switcher.
  ///
  /// `OrgProvider` sets this getter on construction so every request can
  /// pick up the currently active tenant id without introducing a hard
  /// import dependency on the provider package here. This keeps the
  /// bearer-token interceptor (parallel agent) and the tenant header
  /// concerns cleanly separated.
  String? Function()? activeOrgIdProvider;

  ApiClient() {
    _instance ??= this;
  }

  void setToken(String? token) => _token = token;

  /// Sets the active organization id to be sent as `X-Active-Org` on every
  /// subsequent request. Pass `null` to clear (e.g. on logout).
  void setActiveOrg(String? tenantId) => _activeOrgId = tenantId;

  String? get activeOrg => _activeOrgId;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
        if (_activeOrgId != null) 'X-Active-Org': _activeOrgId!,
      };

  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    var uri = Uri.parse('$baseUrl$path');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }
    try {
      final resp = await http
          .get(uri, headers: _headers)
          .timeout(const Duration(seconds: ApiConfig.timeoutSeconds));
      return _handleResponse<T>(resp);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }

  Future<ApiResponse<T>> post<T>(String path, {Object? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    try {
      final resp = await http
          .post(
            uri,
            headers: _headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: ApiConfig.timeoutSeconds));
      return _handleResponse<T>(resp);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }

  Future<ApiResponse<T>> patch<T>(String path, {Object? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    try {
      final resp = await http
          .patch(
            uri,
            headers: _headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: ApiConfig.timeoutSeconds));
      return _handleResponse<T>(resp);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }

  ApiResponse<T> _handleResponse<T>(http.Response resp) {
    dynamic json;
    try {
      json = resp.body.isEmpty ? null : jsonDecode(resp.body);
    } catch (_) {
      return ApiResponse.error('Invalid JSON response', statusCode: resp.statusCode);
    }
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      if (json is Map && json['data'] != null) {
        return ApiResponse.ok(json['data'] as T);
      }
      return ApiResponse.ok(json as T);
    }
    final msg = json is Map && json['error'] != null
        ? (json['error']['message'] ?? resp.reasonPhrase ?? 'Unknown error')
        : resp.reasonPhrase ?? 'Unknown error';
    return ApiResponse.error(msg, statusCode: resp.statusCode);
  }
}

class ApiResponse<T> {
  final T? data;
  final String? error;
  final int? statusCode;

  ApiResponse._({this.data, this.error, this.statusCode});

  factory ApiResponse.ok(T data) =>
      ApiResponse._(data: data, statusCode: 200);

  factory ApiResponse.error(String msg, {int? statusCode}) =>
      ApiResponse._(error: msg, statusCode: statusCode);

  bool get isOk => error == null;
}
