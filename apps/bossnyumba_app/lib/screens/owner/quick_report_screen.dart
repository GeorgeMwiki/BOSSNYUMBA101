import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/org_provider.dart';
import '../../core/work_orders/work_order_repository.dart';

/// Quick-report flow for owners on-site: pick property → category →
/// photos → voice note → description → priority → submit.
/// Designed for 30-second completion during a property visit.
class QuickReportScreen extends StatefulWidget {
  const QuickReportScreen({super.key});

  @override
  State<QuickReportScreen> createState() => _QuickReportScreenState();
}

class _QuickReportScreenState extends State<QuickReportScreen> {
  int _step = 0;
  String? _propertyId;
  String? _propertyName;
  String _category = '';
  String _description = '';
  String _priority = 'Medium';
  bool _submitting = false;

  static const _categories = [
    ('Plumbing', Icons.water_drop),
    ('Electrical', Icons.electrical_services),
    ('Structural', Icons.foundation),
    ('Cleaning', Icons.cleaning_services),
    ('Security', Icons.security),
    ('Other', Icons.more_horiz),
  ];

  static const _priorities = ['Low', 'Medium', 'High', 'Critical'];

  Color _priorityColor(String p) {
    switch (p) {
      case 'Low': return Colors.green;
      case 'Medium': return Colors.amber;
      case 'High': return Colors.orange;
      case 'Critical': return Colors.red;
      default: return Colors.grey;
    }
  }

  Future<void> _submit() async {
    if (_propertyId == null || _category.isEmpty) return;
    setState(() => _submitting = true);

    final resp = await ApiClient.instance.post<dynamic>('/work-orders', body: {
      'propertyId': _propertyId,
      'category': _category,
      'priority': _priority.toUpperCase(),
      'description': _description,
    });

    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(resp.isOk ? 'Report sent' : 'Failed: ${resp.error}'),
          action: resp.isOk ? SnackBarAction(label: 'Undo', onPressed: () {}) : null,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('New report (${_step + 1}/4)'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildStep()),
            const SizedBox(height: 16),
            Row(
              children: [
                if (_step > 0)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _step--),
                      child: const Text('Back'),
                    ),
                  ),
                if (_step > 0) const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: _step < 3
                      ? FilledButton(
                          onPressed: _canAdvance() ? () => setState(() => _step++) : null,
                          child: const Text('Next'),
                        )
                      : FilledButton(
                          onPressed: _submitting ? null : _submit,
                          child: _submitting
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Submit report'),
                        ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  bool _canAdvance() {
    switch (_step) {
      case 0: return _propertyId != null;
      case 1: return _category.isNotEmpty;
      case 2: return true; // description is optional
      default: return true;
    }
  }

  Widget _buildStep() {
    switch (_step) {
      case 0: return _buildPropertyPicker();
      case 1: return _buildCategoryPicker();
      case 2: return _buildDescriptionStep();
      case 3: return _buildPriorityStep();
      default: return const SizedBox();
    }
  }

  Widget _buildPropertyPicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Which property?', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text('Select the property this report is about.', style: TextStyle(color: Colors.grey[600])),
        const SizedBox(height: 16),
        FutureBuilder<ApiResponse<dynamic>>(
          future: ApiClient.instance.get<dynamic>('/properties', queryParams: const {'limit': '20'}),
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final data = snap.data?.data;
            final items = data is List ? data : [];
            if (items.isEmpty) return const Text('No properties found.');
            return Expanded(
              child: ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final p = items[i] is Map<String, dynamic> ? items[i] as Map<String, dynamic> : <String, dynamic>{};
                  final id = p['id']?.toString() ?? '';
                  final name = p['name']?.toString() ?? 'Property ${i + 1}';
                  return RadioListTile<String>(
                    value: id,
                    groupValue: _propertyId,
                    title: Text(name),
                    subtitle: Text(p['city']?.toString() ?? ''),
                    onChanged: (v) => setState(() { _propertyId = v; _propertyName = name; }),
                  );
                },
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildCategoryPicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Category', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: _categories.map((c) {
            final selected = _category == c.$1;
            return ChoiceChip(
              label: Row(
                mainAxisSize: MainAxisSize.min,
                children: [Icon(c.$2, size: 18), const SizedBox(width: 6), Text(c.$1)],
              ),
              selected: selected,
              onSelected: (_) => setState(() => _category = c.$1),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildDescriptionStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Description', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text('Optional — add text, or skip and submit with just the category + priority.',
            style: TextStyle(color: Colors.grey[600])),
        const SizedBox(height: 16),
        TextField(
          maxLines: 5,
          decoration: const InputDecoration(
            hintText: 'Describe the issue...',
            border: OutlineInputBorder(),
          ),
          onChanged: (v) => _description = v,
        ),
        const SizedBox(height: 16),
        // Placeholder for voice note + photo — real implementation needs
        // image_picker + record packages (see work_order_repository.dart)
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Camera requires image_picker package')),
              ),
              icon: const Icon(Icons.camera_alt),
              label: const Text('Photo'),
            ),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Voice note requires record package')),
              ),
              icon: const Icon(Icons.mic),
              label: const Text('Voice note'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPriorityStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Priority', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text('How urgent is this?', style: TextStyle(color: Colors.grey[600])),
        const SizedBox(height: 16),
        ..._priorities.map((p) => RadioListTile<String>(
          value: p,
          groupValue: _priority,
          title: Text(p, style: TextStyle(color: _priorityColor(p), fontWeight: FontWeight.w600)),
          onChanged: (v) => setState(() => _priority = v ?? 'Medium'),
        )),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Summary', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text('Property: ${_propertyName ?? "—"}'),
                Text('Category: $_category'),
                Text('Priority: $_priority'),
                if (_description.isNotEmpty) Text('Description: $_description'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
