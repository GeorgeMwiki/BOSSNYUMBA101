import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

class ApiClient {
  static ApiClient? _instance;
  static ApiClient get instance => _instance ??= ApiClient();

  String? _token;
  final String baseUrl = ApiConfig.baseUrl;

  ApiClient() {
    _instance ??= this;
  }

  void setToken(String? token) => _token = token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    final uri = Uri.parse('$baseUrl$path')
        .replace(queryParameters: queryParams);
    try {
      final resp = await http
          .get(uri, headers: _headers)
          .timeout(Duration(seconds: ApiConfig.timeoutSeconds));
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
          .timeout(Duration(seconds: ApiConfig.timeoutSeconds));
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
          .timeout(Duration(seconds: ApiConfig.timeoutSeconds));
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
