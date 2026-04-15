import 'package:flutter/material.dart';

import '../../core/services/work_orders_service.dart';
import '../../core/api_client.dart';

class WorkOrderDetailScreen extends StatefulWidget {
  final String workOrderId;

  const WorkOrderDetailScreen({super.key, required this.workOrderId});

  @override
  State<WorkOrderDetailScreen> createState() => _WorkOrderDetailScreenState();
}

class _WorkOrderDetailScreenState extends State<WorkOrderDetailScreen> {
  final _svc = WorkOrdersService();
  Future<ApiResponse<Map<String, dynamic>>>? _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _svc.getById(widget.workOrderId);
  }

  void _reload() {
    setState(() {
      _future = _svc.getById(widget.workOrderId);
    });
  }

  Future<void> _withBusy(Future<ApiResponse<Map<String, dynamic>>> Function() op, String successMsg) async {
    setState(() => _busy = true);
    final resp = await op();
    if (!mounted) return;
    setState(() => _busy = false);
    if (resp.isOk) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMsg)));
      _reload();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(resp.error ?? 'Action failed')),
      );
    }
  }

  Future<void> _start() => _withBusy(() => _svc.start(widget.workOrderId), 'Work started');

  Future<void> _complete() async {
    final notesController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Complete work order'),
        content: TextField(
          controller: notesController,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Completion notes',
            hintText: 'Describe what was done',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Complete')),
        ],
      ),
    );
    if (confirmed != true) return;
    // NOTE: photo capture via multipart is wired in WorkOrdersService.completeWithProof.
    // Until an image picker is plumbed in, we submit the JSON variant so the
    // status transitions and the customer is notified.
    await _withBusy(
      () => _svc.complete(widget.workOrderId, completionNotes: notesController.text),
      'Work order completed',
    );
  }

  Future<void> _assignSelf() async {
    await _withBusy(
      () => _svc.assign(widget.workOrderId, assignedToUserId: 'self'),
      'Assigned',
    );
  }

  Widget _actionsFor(String status) {
    final s = status.toLowerCase();
    final actions = <Widget>[];
    if (['assigned', 'scheduled', 'approved'].contains(s)) {
      actions.add(FilledButton.icon(
        onPressed: _busy ? null : _start,
        icon: const Icon(Icons.play_arrow),
        label: const Text('Start'),
      ));
    }
    if (s == 'in_progress') {
      actions.add(FilledButton.icon(
        onPressed: _busy ? null : _complete,
        icon: const Icon(Icons.check),
        label: const Text('Complete'),
      ));
    }
    if (['submitted', 'triaged', 'approved'].contains(s)) {
      actions.add(OutlinedButton.icon(
        onPressed: _busy ? null : _assignSelf,
        icon: const Icon(Icons.assignment_ind),
        label: const Text('Assign to me'),
      ));
    }
    if (actions.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Wrap(spacing: 12, runSpacing: 12, children: actions),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Work Order')),
      body: FutureBuilder<ApiResponse<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snap.hasData || !snap.data!.isOk) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(snap.data?.error ?? snap.error?.toString() ?? 'Failed to load'),
              ),
            );
          }
          final wo = snap.data!.data!;
          final status = (wo['status'] ?? 'SUBMITTED').toString();
          final priority = (wo['priority'] ?? 'MEDIUM').toString();
          final category = (wo['category'] ?? 'OTHER').toString();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                (wo['workOrderNumber'] ?? wo['ticketNumber'] ?? '').toString(),
                style: Theme.of(context).textTheme.labelSmall,
              ),
              const SizedBox(height: 4),
              Text(
                (wo['title'] ?? 'Work Order').toString(),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                Chip(label: Text(status)),
                Chip(label: Text(priority)),
                Chip(label: Text(category)),
              ]),
              if (wo['description'] != null) ...[
                const SizedBox(height: 16),
                Text('Description', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['description'].toString()),
              ],
              if (wo['location'] != null) ...[
                const SizedBox(height: 16),
                Text('Location', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['location'].toString()),
              ],
              if (wo['scheduledDate'] != null) ...[
                const SizedBox(height: 16),
                Text('Scheduled', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['scheduledDate'].toString()),
              ],
              if (wo['completionNotes'] != null) ...[
                const SizedBox(height: 16),
                Text('Completion notes', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['completionNotes'].toString()),
              ],
              _actionsFor(status),
            ],
          );
        },
      ),
    );
  }
}
