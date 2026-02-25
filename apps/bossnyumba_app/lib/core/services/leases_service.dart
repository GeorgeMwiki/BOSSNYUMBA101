import '../api_client.dart';

class LeasesService {
  final ApiClient _api = ApiClient.instance;

  Future<ApiResponse<List<dynamic>>> listMine() async {
    final resp = await _api.get<Map<String, dynamic>>('/leases');
    if (!resp.isOk) return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    final data = resp.data;
    if (data is Map && data['items'] != null) return ApiResponse.ok(List<dynamic>.from(data['items'] as List));
    if (data is Map && data['leases'] != null) return ApiResponse.ok(List<dynamic>.from(data['leases'] as List));
    if (data is List) return ApiResponse.ok(data);
    return ApiResponse.ok([]);
  }
}
