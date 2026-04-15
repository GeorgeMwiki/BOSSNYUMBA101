import 'dart:convert';
import 'package:http/http.dart' as http;

import '../api_client.dart';
import '../api_config.dart';

class WorkOrdersService {
  final ApiClient _api = ApiClient.instance;

  /// List work orders visible to the current user. Managers see the full
  /// queue; technicians see only work orders assigned to them.
  Future<ApiResponse<List<dynamic>>> listMine() async {
    final resp = await _api.get<dynamic>('/work-orders/my-tasks');
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    }
    final data = resp.data;
    if (data is List) return ApiResponse.ok(data);
    if (data is Map && data['items'] != null) {
      return ApiResponse.ok(List<dynamic>.from(data['items'] as List));
    }
    if (data is Map && data['data'] != null && data['data'] is List) {
      return ApiResponse.ok(List<dynamic>.from(data['data'] as List));
    }
    return ApiResponse.ok([]);
  }

  Future<ApiResponse<Map<String, dynamic>>> getById(String id) async {
    final resp = await _api.get<dynamic>('/work-orders/$id');
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    }
    return ApiResponse.ok(Map<String, dynamic>.from(resp.data as Map));
  }

  Future<ApiResponse<Map<String, dynamic>>> assign(
    String id, {
    String? vendorId,
    String? assignedToUserId,
    String? notes,
  }) {
    return _postJson('/work-orders/$id/assign', {
      if (vendorId != null) 'vendorId': vendorId,
      if (assignedToUserId != null) 'assignedToUserId': assignedToUserId,
      if (notes != null) 'notes': notes,
    });
  }

  Future<ApiResponse<Map<String, dynamic>>> start(String id, {String? notes}) {
    return _postJson('/work-orders/$id/start', {if (notes != null) 'notes': notes});
  }

  /// Complete a work order with a JSON payload (no files).
  Future<ApiResponse<Map<String, dynamic>>> complete(
    String id, {
    required String completionNotes,
    List<String> afterPhotoUrls = const [],
    double? actualCostAmount,
    String currency = 'KES',
  }) {
    return _postJson('/work-orders/$id/complete', {
      'completionNotes': completionNotes,
      if (afterPhotoUrls.isNotEmpty) 'afterPhotos': afterPhotoUrls,
      if (actualCostAmount != null)
        'actualCost': {'amount': actualCostAmount, 'currency': currency},
    });
  }

  /// Complete a work order by uploading proof photos via multipart.
  Future<ApiResponse<Map<String, dynamic>>> completeWithProof(
    String id, {
    required String completionNotes,
    required List<http.MultipartFile> photos,
    double? actualCostAmount,
    String currency = 'KES',
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/work-orders/$id/complete');
    final req = http.MultipartRequest('POST', uri);
    req.headers.addAll(_api.authHeaders());
    req.fields['payload'] = jsonEncode({
      'completionNotes': completionNotes,
      if (actualCostAmount != null)
        'actualCost': {'amount': actualCostAmount, 'currency': currency},
    });
    for (final photo in photos) {
      req.files.add(photo);
    }
    try {
      final streamed = await req.send().timeout(Duration(seconds: ApiConfig.timeoutSeconds));
      final resp = await http.Response.fromStream(streamed);
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final decoded = resp.body.isEmpty ? {} : jsonDecode(resp.body);
        final data = (decoded is Map && decoded['data'] != null) ? decoded['data'] : decoded;
        return ApiResponse.ok(Map<String, dynamic>.from(data as Map));
      }
      return ApiResponse.error(resp.reasonPhrase ?? 'Upload failed', statusCode: resp.statusCode);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> _postJson(String path, Map body) async {
    final resp = await _api.post<dynamic>(path, body: body);
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    }
    return ApiResponse.ok(Map<String, dynamic>.from(resp.data as Map));
  }
}
