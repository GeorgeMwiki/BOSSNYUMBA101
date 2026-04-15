import '../api_client.dart';

class WorkOrdersService {
  final ApiClient _api = ApiClient.instance;

  Future<ApiResponse<List<dynamic>>> listMine() async {
    final resp = await _api.get<Map<String, dynamic>>('/work-orders');
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    }
    final data = resp.data;
    if (data is Map && data['items'] != null) {
      return ApiResponse.ok(List<dynamic>.from(data['items'] as List));
    }
    if (data is List) return ApiResponse.ok(data);
    return ApiResponse.ok([]);
  }

  Future<ApiResponse<Map<String, dynamic>>> create({
    required String title,
    required String description,
    required String category,
    required String priority,
    String? propertyId,
    String? unitId,
    String? location,
    bool requiresEntry = false,
    String? entryInstructions,
  }) async {
    final body = <String, dynamic>{
      'title': title,
      'description': description,
      'category': category,
      'priority': priority,
      if (propertyId != null) 'propertyId': propertyId,
      if (unitId != null) 'unitId': unitId,
      if (location != null) 'location': location,
      'requiresEntry': requiresEntry,
      if (entryInstructions != null) 'entryInstructions': entryInstructions,
    };
    final resp = await _api.post<Map<String, dynamic>>('/work-orders', body: body);
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Failed to create request',
          statusCode: resp.statusCode);
    }
    final data = resp.data ?? <String, dynamic>{};
    return ApiResponse.ok(data);
  }

  Future<ApiResponse<Map<String, dynamic>>> get(String id) async {
    final resp = await _api.get<Map<String, dynamic>>('/work-orders/$id');
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    }
    return ApiResponse.ok(resp.data ?? <String, dynamic>{});
  }
}
