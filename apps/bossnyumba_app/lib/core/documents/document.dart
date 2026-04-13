/// Document model for the Owner documents inbox + viewer feature.
///
/// A [Document] represents a file attached to an owner's organisation that
/// can be inspected (leases, contracts, invoices, notices, etc.) and — if
/// flagged as signable — signed on the go from the mobile app.
library;

enum DocumentType {
  lease,
  contract,
  invoice,
  notice,
  other,
}

extension DocumentTypeExt on DocumentType {
  String get wireValue {
    switch (this) {
      case DocumentType.lease:
        return 'lease';
      case DocumentType.contract:
        return 'contract';
      case DocumentType.invoice:
        return 'invoice';
      case DocumentType.notice:
        return 'notice';
      case DocumentType.other:
        return 'other';
    }
  }

  String get label {
    switch (this) {
      case DocumentType.lease:
        return 'Lease';
      case DocumentType.contract:
        return 'Contract';
      case DocumentType.invoice:
        return 'Invoice';
      case DocumentType.notice:
        return 'Notice';
      case DocumentType.other:
        return 'Other';
    }
  }
}

DocumentType documentTypeFromString(String? value) {
  switch ((value ?? '').toLowerCase()) {
    case 'lease':
      return DocumentType.lease;
    case 'contract':
      return DocumentType.contract;
    case 'invoice':
      return DocumentType.invoice;
    case 'notice':
      return DocumentType.notice;
    default:
      return DocumentType.other;
  }
}

enum DocumentStatus {
  draft,
  pendingSignature,
  signed,
  declined,
  expired,
}

extension DocumentStatusExt on DocumentStatus {
  String get wireValue {
    switch (this) {
      case DocumentStatus.draft:
        return 'draft';
      case DocumentStatus.pendingSignature:
        return 'pending_signature';
      case DocumentStatus.signed:
        return 'signed';
      case DocumentStatus.declined:
        return 'declined';
      case DocumentStatus.expired:
        return 'expired';
    }
  }

  String get label {
    switch (this) {
      case DocumentStatus.draft:
        return 'Draft';
      case DocumentStatus.pendingSignature:
        return 'Pending signature';
      case DocumentStatus.signed:
        return 'Signed';
      case DocumentStatus.declined:
        return 'Declined';
      case DocumentStatus.expired:
        return 'Expired';
    }
  }

  bool get isTerminal =>
      this == DocumentStatus.signed ||
      this == DocumentStatus.declined ||
      this == DocumentStatus.expired;
}

DocumentStatus documentStatusFromString(String? value) {
  switch ((value ?? '').toLowerCase()) {
    case 'draft':
      return DocumentStatus.draft;
    case 'pending_signature':
    case 'pending':
      return DocumentStatus.pendingSignature;
    case 'signed':
    case 'completed':
      return DocumentStatus.signed;
    case 'declined':
    case 'rejected':
      return DocumentStatus.declined;
    case 'expired':
      return DocumentStatus.expired;
    default:
      return DocumentStatus.draft;
  }
}

class Document {
  final String id;
  final String title;
  final DocumentType type;
  final DocumentStatus status;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final bool signableByMe;
  final String downloadUrl;
  final int fileSize;
  final String mimeType;

  const Document({
    required this.id,
    required this.title,
    required this.type,
    required this.status,
    required this.createdAt,
    this.expiresAt,
    required this.signableByMe,
    required this.downloadUrl,
    required this.fileSize,
    required this.mimeType,
  });

  /// Whether the document currently offers a sign/decline CTA to the owner.
  bool get isActionable =>
      signableByMe && status == DocumentStatus.pendingSignature;

  factory Document.fromJson(Map<String, dynamic> json) {
    return Document(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: (json['title'] ?? json['name'] ?? 'Untitled document').toString(),
      type: documentTypeFromString(json['type'] as String?),
      status: documentStatusFromString(json['status'] as String?),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      expiresAt: _parseDate(json['expiresAt']),
      signableByMe: json['signableByMe'] == true,
      downloadUrl: (json['downloadUrl'] ?? json['url'] ?? '').toString(),
      fileSize: _parseInt(json['fileSize']) ?? 0,
      mimeType: (json['mimeType'] ?? 'application/pdf').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'type': type.wireValue,
        'status': status.wireValue,
        'createdAt': createdAt.toIso8601String(),
        if (expiresAt != null) 'expiresAt': expiresAt!.toIso8601String(),
        'signableByMe': signableByMe,
        'downloadUrl': downloadUrl,
        'fileSize': fileSize,
        'mimeType': mimeType,
      };

  Document copyWith({
    DocumentStatus? status,
    bool? signableByMe,
  }) =>
      Document(
        id: id,
        title: title,
        type: type,
        status: status ?? this.status,
        createdAt: createdAt,
        expiresAt: expiresAt,
        signableByMe: signableByMe ?? this.signableByMe,
        downloadUrl: downloadUrl,
        fileSize: fileSize,
        mimeType: mimeType,
      );
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  final s = value.toString();
  return DateTime.tryParse(s);
}

int? _parseInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}
