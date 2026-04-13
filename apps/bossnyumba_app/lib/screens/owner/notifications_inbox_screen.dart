import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/notifications/notifications_repository.dart';
import '../../widgets/notification_card.dart';

/// Full inbox with All / Unread / Critical tabs. Deep-link-first UX: tapping
/// a row routes to the detail screen (which is itself the hand-off point to
/// the actual resource screen). Mobile is the "stay informed" surface; the
/// heavy workflow happens on the web owner-portal.
class NotificationsInboxScreen extends StatefulWidget {
  const NotificationsInboxScreen({super.key});

  @override
  State<NotificationsInboxScreen> createState() =>
      _NotificationsInboxScreenState();
}

class _NotificationsInboxScreenState extends State<NotificationsInboxScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  static const _filters = [
    NotificationsFilter.all,
    NotificationsFilter.unread,
    NotificationsFilter.critical,
  ];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _filters.length, vsync: this);
    // Kick off an initial refresh so the list is fresh whenever the user
    // opens the inbox via deep link or nav.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final repo = context.read<NotificationsRepository?>();
      // ignore: discarded_futures
      repo?.refresh();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final repo = context.watch<NotificationsRepository?>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            tooltip: 'Mark all read',
            icon: const Icon(Icons.done_all),
            onPressed: repo == null || repo.unreadCount == 0
                ? null
                : () async {
                    final ok = await repo.markAllRead();
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(ok
                            ? 'All notifications marked as read'
                            : 'Could not mark all as read'),
                      ),
                    );
                  },
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: const Color(0xFF1DB954),
          unselectedLabelColor: Colors.grey,
          indicatorColor: const Color(0xFF1DB954),
          tabs: [
            const Tab(text: 'All'),
            Tab(
              child: _BadgedTab(
                label: 'Unread',
                count: repo?.unreadCount ?? 0,
              ),
            ),
            Tab(
              child: _BadgedTab(
                label: 'Critical',
                count: repo?.criticalCount ?? 0,
                color: const Color(0xFFE53935),
              ),
            ),
          ],
        ),
      ),
      body: repo == null
          ? const _EmptyState(
              title: 'Notifications unavailable',
              subtitle:
                  'The notifications service is not wired up in this build.',
            )
          : TabBarView(
              controller: _tabs,
              children: _filters
                  .map((f) => _InboxList(repo: repo, filter: f))
                  .toList(),
            ),
    );
  }
}

class _InboxList extends StatelessWidget {
  final NotificationsRepository repo;
  final NotificationsFilter filter;

  const _InboxList({required this.repo, required this.filter});

  @override
  Widget build(BuildContext context) {
    final items = repo.filter(filter);

    return RefreshIndicator(
      onRefresh: repo.refresh,
      color: const Color(0xFF1DB954),
      child: items.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.15),
                _EmptyState(
                  title: _emptyTitle(filter),
                  subtitle: _emptySubtitle(filter),
                ),
              ],
            )
          : ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, i) {
                final n = items[i];
                return Dismissible(
                  key: ValueKey('notif-${n.id}'),
                  direction: n.read
                      ? DismissDirection.none
                      : DismissDirection.endToStart,
                  background: Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    alignment: Alignment.centerRight,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1DB954).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Icon(Icons.done, color: Color(0xFF1DB954)),
                        SizedBox(width: 8),
                        Text('Mark read',
                            style: TextStyle(color: Color(0xFF1DB954))),
                      ],
                    ),
                  ),
                  confirmDismiss: (_) async {
                    await repo.markRead(n.id);
                    // Return false — we don't physically remove the row, we
                    // just flip the read state so it disappears from the
                    // unread tab but stays in the 'all' view.
                    return false;
                  },
                  child: NotificationCard(
                    notification: n,
                    onTap: () => _handleTap(context, n),
                  ),
                );
              },
            ),
    );
  }

  void _handleTap(BuildContext context, OwnerNotification n) {
    // Owners tap once on mobile and expect to land on the resource — the
    // notification detail screen acts as a router that marks-read then
    // forwards to the resource-specific deep link when present.
    context.push('/owner/notifications/${n.id}');
  }

  static String _emptyTitle(NotificationsFilter f) {
    switch (f) {
      case NotificationsFilter.all:
        return 'Inbox is empty';
      case NotificationsFilter.unread:
        return 'All caught up';
      case NotificationsFilter.critical:
        return 'No critical alerts';
    }
  }

  static String _emptySubtitle(NotificationsFilter f) {
    switch (f) {
      case NotificationsFilter.all:
        return 'You will be notified here about approvals, overdue invoices, and urgent work orders.';
      case NotificationsFilter.unread:
        return 'Nothing new since your last check-in.';
      case NotificationsFilter.critical:
        return 'Critical alerts will pop up here so you can act fast.';
    }
  }
}

class _BadgedTab extends StatelessWidget {
  final String label;
  final int count;
  final Color? color;

  const _BadgedTab({required this.label, required this.count, this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label),
        if (count > 0) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: color ?? const Color(0xFF1DB954),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              count > 99 ? '99+' : '$count',
              style: const TextStyle(
                color: Colors.black,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String title;
  final String subtitle;
  const _EmptyState({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.notifications_off_outlined,
                size: 48, color: Colors.grey[600]),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[500], fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
