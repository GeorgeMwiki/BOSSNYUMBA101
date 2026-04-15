import 'package:flutter/material.dart';
import '../../core/services/work_orders_service.dart';
import '../../core/api_client.dart';

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Maintenance Requests')),
      body: FutureBuilder<ApiResponse<List<dynamic>>>(
        future: WorkOrdersService().listMine(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError || !snap.data!.isOk) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(snap.data?.error ?? snap.error?.toString() ?? 'Failed to load'),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => setState(() {}),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }
          final items = snap.data!.data ?? [];
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.build, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  const Text('No requests yet'),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () => _showNewRequest(context),
                    icon: const Icon(Icons.add),
                    label: const Text('New request'),
                  ),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (_, i) {
              final wo = items[i] as Map<String, dynamic>;
              return Card(
                child: ListTile(
                  title: Text(wo['title']?.toString() ?? 'Request'),
                  subtitle: Text('${wo['status'] ?? 'PENDING'} • ${wo['priority'] ?? ''}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showWorkOrderDetail(context, wo),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showNewRequest(context),
        icon: const Icon(Icons.add),
        label: const Text('New request'),
      ),
    );
  }

  void _showNewRequest(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NewRequestSheet(),
    ).then((_) => setState(() {}));
  }

  void _showWorkOrderDetail(BuildContext context, Map<String, dynamic> wo) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              wo['title']?.toString() ?? 'Request',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text('Status: ${wo['status'] ?? 'PENDING'}'),
            Text('Priority: ${wo['priority'] ?? 'MEDIUM'}'),
            if (wo['description'] != null) ...[
              const SizedBox(height: 12),
              Text(wo['description'].toString()),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _NewRequestSheet extends StatefulWidget {
  const _NewRequestSheet();

  @override
  State<_NewRequestSheet> createState() => _NewRequestSheetState();
}

class _NewRequestSheetState extends State<_NewRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _priority = 'MEDIUM';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final resp = await WorkOrdersService().create(
      title: _titleCtrl.text.trim(),
      description: _descCtrl.text.trim(),
      priority: _priority,
    );
    if (!mounted) return;
    if (resp.isOk) {
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maintenance request submitted')),
      );
    } else {
      setState(() {
        _submitting = false;
        _error = resp.error ?? 'Failed to submit request';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + bottomInset),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'New maintenance request',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Title',
                hintText: 'e.g. Leaking kitchen tap',
              ),
              textInputAction: TextInputAction.next,
              validator: (v) =>
                  (v == null || v.trim().length < 3) ? 'Enter a short title' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Describe the issue in detail',
              ),
              minLines: 3,
              maxLines: 6,
              validator: (v) =>
                  (v == null || v.trim().length < 5) ? 'Add a description' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _priority,
              decoration: const InputDecoration(labelText: 'Priority'),
              items: const [
                DropdownMenuItem(value: 'LOW', child: Text('Low')),
                DropdownMenuItem(value: 'MEDIUM', child: Text('Medium')),
                DropdownMenuItem(value: 'HIGH', child: Text('High')),
                DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
              ],
              onChanged: (v) => setState(() => _priority = v ?? 'MEDIUM'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              label: Text(_submitting ? 'Submitting…' : 'Submit'),
            ),
          ],
        ),
      ),
    );
  }
}
