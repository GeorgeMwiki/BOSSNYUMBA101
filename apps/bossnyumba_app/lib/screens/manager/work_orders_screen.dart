import 'package:flutter/material.dart';
import '../../core/services/work_orders_service.dart';
import '../../core/api_client.dart';

class WorkOrdersScreen extends StatefulWidget {
  const WorkOrdersScreen({super.key});

  @override
  State<WorkOrdersScreen> createState() => _WorkOrdersScreenState();
}

class _WorkOrdersScreenState extends State<WorkOrdersScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Work Orders')),
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
                  Icon(Icons.assignment, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  const Text('No work orders'),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (_, i) {
              final wo = items[i] as Map<String, dynamic>;
              final status = wo['status'] ?? 'PENDING';
              final priority = wo['priority'] ?? 'MEDIUM';
              return Card(
                child: ListTile(
                  title: Text(wo['title']?.toString() ?? 'Work Order'),
                  subtitle: Text('$status • $priority'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showWorkOrderSheet(context, wo),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showWorkOrderSheet(BuildContext context, Map<String, dynamic> wo) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _WorkOrderDetailSheet(workOrder: wo),
    );
  }
}

class _WorkOrderDetailSheet extends StatelessWidget {
  const _WorkOrderDetailSheet({required this.workOrder});
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
                  workOrder['title']?.toString() ?? 'Work Order',
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
          _row('Status', workOrder['status']?.toString() ?? 'PENDING'),
          _row('Priority', workOrder['priority']?.toString() ?? 'MEDIUM'),
          _row('Category', workOrder['category']?.toString() ?? 'OTHER'),
          if (workOrder['location'] != null)
            _row('Location', workOrder['location'].toString()),
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

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(k, style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(child: Text(v)),
        ],
      ),
    );
  }
}
