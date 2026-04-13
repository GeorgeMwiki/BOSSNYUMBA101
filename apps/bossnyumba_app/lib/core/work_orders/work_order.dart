/// Data model for a maintenance work order created via the owner quick-report
/// flow. Mirrors the shape returned by `POST /api/v1/work-orders`.
class WorkOrder {
  final String id;
  final String propertyId;
  final String? unitId;
  final String category;
  final String priority;
  final String? description;
  final List<String> photoUrls;
  final String? voiceNoteUrl;
  final String status;
  final DateTime createdAt;
  final String? createdBy;
  final Map<String, dynamic>? metadata;

  const WorkOrder({
    required this.id,
    required this.propertyId,
    this.unitId,
    required this.category,
    required this.priority,
    this.description,
    this.photoUrls = const [],
    this.voiceNoteUrl,
    required this.status,
    required this.createdAt,
    this.createdBy,
    this.metadata,
  });

  factory WorkOrder.fromJson(Map<String, dynamic> json) {
    return WorkOrder(
      id: (json['id'] ?? '').toString(),
      propertyId: (json['propertyId'] ?? json['property_id'] ?? '').toString(),
      unitId: (json['unitId'] ?? json['unit_id']) as String?,
      category: (json['category'] ?? 'OTHER').toString(),
      priority: (json['priority'] ?? 'MEDIUM').toString(),
      description: json['description'] as String?,
      photoUrls: (json['photoUrls'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          (json['photo_urls'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      voiceNoteUrl:
          (json['voiceNoteUrl'] ?? json['voice_note_url']) as String?,
      status: (json['status'] ?? 'PENDING').toString(),
      createdAt: DateTime.tryParse(
              (json['createdAt'] ?? json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      createdBy: (json['createdBy'] ?? json['created_by']) as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'propertyId': propertyId,
        if (unitId != null) 'unitId': unitId,
        'category': category,
        'priority': priority,
        if (description != null) 'description': description,
        'photoUrls': photoUrls,
        if (voiceNoteUrl != null) 'voiceNoteUrl': voiceNoteUrl,
        'status': status,
        'createdAt': createdAt.toIso8601String(),
        if (createdBy != null) 'createdBy': createdBy,
        if (metadata != null) 'metadata': metadata,
      };

  /// Friendly display label for the work-order status.
  String get statusLabel {
    switch (status.toUpperCase()) {
      case 'PENDING':
      case 'NEW':
        return 'Pending';
      case 'ASSIGNED':
        return 'Assigned';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'DONE':
      case 'COMPLETED':
      case 'RESOLVED':
        return 'Done';
      default:
        return status;
    }
  }
}

/// Canonical list of report categories surfaced in the quick-report flow.
class WorkOrderCategory {
  static const plumbing = 'PLUMBING';
  static const electrical = 'ELECTRICAL';
  static const structural = 'STRUCTURAL';
  static const cleaning = 'CLEANING';
  static const security = 'SECURITY';
  static const other = 'OTHER';

  static const all = <String>[
    plumbing,
    electrical,
    structural,
    cleaning,
    security,
    other,
  ];

  static String label(String c) {
    switch (c) {
      case plumbing:
        return 'Plumbing';
      case electrical:
        return 'Electrical';
      case structural:
        return 'Structural';
      case cleaning:
        return 'Cleaning';
      case security:
        return 'Security';
      default:
        return 'Other';
    }
  }
}

/// Priority buckets, ordered low to high.
class WorkOrderPriority {
  static const low = 'LOW';
  static const medium = 'MEDIUM';
  static const high = 'HIGH';
  static const critical = 'CRITICAL';

  static const all = <String>[low, medium, high, critical];

  static String label(String p) {
    switch (p) {
      case low:
        return 'Low';
      case medium:
        return 'Medium';
      case high:
        return 'High';
      case critical:
        return 'Critical';
      default:
        return p;
    }
  }
}
