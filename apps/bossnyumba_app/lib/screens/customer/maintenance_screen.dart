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
                  title: Text(wo['title'] ?? 'Request'),
                  subtitle: Text('${wo['status'] ?? 'PENDING'} • ${wo['priority'] ?? ''}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
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
}

class _NewRequestSheet extends StatelessWidget {
  const _NewRequestSheet();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(24),
      child: Text('New maintenance request form (placeholder)'),
    );
  }
}
