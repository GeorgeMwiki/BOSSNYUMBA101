// Model classes for the Owner approvals queue.
//
// Uses a Dart 3 sealed class for the discriminated union across the four
// approval types (vendor invoice, work order, lease renewal, deposit
// refund). Factory [Approval.fromJson] switches on the `type` field.

import 'package:flutter/material.dart';

enum ApprovalType {
  vendorInvoice,
  workOrder,
  lease,
  refund,
  unknown,
}

extension ApprovalTypeExt on ApprovalType {
  String get wireValue {
    switch (this) {
      case ApprovalType.vendorInvoice:
        return 'vendor_invoice';
      case ApprovalType.workOrder:
        return 'work_order';
      case ApprovalType.lease:
        return 'lease';
      case ApprovalType.refund:
        return 'refund';
      case ApprovalType.unknown:
        return 'unknown';
    }
  }

  String get label {
    switch (this) {
      case ApprovalType.vendorInvoice:
        return 'Vendor invoices';
      case ApprovalType.workOrder:
        return 'Work orders';
      case ApprovalType.lease:
        return 'Leases';
      case ApprovalType.refund:
        return 'Refunds';
      case ApprovalType.unknown:
        return 'Other';
    }
  }

  IconData get icon {
    switch (this) {
      case ApprovalType.vendorInvoice:
        return Icons.receipt_long;
      case ApprovalType.workOrder:
        return Icons.build;
      case ApprovalType.lease:
        return Icons.description;
      case ApprovalType.refund:
        return Icons.currency_exchange;
      case ApprovalType.unknown:
        return Icons.help_outline;
    }
  }
}

ApprovalType approvalTypeFromString(String? raw) {
  switch ((raw ?? '').toLowerCase()) {
    case 'vendor_invoice':
    case 'vendorinvoice':
    case 'invoice':
      return ApprovalType.vendorInvoice;
    case 'work_order':
    case 'workorder':
    case 'wo':
      return ApprovalType.workOrder;
    case 'lease':
    case 'lease_renewal':
      return ApprovalType.lease;
    case 'refund':
    case 'deposit_refund':
      return ApprovalType.refund;
    default:
      return ApprovalType.unknown;
  }
}

/// Base class for the discriminated union.
sealed class Approval {
  final String id;
  final String title;
  final String subtitle;
  final double amount;
  final String currency;
  final DateTime requestedAt;
  final String requestedBy;
  final String? reason;
  final List<ApprovalDocument> documents;
  final Map<String, dynamic> raw;

  const Approval({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.currency,
    required this.requestedAt,
    required this.requestedBy,
    this.reason,
    this.documents = const [],
    this.raw = const {},
  });

  ApprovalType get type;

  factory Approval.fromJson(Map<String, dynamic> json) {
    final t = approvalTypeFromString(json['type'] as String?);
    final id = (json['id'] ?? json['_id'] ?? '').toString();
    final title = (json['title'] ?? json['name'] ?? '').toString();
    final subtitle = (json['subtitle'] ?? json['description'] ?? '').toString();
    final amount = _parseDouble(json['amount']);
    final currency = (json['currency'] as String?) ?? 'KES';
    final requestedAt = _parseDate(json['requestedAt'] ?? json['createdAt']);
    final requestedBy =
        (json['requestedBy'] ?? json['requester'] ?? '').toString();
    final reason = json['reason'] as String?;
    final docs = (json['documents'] as List<dynamic>?)
            ?.map((e) => ApprovalDocument.fromJson(
                Map<String, dynamic>.from(e as Map)))
            .toList() ??
        const [];

    switch (t) {
      case ApprovalType.vendorInvoice:
        return VendorInvoiceApproval(
          id: id,
          title: title,
          subtitle: subtitle,
          amount: amount,
          currency: currency,
          requestedAt: requestedAt,
          requestedBy: requestedBy,
          reason: reason,
          documents: docs,
          raw: json,
          vendorName: (json['vendorName'] as String?) ?? subtitle,
          lineItems: (json['lineItems'] as List<dynamic>?)
                  ?.map((e) => InvoiceLineItem.fromJson(
                      Map<String, dynamic>.from(e as Map)))
                  .toList() ??
              const [],
          subtotal: _parseDouble(json['subtotal']),
          tax: _parseDouble(json['tax']),
        );
      case ApprovalType.workOrder:
        return WorkOrderApproval(
          id: id,
          title: title,
          subtitle: subtitle,
          amount: amount,
          currency: currency,
          requestedAt: requestedAt,
          requestedBy: requestedBy,
          reason: reason,
          documents: docs,
          raw: json,
          unit: json['unit'] as String?,
          photos: (json['photos'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
          bids: (json['bids'] as List<dynamic>?)
                  ?.map((e) =>
                      WorkOrderBid.fromJson(Map<String, dynamic>.from(e as Map)))
                  .toList() ??
              const [],
        );
      case ApprovalType.lease:
        return LeaseApproval(
          id: id,
          title: title,
          subtitle: subtitle,
          amount: amount,
          currency: currency,
          requestedAt: requestedAt,
          requestedBy: requestedBy,
          reason: reason,
          documents: docs,
          raw: json,
          tenantName: json['tenantName'] as String?,
          unit: json['unit'] as String?,
          tenantCreditScore: (json['tenantCreditScore'] as num?)?.toInt(),
          changes: (json['changes'] as List<dynamic>?)
                  ?.map((e) =>
                      LeaseChange.fromJson(Map<String, dynamic>.from(e as Map)))
                  .toList() ??
              const [],
        );
      case ApprovalType.refund:
        return RefundApproval(
          id: id,
          title: title,
          subtitle: subtitle,
          amount: amount,
          currency: currency,
          requestedAt: requestedAt,
          requestedBy: requestedBy,
          reason: reason,
          documents: docs,
          raw: json,
          tenantName: json['tenantName'] as String?,
          unit: json['unit'] as String?,
          depositHeld: _parseDouble(json['depositHeld']),
          deductions: _parseDouble(json['deductions']),
          leaseEndChecklist:
              (json['leaseEndChecklist'] as List<dynamic>?)
                      ?.map((e) => ChecklistItem.fromJson(
                          Map<String, dynamic>.from(e as Map)))
                      .toList() ??
                  const [],
        );
      case ApprovalType.unknown:
        return UnknownApproval(
          id: id,
          title: title,
          subtitle: subtitle,
          amount: amount,
          currency: currency,
          requestedAt: requestedAt,
          requestedBy: requestedBy,
          reason: reason,
          documents: docs,
          raw: json,
        );
    }
  }
}

class VendorInvoiceApproval extends Approval {
  final String vendorName;
  final List<InvoiceLineItem> lineItems;
  final double subtotal;
  final double tax;

  const VendorInvoiceApproval({
    required super.id,
    required super.title,
    required super.subtitle,
    required super.amount,
    required super.currency,
    required super.requestedAt,
    required super.requestedBy,
    super.reason,
    super.documents,
    super.raw,
    required this.vendorName,
    required this.lineItems,
    required this.subtotal,
    required this.tax,
  });

  @override
  ApprovalType get type => ApprovalType.vendorInvoice;
}

class WorkOrderApproval extends Approval {
  final String? unit;
  final List<String> photos;
  final List<WorkOrderBid> bids;

  const WorkOrderApproval({
    required super.id,
    required super.title,
    required super.subtitle,
    required super.amount,
    required super.currency,
    required super.requestedAt,
    required super.requestedBy,
    super.reason,
    super.documents,
    super.raw,
    this.unit,
    this.photos = const [],
    this.bids = const [],
  });

  @override
  ApprovalType get type => ApprovalType.workOrder;
}

class LeaseApproval extends Approval {
  final String? tenantName;
  final String? unit;
  final int? tenantCreditScore;
  final List<LeaseChange> changes;

  const LeaseApproval({
    required super.id,
    required super.title,
    required super.subtitle,
    required super.amount,
    required super.currency,
    required super.requestedAt,
    required super.requestedBy,
    super.reason,
    super.documents,
    super.raw,
    this.tenantName,
    this.unit,
    this.tenantCreditScore,
    this.changes = const [],
  });

  @override
  ApprovalType get type => ApprovalType.lease;
}

class RefundApproval extends Approval {
  final String? tenantName;
  final String? unit;
  final double depositHeld;
  final double deductions;
  final List<ChecklistItem> leaseEndChecklist;

  const RefundApproval({
    required super.id,
    required super.title,
    required super.subtitle,
    required super.amount,
    required super.currency,
    required super.requestedAt,
    required super.requestedBy,
    super.reason,
    super.documents,
    super.raw,
    this.tenantName,
    this.unit,
    required this.depositHeld,
    required this.deductions,
    this.leaseEndChecklist = const [],
  });

  @override
  ApprovalType get type => ApprovalType.refund;
}

class UnknownApproval extends Approval {
  const UnknownApproval({
    required super.id,
    required super.title,
    required super.subtitle,
    required super.amount,
    required super.currency,
    required super.requestedAt,
    required super.requestedBy,
    super.reason,
    super.documents,
    super.raw,
  });

  @override
  ApprovalType get type => ApprovalType.unknown;
}

class ApprovalDocument {
  final String id;
  final String name;
  final String url;
  final String? mimeType;

  const ApprovalDocument({
    required this.id,
    required this.name,
    required this.url,
    this.mimeType,
  });

  factory ApprovalDocument.fromJson(Map<String, dynamic> json) =>
      ApprovalDocument(
        id: (json['id'] ?? '').toString(),
        name: (json['name'] ?? 'Document').toString(),
        url: (json['url'] ?? '').toString(),
        mimeType: json['mimeType'] as String?,
      );

  bool get isImage => (mimeType ?? '').startsWith('image/');
  bool get isPdf => mimeType == 'application/pdf';
}

class InvoiceLineItem {
  final String description;
  final int quantity;
  final double unitPrice;

  const InvoiceLineItem({
    required this.description,
    required this.quantity,
    required this.unitPrice,
  });

  double get total => quantity * unitPrice;

  factory InvoiceLineItem.fromJson(Map<String, dynamic> json) => InvoiceLineItem(
        description: (json['description'] ?? '').toString(),
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        unitPrice: _parseDouble(json['unitPrice']),
      );
}

class WorkOrderBid {
  final String vendorName;
  final double amount;
  final String? notes;

  const WorkOrderBid({
    required this.vendorName,
    required this.amount,
    this.notes,
  });

  factory WorkOrderBid.fromJson(Map<String, dynamic> json) => WorkOrderBid(
        vendorName: (json['vendorName'] ?? '').toString(),
        amount: _parseDouble(json['amount']),
        notes: json['notes'] as String?,
      );
}

class LeaseChange {
  final String field;
  final String? before;
  final String? after;

  const LeaseChange({
    required this.field,
    this.before,
    this.after,
  });

  factory LeaseChange.fromJson(Map<String, dynamic> json) => LeaseChange(
        field: (json['field'] ?? '').toString(),
        before: json['before']?.toString(),
        after: json['after']?.toString(),
      );
}

class ChecklistItem {
  final String label;
  final bool done;

  const ChecklistItem({required this.label, required this.done});

  factory ChecklistItem.fromJson(Map<String, dynamic> json) => ChecklistItem(
        label: (json['label'] ?? '').toString(),
        done: json['done'] == true,
      );
}

double _parseDouble(Object? v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

DateTime _parseDate(Object? v) {
  if (v == null) return DateTime.now();
  if (v is DateTime) return v;
  if (v is String) return DateTime.tryParse(v) ?? DateTime.now();
  return DateTime.now();
}
