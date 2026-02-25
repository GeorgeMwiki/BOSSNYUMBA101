import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
                  title: Text(wo['title'] ?? 'Work Order'),
                  subtitle: Text('$status • $priority'),
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
