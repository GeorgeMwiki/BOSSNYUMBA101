import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/work_orders_service.dart';
import '../../core/api_client.dart';
import '../../l10n/generated/app_localizations.dart';

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.maintenanceTitle)),
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
                  Text(snap.data?.error ?? snap.error?.toString() ?? l10n.stateFailedToLoad),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => setState(() {}),
                    child: Text(l10n.actionRetry),
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
                  Text(l10n.maintenanceEmpty),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () => _showNewRequest(context),
                    icon: const Icon(Icons.add),
                    label: Text(l10n.maintenanceNewRequest),
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
                  title: Text(wo['title'] ?? l10n.maintenanceRequestFallback),
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
        label: Text(l10n.maintenanceNewRequest),
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
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Text(l10n.maintenanceNewRequestPlaceholder),
    );
  }
}
