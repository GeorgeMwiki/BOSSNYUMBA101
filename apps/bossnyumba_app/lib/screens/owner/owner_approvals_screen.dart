import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/approvals/approvals_repository.dart';

class OwnerApprovalsScreen extends StatefulWidget {
  const OwnerApprovalsScreen({super.key});

  @override
  State<OwnerApprovalsScreen> createState() => _OwnerApprovalsScreenState();
}

class _OwnerApprovalsScreenState extends State<OwnerApprovalsScreen> {
  final ApprovalsRepository _repo = ApprovalsRepository();
  List<Approval> _approvals = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = context.read<AuthProvider>();
    final resp = await _repo.list(orgId: auth.session?.tenantId);
    if (!mounted) return;
    if (!resp.isOk) {
      setState(() {
        _loading = false;
        _error = resp.error ?? 'Failed to load approvals';
      });
      return;
    }
    setState(() {
      _approvals = resp.data ?? [];
      _loading = false;
    });
  }

  Map<ApprovalType, List<Approval>> _grouped(List<Approval> items) {
    final Map<ApprovalType, List<Approval>> out = {};
    for (final a in items) {
      out.putIfAbsent(a.type, () => []).add(a);
    }
    return out;
  }

  /// Optimistic approve:
  ///   1. Prompt biometric gate.
  ///   2. Flip UI to APPROVED immediately.
  ///   3. Fire POST in the background.
  ///   4. On failure -> revert + snackbar with retry.
  Future<void> _approve(Approval approval) async {
    final allowed = await BiometricGate.authenticate('Approve ${approval.title}');
    if (!allowed) {
      _showSnack('Biometric authentication cancelled');
      return;
    }

    final previousStatus = approval.status;
    final index = _approvals.indexWhere((a) => a.id == approval.id);
    if (index < 0) return;

    setState(() {
      _approvals[index].status = ApprovalStatus.approved;
    });
    _showSnack('Approved');

    final resp = await _repo.approve(approval.id);
    if (!mounted) return;
    if (!resp.isOk) {
      setState(() {
        if (index < _approvals.length && _approvals[index].id == approval.id) {
          _approvals[index].status = previousStatus;
        }
      });
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Approve failed: ${resp.error ?? 'Unknown error'}'),
          action: SnackBarAction(
            label: 'Retry',
            onPressed: () => _approve(approval),
          ),
        ),
      );
    } else if (resp.data != null) {
      setState(() {
        _approvals[index] = resp.data!;
      });
    }
  }

  Future<void> _reject(Approval approval) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _RejectBottomSheet(approvalTitle: approval.title),
    );
    if (reason == null || reason.trim().isEmpty) return;

    final allowed = await BiometricGate.authenticate('Reject ${approval.title}');
    if (!allowed) {
      _showSnack('Biometric authentication cancelled');
      return;
    }

    final previousStatus = approval.status;
    final index = _approvals.indexWhere((a) => a.id == approval.id);
    if (index < 0) return;

    setState(() {
      _approvals[index].status = ApprovalStatus.rejected;
    });
    _showSnack('Rejected');

    final resp = await _repo.reject(approval.id, reason.trim());
    if (!mounted) return;
    if (!resp.isOk) {
      setState(() {
        if (index < _approvals.length && _approvals[index].id == approval.id) {
          _approvals[index].status = previousStatus;
        }
      });
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Reject failed: ${resp.error ?? 'Unknown error'}'),
          action: SnackBarAction(
            label: 'Retry',
            onPressed: () => _reject(approval),
          ),
        ),
      );
    } else if (resp.data != null) {
      setState(() {
        _approvals[index] = resp.data!;
      });
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg), duration: const Duration(seconds: 2)));
  }

  void _openDetail(Approval approval) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ApprovalDetailScreen(
          approvalId: approval.id,
          repo: _repo,
          onApprove: _approve,
          onReject: _reject,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Approvals'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_approvals.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            SizedBox(
              height: 400,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.inbox_outlined, size: 64, color: Colors.grey[400]),
                    const SizedBox(height: 16),
                    const Text('No approvals pending'),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    final grouped = _grouped(_approvals);
    final keys = grouped.keys.toList()
      ..sort((a, b) => approvalTypeLabel(a).compareTo(approvalTypeLabel(b)));

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 24),
        itemCount: keys.length,
        itemBuilder: (context, groupIndex) {
          final type = keys[groupIndex];
          final items = grouped[type]!;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  '${approvalTypeLabel(type)} (${items.length})',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              ...items.map(_buildTile),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTile(Approval approval) {
    final canAct = approval.status == ApprovalStatus.pending;
    final subtitle = [
      if (approval.vendorName != null) approval.vendorName!,
      if (approval.amount != null)
        '${approval.amount!.currency} ${approval.amount!.amount.toStringAsFixed(0)}',
    ].join(' • ');

    final tile = ListTile(
      title: Text(approval.title),
      subtitle: subtitle.isEmpty ? null : Text(subtitle),
      trailing: _statusChip(approval.status),
      onTap: () => _openDetail(approval),
    );

    if (!canAct) {
      return Card(margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: tile);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Dismissible(
        key: ValueKey('approval-${approval.id}'),
        background: Container(
          color: Colors.green,
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.only(left: 20),
          child: const Row(
            children: [
              Icon(Icons.check, color: Colors.white),
              SizedBox(width: 8),
              Text('Approve', style: TextStyle(color: Colors.white)),
            ],
          ),
        ),
        secondaryBackground: Container(
          color: Colors.red,
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 20),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('Reject', style: TextStyle(color: Colors.white)),
              SizedBox(width: 8),
              Icon(Icons.close, color: Colors.white),
            ],
          ),
        ),
        confirmDismiss: (direction) async {
          if (direction == DismissDirection.startToEnd) {
            await _approve(approval);
          } else {
            await _reject(approval);
          }
          // Don't actually dismiss the tile; state refresh handles visuals.
          return false;
        },
        child: Card(child: tile),
      ),
    );
  }

  Widget _statusChip(ApprovalStatus s) {
    switch (s) {
      case ApprovalStatus.approved:
        return const Chip(
          label: Text('Approved'),
          backgroundColor: Color(0xFFDCFCE7),
          labelStyle: TextStyle(color: Color(0xFF166534)),
        );
      case ApprovalStatus.rejected:
        return const Chip(
          label: Text('Rejected'),
          backgroundColor: Color(0xFFFEE2E2),
          labelStyle: TextStyle(color: Color(0xFF991B1B)),
        );
      case ApprovalStatus.pending:
        return const Chip(
          label: Text('Pending'),
          backgroundColor: Color(0xFFFEF3C7),
          labelStyle: TextStyle(color: Color(0xFF92400E)),
        );
    }
  }
}

class _RejectBottomSheet extends StatefulWidget {
  final String approvalTitle;
  const _RejectBottomSheet({required this.approvalTitle});

  @override
  State<_RejectBottomSheet> createState() => _RejectBottomSheetState();
}

class _RejectBottomSheetState extends State<_RejectBottomSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.of(context).viewInsets;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: 16 + insets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Reject: ${widget.approvalTitle}',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            autofocus: true,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Reason for rejection',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: () {
                  final text = _controller.text.trim();
                  if (text.isEmpty) return;
                  Navigator.of(context).pop(text);
                },
                child: const Text('Reject'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ApprovalDetailScreen extends StatefulWidget {
  final String approvalId;
  final ApprovalsRepository repo;
  final Future<void> Function(Approval) onApprove;
  final Future<void> Function(Approval) onReject;

  const ApprovalDetailScreen({
    super.key,
    required this.approvalId,
    required this.repo,
    required this.onApprove,
    required this.onReject,
  });

  @override
  State<ApprovalDetailScreen> createState() => _ApprovalDetailScreenState();
}

class _ApprovalDetailScreenState extends State<ApprovalDetailScreen> {
  Approval? _approval;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final resp = await widget.repo.get(widget.approvalId);
    if (!mounted) return;
    if (!resp.isOk) {
      setState(() {
        _loading = false;
        _error = resp.error ?? 'Failed to load';
      });
      return;
    }
    setState(() {
      _approval = resp.data;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Approval')),
      body: _build(),
    );
  }

  Widget _build() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    final a = _approval;
    if (a == null) return const Center(child: Text('Not found'));
    final canAct = a.status == ApprovalStatus.pending;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(a.title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(approvalTypeLabel(a.type),
            style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Colors.grey[600])),
        const SizedBox(height: 16),
        if (a.summary != null) ...[
          Text(a.summary!),
          const SizedBox(height: 16),
        ],
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (a.amount != null)
                  _kv('Amount',
                      '${a.amount!.currency} ${a.amount!.amount.toStringAsFixed(2)}'),
                if (a.threshold != null)
                  _kv('Threshold',
                      '${a.threshold!.currency} ${a.threshold!.amount.toStringAsFixed(2)}'),
                if (a.vendorName != null) _kv('Vendor', a.vendorName!),
                if (a.invoiceId != null) _kv('Invoice', a.invoiceId!),
                if (a.requestedByName != null) _kv('Requested by', a.requestedByName!),
                _kv('Created', a.createdAt.toLocal().toString()),
                if (a.decidedAt != null)
                  _kv('Decided', a.decidedAt!.toLocal().toString()),
                if (a.rejectionReason != null) _kv('Rejection reason', a.rejectionReason!),
                if (a.metadata.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('Metadata: ${a.metadata}',
                        style: Theme.of(context).textTheme.bodySmall),
                  ),
              ],
            ),
          ),
        ),
        if (a.documents.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Documents', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...a.documents.map((d) => Card(
                child: ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: Text(d.name),
                  subtitle: Text(d.mimeType ?? d.url),
                  trailing: const Icon(Icons.open_in_new),
                ),
              )),
        ],
        const SizedBox(height: 16),
        Text('Audit log', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...a.audit.map((e) => ListTile(
              dense: true,
              leading: const Icon(Icons.history),
              title: Text('${e.action} by ${e.actorId}'),
              subtitle: Text(
                '${e.at.toLocal()}${e.reason != null ? ' — ${e.reason}' : ''}',
              ),
            )),
        if (canAct) ...[
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.close),
                  label: const Text('Reject'),
                  onPressed: () async {
                    await widget.onReject(a);
                    if (mounted) Navigator.of(context).pop();
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  icon: const Icon(Icons.check),
                  label: const Text('Approve'),
                  onPressed: () async {
                    await widget.onApprove(a);
                    if (mounted) Navigator.of(context).pop();
                  },
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 120,
              child: Text(k, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Expanded(child: Text(v)),
          ],
        ),
      );
}
