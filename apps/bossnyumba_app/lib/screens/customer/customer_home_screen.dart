import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';
import '../../core/org_provider.dart';
import '../../widgets/stories_bar.dart';
import '../../widgets/feed_card.dart';
import '../../widgets/org_switcher.dart';

/// Customer-facing home. Loads the active org's listings feed via the shared
/// [ApiClient] (which auto-injects the `X-Active-Org` header from
/// [OrgProvider]). Uses a [FutureBuilder] for loading + error states and
/// refetches whenever the active org changes.
class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  Future<ApiResponse<dynamic>>? _future;
  String? _lastOrgId;

  Future<ApiResponse<dynamic>> _fetchListings() {
    return ApiClient.instance.get<dynamic>('/listings',
        queryParams: const {'limit': '20'});
  }

  Future<void> _refresh() async {
    final f = _fetchListings();
    setState(() {
      _future = f;
    });
    await f;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    // Re-run the fetch whenever the active org changes.
    final activeOrgId = context.watch<OrgProvider>().activeOrgId;
    if (_future == null || activeOrgId != _lastOrgId) {
      _lastOrgId = activeOrgId;
      _future = _fetchListings();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('BOSSNYUMBA'),
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
            return ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                Text(
                  'Welcome, ${session?.firstName ?? "Resident"}',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Your community feed',
                  style: TextStyle(color: Colors.grey[400], fontSize: 14),
                ),
                const SizedBox(height: 16),
                const StoriesBar(),
                const SizedBox(height: 16),
                _SpotifyCard(
                  icon: Icons.credit_card,
                  title: 'Pay rent',
                  subtitle: 'KES 45,000 due',
                  onTap: () => context.go('/payments'),
                ),
                const SizedBox(height: 24),
                Text('Listings',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                _buildListingsSection(snap),
                const SizedBox(height: 24),
                Text('Feed',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const FeedCard(
                    author: 'Sunrise Apartments',
                    content: 'Pool maintenance completed. Enjoy!',
                    likes: 12,
                    comments: 3),
                const FeedCard(
                    author: 'Estate Manager',
                    content: 'New parking bays now available in Block B.',
                    likes: 8,
                    comments: 1),
                const SizedBox(height: 24),
                _SpotifyCard(
                  icon: Icons.chat_bubble_outline,
                  title: 'Messages',
                  subtitle: 'Chat with estate manager & groups',
                  onTap: () {},
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildListingsSection(AsyncSnapshot<ApiResponse<dynamic>> snap) {
    if (snap.connectionState == ConnectionState.waiting) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final resp = snap.data;
    if (resp == null || !resp.isOk) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  resp?.error ?? 'Unable to load listings',
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
              TextButton(
                onPressed: _refresh,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    final data = resp.data;
    final items = data is List
        ? data
        : (data is Map && data['items'] is List
            ? (data['items'] as List)
            : const []);
    if (items.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No listings yet for this organization.'),
      );
    }
    return Column(
      children: items.take(5).map<Widget>((raw) {
        final m = raw is Map<String, dynamic> ? raw : <String, dynamic>{};
        return Card(
          child: ListTile(
            leading: const Icon(Icons.apartment),
            title: Text(m['title']?.toString() ?? m['name']?.toString() ?? 'Listing'),
            subtitle: Text(m['city']?.toString() ?? m['location']?.toString() ?? ''),
            trailing: m['price'] != null
                ? Text('KES ${m['price']}')
                : const Icon(Icons.chevron_right),
          ),
        );
      }).toList(),
    );
  }
}

class _SpotifyCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _SpotifyCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF282828),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFF1DB954),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: Colors.black, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 16)),
                    Text(subtitle,
                        style:
                            TextStyle(color: Colors.grey[400], fontSize: 13)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Color(0xFF1DB954)),
            ],
          ),
        ),
      ),
    );
  }
}
