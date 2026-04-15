import '../api_client.dart';

class WorkOrdersService {
  final ApiClient _api = ApiClient.instance;

  Future<ApiResponse<List<dynamic>>> listMine() async {
    final resp = await _api.get<Map<String, dynamic>>('/work-orders');
    if (!resp.isOk) return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
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
    String priority = 'MEDIUM',
    String? category,
  }) async {
    return _api.post<Map<String, dynamic>>('/work-orders', body: {
      'title': title,
      'description': description,
      'priority': priority,
      if (category != null && category.isNotEmpty) 'category': category,
    });
  }
}
