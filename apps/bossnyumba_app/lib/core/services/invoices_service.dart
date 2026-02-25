import '../api_client.dart';

class InvoicesService {
  final ApiClient _api = ApiClient.instance;

  Future<ApiResponse<List<dynamic>>> listMine() async {
    // Try BFF route first, then fallback to direct API
    var resp = await _api.get<Map<String, dynamic>>('/bff/customer-app/payments/invoices');
    if (!resp.isOk) {
      resp = await _api.get<Map<String, dynamic>>('/invoices');
    }
    if (!resp.isOk) return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    final data = resp.data;
    if (data is Map && data['items'] != null) return ApiResponse.ok(List<dynamic>.from(data['items'] as List));
    if (data is Map && data['invoices'] != null) return ApiResponse.ok(List<dynamic>.from(data['invoices'] as List));
    if (data is List) return ApiResponse.ok(data);
    return ApiResponse.ok([]);
  }
}
