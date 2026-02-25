import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient.instance.get<Map<String, dynamic>>('/bff/customer-app/maintenance');
      if (!mounted) return;
      if (resp.isOk && resp.data != null) {
        final data = resp.data!;
        final items = data['items'] ?? data['requests'] ?? (data is List ? data : []);
        setState(() { _items = items is List ? items : []; _loading = false; });
      } else {
        setState(() { _items = []; _loading = false; });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() { _items = []; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Maintenance Requests')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? _buildEmpty()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length,
                    itemBuilder: (_, i) {
                      final wo = _items[i] as Map<String, dynamic>;
                      final status = (wo['status'] ?? 'PENDING').toString().toUpperCase();
                      return Card(
                        child: ListTile(
                          leading: _statusIcon(status),
                          title: Text(wo['title'] ?? wo['description'] ?? 'Request'),
                          subtitle: Text('$status${wo['priority'] != null ? " • ${wo['priority']}" : ""}'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () {},
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showNewRequest(context),
        icon: const Icon(Icons.add),
        label: const Text('New Request'),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.build_rounded, size: 64, color: Colors.grey[600]),
        const SizedBox(height: 16),
        const Text('No maintenance requests'),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () => _showNewRequest(context),
          icon: const Icon(Icons.add),
          label: const Text('Create Request'),
        ),
      ],
    ));
  }

  Widget _statusIcon(String status) {
    switch (status) {
      case 'COMPLETED': return const Icon(Icons.check_circle, color: Color(0xFF10B981));
      case 'IN_PROGRESS': return const Icon(Icons.autorenew, color: Color(0xFFF59E0B));
      default: return const Icon(Icons.schedule, color: Color(0xFF64748B));
    }
  }

  void _showNewRequest(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _NewRequestSheet(onSubmitted: () { Navigator.pop(context); _load(); }),
    );
  }
}

class _NewRequestSheet extends StatefulWidget {
  final VoidCallback onSubmitted;
  const _NewRequestSheet({required this.onSubmitted});

  @override
  State<_NewRequestSheet> createState() => _NewRequestSheetState();
}

class _NewRequestSheetState extends State<_NewRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  String _priority = 'MEDIUM';
  String _category = 'GENERAL';
  bool _submitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      final resp = await ApiClient.instance.post<Map<String, dynamic>>(
        '/bff/customer-app/maintenance',
        body: {
          'title': _titleController.text.trim(),
          'description': _descController.text.trim(),
          'priority': _priority,
          'category': _category,
        },
      );
      if (!mounted) return;
      if (resp.isOk) {
        widget.onSubmitted();
      } else {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(resp.error ?? 'Failed to submit')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Form(
        key: _formKey,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('New Maintenance Request', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          TextFormField(
            controller: _titleController,
            decoration: const InputDecoration(labelText: 'Title', prefixIcon: Icon(Icons.title)),
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _descController,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Description', alignLabelWithHint: true),
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: DropdownButtonFormField<String>(
              value: _priority,
              decoration: const InputDecoration(labelText: 'Priority'),
              items: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) =>
                DropdownMenuItem(value: p, child: Text(p))).toList(),
              onChanged: (v) => setState(() => _priority = v!),
            )),
            const SizedBox(width: 12),
            Expanded(child: DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: 'Category'),
              items: ['GENERAL', 'PLUMBING', 'ELECTRICAL', 'STRUCTURAL', 'APPLIANCE', 'OTHER'].map((c) =>
                DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setState(() => _category = v!),
            )),
          ]),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Submit Request'),
          ),
        ]),
      ),
    );
  }
}
