import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
                  title: Text(inv['type'] ?? 'Inspection'),
                  subtitle: Text('${inv['scheduledAt'] ?? inv['date'] ?? ''} • ${inv['status'] ?? ''}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
              );
            },
          );
        },
      ),
    );
  }
}
