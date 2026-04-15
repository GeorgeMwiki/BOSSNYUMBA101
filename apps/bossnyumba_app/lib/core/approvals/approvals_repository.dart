import '../api_client.dart';

/// Approval type mirrors the API contract.
enum ApprovalType {
  vendorInvoice,
  workOrder,
  leaseChange,
  expense,
  other,
}

ApprovalType approvalTypeFromString(String? s) {
  switch ((s ?? '').toUpperCase()) {
    case 'VENDOR_INVOICE':
      return ApprovalType.vendorInvoice;
    case 'WORK_ORDER':
      return ApprovalType.workOrder;
    case 'LEASE_CHANGE':
      return ApprovalType.leaseChange;
    case 'EXPENSE':
      return ApprovalType.expense;
    default:
      return ApprovalType.other;
  }
}

String approvalTypeLabel(ApprovalType t) {
  switch (t) {
    case ApprovalType.vendorInvoice:
      return 'Vendor Invoices';
    case ApprovalType.workOrder:
      return 'Work Orders';
    case ApprovalType.leaseChange:
      return 'Lease Changes';
    case ApprovalType.expense:
      return 'Expenses';
    case ApprovalType.other:
      return 'Other';
  }
}

enum ApprovalStatus { pending, approved, rejected }

ApprovalStatus approvalStatusFromString(String? s) {
  switch ((s ?? '').toUpperCase()) {
    case 'APPROVED':
      return ApprovalStatus.approved;
    case 'REJECTED':
      return ApprovalStatus.rejected;
    default:
      return ApprovalStatus.pending;
  }
}

class ApprovalAuditEntry {
  final DateTime at;
  final String actorId;
  final String action;
  final String? reason;
  final Map<String, dynamic>? context;

  ApprovalAuditEntry({
    required this.at,
    required this.actorId,
    required this.action,
    this.reason,
    this.context,
  });

  factory ApprovalAuditEntry.fromJson(Map<String, dynamic> j) => ApprovalAuditEntry(
        at: DateTime.tryParse(j['at']?.toString() ?? '') ?? DateTime.now(),
        actorId: j['actorId']?.toString() ?? '',
        action: j['action']?.toString() ?? '',
        reason: j['reason']?.toString(),
        context: j['context'] is Map ? Map<String, dynamic>.from(j['context'] as Map) : null,
      );
}

class ApprovalDocument {
  final String id;
  final String name;
  final String url;
  final String? mimeType;
  ApprovalDocument({required this.id, required this.name, required this.url, this.mimeType});
  factory ApprovalDocument.fromJson(Map<String, dynamic> j) => ApprovalDocument(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        url: j['url']?.toString() ?? '',
        mimeType: j['mimeType']?.toString(),
      );
}

class Money {
  final num amount;
  final String currency;
  Money({required this.amount, required this.currency});
  factory Money.fromJson(Map<String, dynamic> j) => Money(
        amount: (j['amount'] as num?) ?? 0,
        currency: j['currency']?.toString() ?? 'KES',
      );
}

class Approval {
  final String id;
  final String orgId;
  final ApprovalType type;
  ApprovalStatus status;
  final String title;
  final String? summary;
  final Money? amount;
  final Money? threshold;
  final String? vendorId;
  final String? vendorName;
  final String? invoiceId;
  final String requestedById;
  final String? requestedByName;
  final Map<String, dynamic> metadata;
  final List<ApprovalDocument> documents;
  final List<ApprovalAuditEntry> audit;
  final DateTime createdAt;
  DateTime updatedAt;
  DateTime? decidedAt;
  String? decidedById;
  String? rejectionReason;

  Approval({
    required this.id,
    required this.orgId,
    required this.type,
    required this.status,
    required this.title,
    required this.requestedById,
    required this.createdAt,
    required this.updatedAt,
    this.summary,
    this.amount,
    this.threshold,
    this.vendorId,
    this.vendorName,
    this.invoiceId,
    this.requestedByName,
    this.metadata = const {},
    this.documents = const [],
    this.audit = const [],
    this.decidedAt,
    this.decidedById,
    this.rejectionReason,
  });

  factory Approval.fromJson(Map<String, dynamic> j) => Approval(
        id: j['id']?.toString() ?? '',
        orgId: j['orgId']?.toString() ?? '',
        type: approvalTypeFromString(j['type']?.toString()),
        status: approvalStatusFromString(j['status']?.toString()),
        title: j['title']?.toString() ?? '',
        summary: j['summary']?.toString(),
        amount: j['amount'] is Map ? Money.fromJson(Map<String, dynamic>.from(j['amount'] as Map)) : null,
        threshold: j['threshold'] is Map ? Money.fromJson(Map<String, dynamic>.from(j['threshold'] as Map)) : null,
        vendorId: j['vendorId']?.toString(),
        vendorName: j['vendorName']?.toString(),
        invoiceId: j['invoiceId']?.toString(),
        requestedById: j['requestedById']?.toString() ?? '',
        requestedByName: j['requestedByName']?.toString(),
        metadata: j['metadata'] is Map ? Map<String, dynamic>.from(j['metadata'] as Map) : {},
        documents: (j['documents'] as List?)
                ?.whereType<Map>()
                .map((e) => ApprovalDocument.fromJson(Map<String, dynamic>.from(e)))
                .toList() ??
            const [],
        audit: (j['audit'] as List?)
                ?.whereType<Map>()
                .map((e) => ApprovalAuditEntry.fromJson(Map<String, dynamic>.from(e)))
                .toList() ??
            const [],
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? '') ?? DateTime.now(),
        updatedAt: DateTime.tryParse(j['updatedAt']?.toString() ?? '') ?? DateTime.now(),
        decidedAt: j['decidedAt'] != null ? DateTime.tryParse(j['decidedAt'].toString()) : null,
        decidedById: j['decidedById']?.toString(),
        rejectionReason: j['rejectionReason']?.toString(),
      );
}

class ApprovalsRepository {
  final ApiClient _api;
  ApprovalsRepository({ApiClient? api}) : _api = api ?? ApiClient.instance;

  /// GET /api/v1/approvals?orgId=...
  Future<ApiResponse<List<Approval>>> list({String? orgId, ApprovalStatus? status}) async {
    final qp = <String, String>{};
    if (orgId != null && orgId.isNotEmpty) qp['orgId'] = orgId;
    if (status != null) {
      qp['status'] = status.name.toUpperCase();
    }
    final resp = await _api.get<dynamic>('/approvals', queryParams: qp.isEmpty ? null : qp);
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Failed to load approvals', statusCode: resp.statusCode);
    }
    final data = resp.data;
    final list = data is List
        ? data
        : (data is Map && data['items'] is List)
            ? data['items'] as List
            : <dynamic>[];
    final items = list
        .whereType<Map>()
        .map((e) => Approval.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return ApiResponse.ok(items);
  }

  /// GET /api/v1/approvals/:id
  Future<ApiResponse<Approval>> get(String id) async {
    final resp = await _api.get<dynamic>('/approvals/$id');
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Not found', statusCode: resp.statusCode);
    }
    final data = resp.data;
    if (data is! Map) {
      return ApiResponse.error('Invalid payload');
    }
    return ApiResponse.ok(Approval.fromJson(Map<String, dynamic>.from(data)));
  }

  /// POST /api/v1/approvals/:id/approve
  Future<ApiResponse<Approval>> approve(String id) async {
    final resp = await _api.post<dynamic>('/approvals/$id/approve');
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Approve failed', statusCode: resp.statusCode);
    }
    final data = resp.data;
    if (data is! Map) {
      return ApiResponse.error('Invalid payload');
    }
    return ApiResponse.ok(Approval.fromJson(Map<String, dynamic>.from(data)));
  }

  /// POST /api/v1/approvals/:id/reject
  Future<ApiResponse<Approval>> reject(String id, String reason) async {
    final resp = await _api.post<dynamic>('/approvals/$id/reject', body: {'reason': reason});
    if (!resp.isOk) {
      return ApiResponse.error(resp.error ?? 'Reject failed', statusCode: resp.statusCode);
    }
    final data = resp.data;
    if (data is! Map) {
      return ApiResponse.error('Invalid payload');
    }
    return ApiResponse.ok(Approval.fromJson(Map<String, dynamic>.from(data)));
  }
}

/// Biometric gate. Kept as a service hook so concrete biometric integrations
/// (local_auth, platform channels) can plug in later without touching the
/// approval screens. Defaults to allow so the flow works end-to-end in
/// environments without biometric capability.
class BiometricGate {
  static Future<bool> Function(String reason)? prompt;

  static Future<bool> authenticate(String reason) async {
    final p = prompt;
    if (p == null) return true;
    try {
      return await p(reason);
    } catch (_) {
      return false;
    }
  }
}
