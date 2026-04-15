import 'package:flutter/material.dart';
import '../../core/api_client.dart';

class InspectionsScreen extends StatefulWidget {
  const InspectionsScreen({super.key});

  @override
  State<InspectionsScreen> createState() => _InspectionsScreenState();
}

class _InspectionsScreenState extends State<InspectionsScreen> {
  Future<ApiResponse<List<dynamic>>> _load() async {
    final api = ApiClient.instance;
    final resp = await api.get<Map<String, dynamic>>('/inspections');
    if (!resp.isOk) return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    final data = resp.data;
    if (data is Map && data['items'] != null) {
      return ApiResponse.ok(List<dynamic>.from(data['items'] as List));
    }
    if (data is List) return ApiResponse.ok(data);
    return ApiResponse.ok([]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inspections')),
      body: FutureBuilder<ApiResponse<List<dynamic>>>(
        future: _load(),
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
                  Icon(Icons.checklist, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  const Text('No inspections'),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (_, i) {
              final inv = items[i] as Map<String, dynamic>;
              return Card(
                child: ListTile(
                  title: Text(inv['type']?.toString() ?? 'Inspection'),
                  subtitle: Text(
                    '${inv['scheduledAt']?.toString() ?? inv['date']?.toString() ?? ''} • ${inv['status']?.toString() ?? ''}',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showInspection(context, inv),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showInspection(BuildContext context, Map<String, dynamic> inv) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    inv['type']?.toString() ?? 'Inspection',
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
            _row('Status', inv['status']?.toString() ?? 'SCHEDULED'),
            _row('Scheduled', inv['scheduledAt']?.toString() ?? '—'),
            if (inv['unitId'] != null) _row('Unit', inv['unitId'].toString()),
            if (inv['notes'] != null) ...[
              const SizedBox(height: 12),
              const Text('Notes', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(inv['notes'].toString()),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _row(String k, String v) {
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
