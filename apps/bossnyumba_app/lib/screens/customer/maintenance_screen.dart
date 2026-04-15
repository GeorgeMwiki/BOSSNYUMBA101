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
          if (snap.hasError || !(snap.data?.isOk ?? false)) {
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
                  subtitle: Text(
                    '${wo['status']?.toString() ?? 'PENDING'} • ${wo['priority']?.toString() ?? ''}',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showDetail(context, wo),
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
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NewRequestSheet(),
    ).then((created) {
      if (created == true && mounted) setState(() {});
    });
  }

  void _showDetail(BuildContext context, Map<String, dynamic> wo) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RequestDetailSheet(workOrder: wo),
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
  final _descriptionCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  String _category = 'PLUMBING';
  String _priority = 'MEDIUM';
  bool _requiresEntry = false;
  bool _submitting = false;
  String? _error;

  static const _categories = <String>[
    'PLUMBING',
    'ELECTRICAL',
    'HVAC',
    'APPLIANCE',
    'STRUCTURAL',
    'PEST_CONTROL',
    'CLEANING',
    'SECURITY',
    'OTHER',
  ];

  static const _priorities = <String>['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    _locationCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final resp = await WorkOrdersService().create(
      title: _titleCtrl.text.trim(),
      description: _descriptionCtrl.text.trim(),
      category: _category,
      priority: _priority,
      location: _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
      requiresEntry: _requiresEntry,
    );
    if (!mounted) return;
    if (resp.isOk) {
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request submitted')),
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
    final insets = MediaQuery.of(context).viewInsets;
    return Padding(
      padding: EdgeInsets.only(
        bottom: insets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'New maintenance request',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  hintText: 'e.g. Kitchen sink leaks',
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descriptionCtrl,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  hintText: 'Describe the issue in detail',
                ),
                validator: (v) => (v == null || v.trim().length < 10)
                    ? 'Please add at least 10 characters'
                    : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _categories
                    .map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' '))))
                    .toList(),
                onChanged: (v) => setState(() => _category = v ?? 'OTHER'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _priority,
                decoration: const InputDecoration(labelText: 'Priority'),
                items: _priorities
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (v) => setState(() => _priority = v ?? 'MEDIUM'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _locationCtrl,
                decoration: const InputDecoration(
                  labelText: 'Location (optional)',
                  hintText: 'e.g. Kitchen, Master bedroom',
                ),
              ),
              const SizedBox(height: 12),
              SwitchListTile.adaptive(
                value: _requiresEntry,
                onChanged: (v) => setState(() => _requiresEntry = v),
                title: const Text('Requires entry while I\'m away'),
                contentPadding: EdgeInsets.zero,
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Submit request'),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class _RequestDetailSheet extends StatelessWidget {
  const _RequestDetailSheet({required this.workOrder});
  final Map<String, dynamic> workOrder;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  workOrder['title']?.toString() ?? 'Request',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _kv('Status', workOrder['status']?.toString() ?? 'PENDING'),
          _kv('Priority', workOrder['priority']?.toString() ?? 'MEDIUM'),
          _kv('Category', workOrder['category']?.toString() ?? 'OTHER'),
          if (workOrder['description'] != null) ...[
            const SizedBox(height: 12),
            const Text('Description',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(workOrder['description'].toString()),
          ],
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(width: 90, child: Text(k, style: const TextStyle(color: Colors.grey))),
          Expanded(child: Text(v)),
        ],
      ),
    );
  }
}
