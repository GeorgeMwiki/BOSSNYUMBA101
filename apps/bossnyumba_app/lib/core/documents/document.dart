/// Canonical document types the app renders. The backend may return types
/// outside this enum (new categories, experiments) — unknown values fall
/// through to [DocumentType.other] so the UI never crashes on an unexpected
/// payload.
enum DocumentType {
  lease,
  contract,
  invoice,
  notice,
  other,
}

DocumentType documentTypeFromString(String? raw) {
  if (raw == null) return DocumentType.other;
  switch (raw.toLowerCase()) {
    case 'lease':
    case 'lease_agreement':
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

String documentTypeToString(DocumentType type) {
  switch (type) {
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

/// Lifecycle status of a signable document. Anything we don't recognise is
/// coerced to [DocumentStatus.draft] so the UI treats it as read-only by
/// default (safer fallback — the user can't accidentally sign something we
/// don't understand).
enum DocumentStatus {
  draft,
  pendingSignature,
  signed,
  declined,
  expired,
}

DocumentStatus documentStatusFromString(String? raw) {
  if (raw == null) return DocumentStatus.draft;
  switch (raw.toLowerCase()) {
    case 'pending_signature':
    case 'pending':
    case 'awaiting_signature':
      return DocumentStatus.pendingSignature;
    case 'signed':
    case 'completed':
      return DocumentStatus.signed;
    case 'declined':
    case 'rejected':
      return DocumentStatus.declined;
    case 'expired':
      return DocumentStatus.expired;
    case 'draft':
    default:
      return DocumentStatus.draft;
  }
}

String documentStatusToString(DocumentStatus status) {
  switch (status) {
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

/// Value object representing a single document record from the document
/// intelligence service, shaped for the mobile viewer.
///
/// Kept deliberately dumb — no async, no I/O — so it round-trips cleanly
/// through `shared_preferences` for the offline cache and is trivial to mint
/// in tests.
class Document {
  final String id;
  final String title;
  final DocumentType type;
  final DocumentStatus status;
  final DateTime createdAt;
  final DateTime? expiresAt;

  /// True if the current user is authorised to sign this document *and* the
  /// document is in a signable state. Backend supplies this flag — we don't
  /// try to re-derive it on the client.
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

  /// True if the bottom action bar in the viewer should be shown.
  /// Keeps the read-only / action-bar logic in one place so screens and
  /// tests can ask the same question.
  bool get showActionBar =>
      signableByMe && status == DocumentStatus.pendingSignature;

  factory Document.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic v) {
      if (v is String && v.isNotEmpty) {
        return DateTime.tryParse(v)?.toLocal() ?? DateTime.now();
      }
      return DateTime.now();
    }

    DateTime? parseDateOrNull(dynamic v) {
      if (v is String && v.isNotEmpty) {
        return DateTime.tryParse(v)?.toLocal();
      }
      return null;
    }

    return Document(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['name'] ?? 'Untitled').toString(),
      type: documentTypeFromString(
        (json['type'] ?? json['documentType'])?.toString(),
      ),
      status: documentStatusFromString(json['status']?.toString()),
      createdAt: parseDate(json['createdAt'] ?? json['created_at']),
      expiresAt: parseDateOrNull(json['expiresAt'] ?? json['expires_at']),
      signableByMe: (json['signableByMe'] as bool?) ??
          (json['canSign'] as bool?) ??
          false,
      downloadUrl:
          (json['downloadUrl'] ?? json['url'] ?? json['fileUrl'] ?? '')
              .toString(),
      fileSize: (json['fileSize'] is num)
          ? (json['fileSize'] as num).toInt()
          : int.tryParse(json['fileSize']?.toString() ?? '') ?? 0,
      mimeType:
          (json['mimeType'] ?? json['contentType'] ?? 'application/pdf')
              .toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'type': documentTypeToString(type),
        'status': documentStatusToString(status),
        'createdAt': createdAt.toUtc().toIso8601String(),
        if (expiresAt != null) 'expiresAt': expiresAt!.toUtc().toIso8601String(),
        'signableByMe': signableByMe,
        'downloadUrl': downloadUrl,
        'fileSize': fileSize,
        'mimeType': mimeType,
      };

  Document copyWith({
    String? id,
    String? title,
    DocumentType? type,
    DocumentStatus? status,
    DateTime? createdAt,
    DateTime? expiresAt,
    bool? signableByMe,
    String? downloadUrl,
    int? fileSize,
    String? mimeType,
  }) {
    return Document(
      id: id ?? this.id,
      title: title ?? this.title,
      type: type ?? this.type,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      signableByMe: signableByMe ?? this.signableByMe,
      downloadUrl: downloadUrl ?? this.downloadUrl,
      fileSize: fileSize ?? this.fileSize,
      mimeType: mimeType ?? this.mimeType,
    );
  }
}
