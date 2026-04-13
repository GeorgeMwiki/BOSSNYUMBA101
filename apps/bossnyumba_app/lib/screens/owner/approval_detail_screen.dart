// Full-context detail view for a pending approval.
//
// Renders type-specific sections so the owner has everything needed to
// make the call in one scroll: line items for invoices, photo gallery and
// bid comparison for work orders, red-line diff for leases, and a deposit
// history + checklist for refunds.
//
// Biometric confirmation is delegated to [BiometricGate]. The default
// implementation uses a modal confirm dialog. When `local_auth` lands in
// pubspec, swap `BiometricGate.platform` to call `LocalAuthentication`.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/approvals/approval.dart';
import '../../core/approvals/approvals_repository.dart';

/// Pluggable biometric gate. Tests can override via [BiometricGate.override]
/// so no real platform plugin is required for widget tests. If the
/// `local_auth` package is added to pubspec later, this is the single
/// place to wire it up.
class BiometricGate {
  static Future<bool> Function(BuildContext, String reason)? override;

  static Future<bool> confirm(BuildContext context, String reason) async {
    if (override != null) return override!(context, reason);
    // Fallback: modal confirmation (local_auth not in pubspec).
    final res = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm'),
        content: Text(reason),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    return res == true;
  }
}

class ApprovalDetailScreen extends StatefulWidget {
  final Approval approval;
  final ApprovalsRepository repository;

  const ApprovalDetailScreen({
    super.key,
    required this.approval,
    required this.repository,
  });

  @override
  State<ApprovalDetailScreen> createState() => _ApprovalDetailScreenState();
}

class _ApprovalDetailScreenState extends State<ApprovalDetailScreen> {
  bool _submitting = false;

  Future<void> _approve() async {
    final ok = await BiometricGate.confirm(
      context,
      'Approve "${widget.approval.title}"?',
    );
    if (!ok) return;
    setState(() => _submitting = true);
    try {
      await widget.repository.approve(widget.approval.id);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Approve failed: $e')),
      );
    }
  }

  Future<void> _reject() async {
    final reason = await _promptReason();
    if (reason == null) return; // cancelled
    final ok = await BiometricGate.confirm(
      context,
      'Reject "${widget.approval.title}"?',
    );
    if (!ok) return;
    setState(() => _submitting = true);
    try {
      await widget.repository.reject(widget.approval.id, reason: reason);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reject failed: $e')),
      );
    }
  }

  Future<String?> _promptReason() async {
    final ctrl = TextEditingController();
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 8,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Reason for rejection',
                  style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 12),
              TextField(
                controller: ctrl,
                maxLines: 3,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Optional — give the requester some context',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(ctx).pop(
                        ctrl.text.trim().isEmpty ? 'Rejected' : ctrl.text.trim(),
                      ),
                      child: const Text('Continue'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.approval;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Review approval')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _header(theme, a),
          const SizedBox(height: 16),
          _metadata(theme, a),
          const SizedBox(height: 16),
          ..._typeSections(theme, a),
          if (a.documents.isNotEmpty) ...[
            const SizedBox(height: 16),
            _documentsSection(theme, a),
          ],
          const SizedBox(height: 96),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.red.shade700,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: _submitting ? null : _reject,
                  icon: const Icon(Icons.close),
                  label: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: _submitting ? null : _approve,
                  icon: const Icon(Icons.check),
                  label: const Text('Approve'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- Sections ------------------------------------------------------------

  Widget _header(ThemeData theme, Approval a) {
    final nf = NumberFormat.currency(symbol: '${a.currency} ', decimalDigits: 0);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 28,
          backgroundColor: theme.colorScheme.primary.withOpacity(0.15),
          child: Icon(a.type.icon, color: theme.colorScheme.primary, size: 28),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(a.title,
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(a.subtitle, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 6),
              Text(nf.format(a.amount),
                  style: theme.textTheme.headlineSmall?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _metadata(ThemeData theme, Approval a) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _kv('Requested by', a.requestedBy),
            _kv('Requested at', DateFormat.yMMMd().add_jm().format(a.requestedAt)),
            if ((a.reason ?? '').isNotEmpty) _kv('Why', a.reason!),
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(k, style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(child: Text(v)),
        ],
      ),
    );
  }

  List<Widget> _typeSections(ThemeData theme, Approval a) {
    switch (a) {
      case VendorInvoiceApproval v:
        return [_vendorInvoiceSection(theme, v)];
      case WorkOrderApproval w:
        return [_workOrderSection(theme, w)];
      case LeaseApproval l:
        return [_leaseSection(theme, l)];
      case RefundApproval r:
        return [_refundSection(theme, r)];
      case UnknownApproval _:
        return const [];
    }
  }

  Widget _vendorInvoiceSection(ThemeData theme, VendorInvoiceApproval v) {
    final nf = NumberFormat.currency(symbol: '${v.currency} ', decimalDigits: 0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Vendor: ${v.vendorName}',
                style: theme.textTheme.titleSmall),
            const Divider(),
            if (v.lineItems.isEmpty)
              const Text('No line items provided')
            else
              Table(
                columnWidths: const {
                  0: FlexColumnWidth(3),
                  1: FlexColumnWidth(1),
                  2: FlexColumnWidth(2),
                },
                children: [
                  const TableRow(children: [
                    Padding(
                      padding: EdgeInsets.symmetric(vertical: 4),
                      child: Text('Item',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                    Text('Qty',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('Total',
                        textAlign: TextAlign.right,
                        style: TextStyle(fontWeight: FontWeight.bold)),
                  ]),
                  for (final li in v.lineItems)
                    TableRow(children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(li.description),
                      ),
                      Text('${li.quantity}'),
                      Text(nf.format(li.total), textAlign: TextAlign.right),
                    ]),
                ],
              ),
            const Divider(),
            _totalRow('Subtotal', nf.format(v.subtotal)),
            _totalRow('Tax', nf.format(v.tax)),
            _totalRow('Total', nf.format(v.amount), bold: true),
          ],
        ),
      ),
    );
  }

  Widget _workOrderSection(ThemeData theme, WorkOrderApproval w) {
    final nf = NumberFormat.currency(symbol: '${w.currency} ', decimalDigits: 0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (w.unit != null)
              Text('Unit: ${w.unit}', style: theme.textTheme.titleSmall),
            if (w.photos.isNotEmpty) ...[
              const SizedBox(height: 8),
              SizedBox(
                height: 100,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: w.photos.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      w.photos[i],
                      width: 120,
                      height: 100,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 120,
                        color: Colors.grey.shade800,
                        child: const Icon(Icons.broken_image),
                      ),
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text('Bids (${w.bids.length})',
                style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            if (w.bids.isEmpty)
              const Text('No competing bids')
            else
              ...w.bids.map(
                (b) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(b.vendorName),
                  subtitle: b.notes == null ? null : Text(b.notes!),
                  trailing: Text(nf.format(b.amount),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _leaseSection(ThemeData theme, LeaseApproval l) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (l.tenantName != null)
              _kv('Tenant', l.tenantName!),
            if (l.unit != null) _kv('Unit', l.unit!),
            if (l.tenantCreditScore != null)
              _kv('Credit score', '${l.tenantCreditScore}'),
            const Divider(),
            Text('Changes', style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            if (l.changes.isEmpty)
              const Text('No redline changes')
            else
              ...l.changes.map((c) => _diffRow(c)),
          ],
        ),
      ),
    );
  }

  Widget _diffRow(LeaseChange c) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(c.field,
              style: const TextStyle(fontWeight: FontWeight.bold)),
          Row(
            children: [
              if (c.before != null)
                Expanded(
                  child: Text(
                    c.before!,
                    style: const TextStyle(
                      color: Colors.redAccent,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ),
              const Icon(Icons.arrow_right, size: 16),
              if (c.after != null)
                Expanded(
                  child: Text(
                    c.after!,
                    style: const TextStyle(color: Colors.greenAccent),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _refundSection(ThemeData theme, RefundApproval r) {
    final nf = NumberFormat.currency(symbol: '${r.currency} ', decimalDigits: 0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (r.tenantName != null) _kv('Tenant', r.tenantName!),
            if (r.unit != null) _kv('Unit', r.unit!),
            _kv('Deposit held', nf.format(r.depositHeld)),
            _kv('Deductions', nf.format(r.deductions)),
            _kv('Refund', nf.format(r.amount)),
            const Divider(),
            Text('Lease end checklist', style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            if (r.leaseEndChecklist.isEmpty)
              const Text('No checklist provided')
            else
              ...r.leaseEndChecklist.map(
                (c) => Row(
                  children: [
                    Icon(
                      c.done ? Icons.check_box : Icons.check_box_outline_blank,
                      size: 18,
                      color: c.done ? Colors.green : Colors.grey,
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(c.label)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _documentsSection(ThemeData theme, Approval a) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Supporting documents', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            SizedBox(
              height: 90,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: a.documents.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final d = a.documents[i];
                  return Container(
                    width: 90,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade900,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(d.isImage
                            ? Icons.image
                            : d.isPdf
                                ? Icons.picture_as_pdf
                                : Icons.insert_drive_file),
                        const SizedBox(height: 4),
                        Text(
                          d.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 10),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _totalRow(String label, String value, {bool bold = false}) {
    final s = bold
        ? const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)
        : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: s),
          Text(value, style: s),
        ],
      ),
    );
  }
}
