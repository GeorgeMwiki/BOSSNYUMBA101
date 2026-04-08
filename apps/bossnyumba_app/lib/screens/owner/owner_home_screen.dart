import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';
import '../../core/org_provider.dart';
import '../../widgets/org_switcher.dart';

/// Owner portfolio. Fetches `/properties` for the active org. Refetches when
/// the active tenant changes (detected via [OrgProvider]).
class OwnerHomeScreen extends StatefulWidget {
  const OwnerHomeScreen({super.key});

  @override
  State<OwnerHomeScreen> createState() => _OwnerHomeScreenState();
}

class _OwnerHomeScreenState extends State<OwnerHomeScreen> {
  Future<ApiResponse<dynamic>>? _future;
  String? _lastOrgId;

  Future<ApiResponse<dynamic>> _loadPortfolio() {
    return ApiClient.instance.get<dynamic>('/properties');
  }

  Future<void> _refresh() async {
    final f = _loadPortfolio();
    setState(() {
      _future = f;
    });
    await f;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final activeOrgId = context.watch<OrgProvider>().activeOrgId;
    if (_future == null || activeOrgId != _lastOrgId) {
      _lastOrgId = activeOrgId;
      _future = _loadPortfolio();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Portfolio'),
        actions: const [
          OrgSwitcher(),
          SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<ApiResponse<dynamic>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final resp = snap.data;
            if (resp == null || !resp.isOk) {
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
                            resp?.error ??
                                snap.error?.toString() ??
                                'Unable to load portfolio',
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.error),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: _refresh,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            }
            final data = resp.data;
            final List<dynamic> properties = data is List
                ? data
                : (data is Map && data['items'] != null
                    ? List<dynamic>.from(data['items'] as List)
                    : const []);
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
                    final m = p is Map<String, dynamic>
                        ? p
                        : <String, dynamic>{};
                    return Card(
                      child: ListTile(
                        title: Text(m['name']?.toString() ?? 'Property'),
                        subtitle: Text(
                            '${m['units'] ?? 0} units • ${m['city'] ?? ''}'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {},
                      ),
                    );
                  }),
              ],
            );
          },
        ),
      ),
    );
  }
}
