import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../widgets/stories_bar.dart';
import '../../widgets/feed_card.dart';

class CustomerHomeScreen extends StatelessWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: [
          Text(
            session?.firstName != null
                ? l10n.welcomeUser(session!.firstName)
                : l10n.welcomeResident,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            l10n.communityFeed,
            style: TextStyle(color: Colors.grey[400], fontSize: 14),
          ),
          const SizedBox(height: 16),
          const StoriesBar(),
          const SizedBox(height: 16),
          _SpotifyCard(
            icon: Icons.credit_card,
            title: l10n.payRentTitle,
            subtitle: l10n.payRentSubtitle('KES 45,000'),
            onTap: () => context.go('/payments'),
          ),
          const SizedBox(height: 24),
          Text(l10n.feedTitle, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const FeedCard(author: 'Sunrise Apartments', content: 'Pool maintenance completed. Enjoy!', likes: 12, comments: 3),
          const FeedCard(author: 'Estate Manager', content: 'New parking bays now available in Block B.', likes: 8, comments: 1),
          const SizedBox(height: 24),
          _SpotifyCard(
            icon: Icons.chat_bubble_outline,
            title: l10n.messagesCardTitle,
            subtitle: l10n.messagesCardSubtitle,
            onTap: () {},
          ),
        ],
      ),
    );
  }
}

class _SpotifyCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _SpotifyCard({required this.icon, required this.title, required this.subtitle, required this.onTap});

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
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    Text(subtitle, style: TextStyle(color: Colors.grey[400], fontSize: 13)),
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
