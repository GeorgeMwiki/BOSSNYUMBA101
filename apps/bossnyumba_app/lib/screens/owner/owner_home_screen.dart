import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

class OwnerHomeScreen extends StatefulWidget {
  const OwnerHomeScreen({super.key});

  @override
  State<OwnerHomeScreen> createState() => _OwnerHomeScreenState();
}

class _OwnerHomeScreenState extends State<OwnerHomeScreen> {
  Future<ApiResponse<Map<String, dynamic>>> _loadPortfolio() async {
    final api = ApiClient.instance;
    final resp = await api.get<Map<String, dynamic>>('/properties');
    if (!resp.isOk) return ApiResponse.error(resp.error ?? 'Unknown error', statusCode: resp.statusCode);
    return ApiResponse.ok(resp.data ?? {});
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;

    return Scaffold(
      appBar: AppBar(title: const Text('Portfolio')),
      body: FutureBuilder<ApiResponse<Map<String, dynamic>>>(
        future: _loadPortfolio(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError || !snap.data!.isOk) {
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome, ${session?.firstName ?? "Owner"}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          snap.data?.error ?? snap.error?.toString() ?? 'Unable to load portfolio',
                          style: TextStyle(color: Theme.of(context).colorScheme.error),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }
          final data = snap.data!.data;
          final List<dynamic> properties = data is List ? data : (data is Map && data['items'] != null ? List<dynamic>.from(data['items'] as List) : []);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome, ${session?.firstName ?? "Owner"}',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      if (properties.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text(
                          '${properties.length} propert${properties.length == 1 ? 'y' : 'ies'}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (properties.isEmpty)
                Center(
                  child: Column(
                    children: [
                      Icon(Icons.apartment, size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      const Text('No properties yet'),
                    ],
                  ),
                )
              else
                ...properties.map((p) {
                  final m = p as Map<String, dynamic>;
                  return Card(
                    child: ListTile(
                      title: Text(m['name']?.toString() ?? 'Property'),
                      subtitle: Text('${m['units'] ?? 0} units • ${m['city'] ?? ''}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _showPropertyDetail(context, m),
                    ),
                  );
                }),
            ],
          );
        },
      ),
    );
  }

  void _showPropertyDetail(BuildContext context, Map<String, dynamic> p) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p['name']?.toString() ?? 'Property',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text('City: ${p['city'] ?? '-'}'),
            Text('Units: ${p['units'] ?? 0}'),
            if (p['address'] != null) Text('Address: ${p['address']}'),
            if (p['occupancyRate'] != null)
              Text('Occupancy: ${p['occupancyRate']}%'),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
