import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/notifications/notifications_repository.dart';

/// Full-body view of a single notification. Two responsibilities:
///   1. Mark the notification as read the moment the owner sees it.
///   2. Offer action buttons that deep-link to the underlying resource
///      (invoice, work order, approval, tenant record). These are the only
///      surfaces on mobile where the owner is expected to "do" something —
///      everything else defers to the web portal.
class NotificationDetailScreen extends StatefulWidget {
  final String notificationId;

  const NotificationDetailScreen({super.key, required this.notificationId});

  @override
  State<NotificationDetailScreen> createState() =>
      _NotificationDetailScreenState();
}

class _NotificationDetailScreenState extends State<NotificationDetailScreen> {
  OwnerNotification? _notification;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _hydrate());
  }

  Future<void> _hydrate() async {
    final repo = context.read<NotificationsRepository?>();
    if (repo == null) {
      setState(() {
        _loading = false;
        _error = 'Notifications service unavailable';
      });
      return;
    }
    try {
      final n = await repo.getById(widget.notificationId);
      if (!mounted) return;
      setState(() {
        _notification = n;
        _loading = false;
        _error = n == null ? 'Notification not found' : null;
      });
      if (n != null && !n.read) {
        // Fire and forget — read state flip is visual only.
        // ignore: discarded_futures
        repo.markRead(n.id);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notification')),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF1DB954)),
      );
    }
    if (_error != null || _notification == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.grey[600]),
              const SizedBox(height: 12),
              Text(
                _error ?? 'Unknown error',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[400]),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => context.pop(),
                child: const Text('Back'),
              ),
            ],
          ),
        ),
      );
    }

    final n = _notification!;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SeverityHeader(severity: n.severity, type: n.type),
        const SizedBox(height: 16),
        Text(
          n.title.isEmpty ? 'Notification' : n.title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          _formatFullTime(n.createdAt),
          style: TextStyle(color: Colors.grey[500], fontSize: 13),
        ),
        const SizedBox(height: 20),
        if (n.body.isNotEmpty)
          Text(
            n.body,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              height: 1.5,
            ),
          ),
        const SizedBox(height: 28),
        ..._actionButtonsFor(context, n),
      ],
    );
  }

  List<Widget> _actionButtonsFor(BuildContext context, OwnerNotification n) {
    final actions = <Widget>[];

    // Primary action — whatever is most contextual for the type.
    final primary = _primaryAction(n);
    if (primary != null) {
      actions.add(
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => _navigate(context, primary.route),
            icon: Icon(primary.icon),
            label: Text(primary.label),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1DB954),
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
      );
      actions.add(const SizedBox(height: 12));
    }

    // Always offer "dismiss".
    actions.add(
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.close),
          label: const Text('Dismiss'),
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.white,
            side: BorderSide(color: Colors.white.withOpacity(0.2)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ),
    );

    return actions;
  }

  _PrimaryAction? _primaryAction(OwnerNotification n) {
    // Prefer a resource-specific deep link from the push payload.
    final embedded = n.deepLink;
    if (embedded != null && embedded.isNotEmpty) {
      return _PrimaryAction(
        label: _labelForType(n.type),
        icon: _iconForType(n.type),
        route: embedded,
      );
    }
    final resourceId = (n.data['id'] ??
            n.data['resourceId'] ??
            n.data['notificationId'])
        ?.toString();
    if (resourceId == null || resourceId.isEmpty) return null;

    switch (n.type) {
      case NotificationType.approval:
        return _PrimaryAction(
          label: 'Review approval',
          icon: Icons.fact_check_outlined,
          route: '/owner/approvals/$resourceId',
        );
      case NotificationType.invoice:
        return _PrimaryAction(
          label: 'View invoice',
          icon: Icons.receipt_long_outlined,
          route: '/owner/invoices/$resourceId',
        );
      case NotificationType.workOrder:
        return _PrimaryAction(
          label: 'View work order',
          icon: Icons.build_circle_outlined,
          route: '/owner/work-orders/$resourceId',
        );
      case NotificationType.tenantAlert:
        return _PrimaryAction(
          label: 'View tenant',
          icon: Icons.person_outline,
          route: '/owner/tenants/$resourceId',
        );
      case NotificationType.payment:
        return _PrimaryAction(
          label: 'View payment',
          icon: Icons.payments_outlined,
          route: '/owner/payments/$resourceId',
        );
      case NotificationType.system:
      case NotificationType.unknown:
        return null;
    }
  }

  void _navigate(BuildContext context, String route) {
    // Best-effort — if the target route isn't wired in the router yet the
    // parent shell will simply show a 404 screen. Mobile companion scope is
    // intentionally narrow, so unsupported routes fall back gracefully.
    try {
      context.push(route);
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This screen is not yet available on mobile')),
      );
    }
  }

  String _labelForType(NotificationType type) {
    switch (type) {
      case NotificationType.approval:
        return 'Review approval';
      case NotificationType.invoice:
        return 'View invoice';
      case NotificationType.workOrder:
        return 'View work order';
      case NotificationType.tenantAlert:
        return 'View tenant';
      case NotificationType.payment:
        return 'View payment';
      case NotificationType.system:
      case NotificationType.unknown:
        return 'Open';
    }
  }

  IconData _iconForType(NotificationType type) {
    switch (type) {
      case NotificationType.approval:
        return Icons.fact_check_outlined;
      case NotificationType.invoice:
        return Icons.receipt_long_outlined;
      case NotificationType.workOrder:
        return Icons.build_circle_outlined;
      case NotificationType.tenantAlert:
        return Icons.person_outline;
      case NotificationType.payment:
        return Icons.payments_outlined;
      case NotificationType.system:
      case NotificationType.unknown:
        return Icons.open_in_new;
    }
  }

  String _formatFullTime(DateTime when) {
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final hh = when.hour.toString().padLeft(2, '0');
    final mm = when.minute.toString().padLeft(2, '0');
    return '${months[when.month - 1]} ${when.day}, ${when.year} $hh:$mm';
  }
}

class _PrimaryAction {
  final String label;
  final IconData icon;
  final String route;
  _PrimaryAction({required this.label, required this.icon, required this.route});
}

class _SeverityHeader extends StatelessWidget {
  final NotificationSeverity severity;
  final NotificationType type;
  const _SeverityHeader({required this.severity, required this.type});

  @override
  Widget build(BuildContext context) {
    final color = switch (severity) {
      NotificationSeverity.critical => const Color(0xFFE53935),
      NotificationSeverity.warning => const Color(0xFFFFB300),
      NotificationSeverity.info => const Color(0xFF1DB954),
    };
    final label = switch (severity) {
      NotificationSeverity.critical => 'Critical',
      NotificationSeverity.warning => 'Warning',
      NotificationSeverity.info => 'Info',
    };
    final typeLabel = type.name.replaceAll('_', ' ').toUpperCase();

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withOpacity(0.5)),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          typeLabel,
          style: TextStyle(
            color: Colors.grey[500],
            fontSize: 11,
            letterSpacing: 0.8,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
