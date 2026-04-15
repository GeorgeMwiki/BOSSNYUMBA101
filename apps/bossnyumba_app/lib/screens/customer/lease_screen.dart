import 'package:flutter/material.dart';
import '../../core/services/leases_service.dart';
import '../../core/api_client.dart';

class LeaseScreen extends StatelessWidget {
  const LeaseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lease')),
      body: FutureBuilder<ApiResponse<List<dynamic>>>(
        future: LeasesService().listMine(),
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
                ],
              ),
            );
          }
          final leases = snap.data!.data ?? [];
          if (leases.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.description, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  const Text('No active lease'),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: leases.length,
            itemBuilder: (_, i) {
              final l = leases[i] as Map<String, dynamic>;
              return Card(
                child: ListTile(
                  title: Text('${l['unitId'] ?? 'Unit'} • ${l['status'] ?? 'ACTIVE'}'),
                  subtitle: Text('${l['startDate']} - ${l['endDate']}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showLeaseDetail(context, l),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showLeaseDetail(BuildContext context, Map<String, dynamic> l) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Lease ${l['id'] ?? ''}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text('Unit: ${l['unitId'] ?? '-'}'),
            Text('Status: ${l['status'] ?? 'ACTIVE'}'),
            Text('Start: ${l['startDate'] ?? '-'}'),
            Text('End: ${l['endDate'] ?? '-'}'),
            if (l['monthlyRent'] != null)
              Text('Rent: ${l['monthlyRent']} ${l['currency'] ?? 'KES'}'),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
