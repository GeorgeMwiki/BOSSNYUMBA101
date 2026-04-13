import 'package:flutter/material.dart';

import '../core/notifications/notifications_repository.dart';

/// Reusable row/card used by the owner inbox screen and the home dashboard's
/// "Recent alerts" section. Stateless on purpose — the parent owns the data
/// flow (repo + filter) so the same widget works in both places without any
/// context-sensitive behaviour.
class NotificationCard extends StatelessWidget {
  final OwnerNotification notification;
  final VoidCallback? onTap;
  final VoidCallback? onMarkRead;
  final bool compact;

  const NotificationCard({
    super.key,
    required this.notification,
    this.onTap,
    this.onMarkRead,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final unread = !notification.read;
    final severityColor = _severityColor(notification.severity);
    final typeIcon = _iconFor(notification.type);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          margin: EdgeInsets.only(bottom: compact ? 8 : 12),
          padding: EdgeInsets.symmetric(
            horizontal: 14,
            vertical: compact ? 10 : 14,
          ),
          decoration: BoxDecoration(
            color: const Color(0xFF282828),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: unread
                  ? severityColor.withOpacity(0.45)
                  : Colors.white.withOpacity(0.05),
              width: unread ? 1.2 : 1,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: severityColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(typeIcon, color: severityColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title.isEmpty
                                ? _fallbackTitle(notification.type)
                                : notification.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: compact ? 13 : 14,
                              fontWeight: unread
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                        if (unread)
                          Container(
                            margin: const EdgeInsets.only(left: 8),
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: severityColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    if (notification.body.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        notification.body,
                        maxLines: compact ? 1 : 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.grey[400],
                          fontSize: compact ? 12 : 13,
                          height: 1.3,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.schedule,
                            size: 12, color: Colors.grey[500]),
                        const SizedBox(width: 4),
                        Text(
                          _relativeTime(notification.createdAt),
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(width: 10),
                        if (notification.severity ==
                            NotificationSeverity.critical)
                          _SeverityChip(
                            label: 'CRITICAL',
                            color: const Color(0xFFE53935),
                          )
                        else if (notification.severity ==
                            NotificationSeverity.warning)
                          _SeverityChip(
                            label: 'WARNING',
                            color: const Color(0xFFFFB300),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _iconFor(NotificationType type) {
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
        return Icons.settings_outlined;
      case NotificationType.unknown:
        return Icons.notifications_outlined;
    }
  }

  static Color _severityColor(NotificationSeverity severity) {
    switch (severity) {
      case NotificationSeverity.critical:
        return const Color(0xFFE53935);
      case NotificationSeverity.warning:
        return const Color(0xFFFFB300);
      case NotificationSeverity.info:
        return const Color(0xFF1DB954);
    }
  }

  static String _fallbackTitle(NotificationType type) {
    switch (type) {
      case NotificationType.approval:
        return 'Approval needed';
      case NotificationType.invoice:
        return 'Invoice update';
      case NotificationType.workOrder:
        return 'Work order';
      case NotificationType.tenantAlert:
        return 'Tenant alert';
      case NotificationType.payment:
        return 'Payment update';
      case NotificationType.system:
        return 'System';
      case NotificationType.unknown:
        return 'Notification';
    }
  }

  /// Minimal relative formatter — avoids pulling `timeago` as a new dep.
  static String _relativeTime(DateTime when) {
    final diff = DateTime.now().difference(when);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    if (diff.inDays < 365) return '${(diff.inDays / 30).floor()}mo ago';
    return '${(diff.inDays / 365).floor()}y ago';
  }
}

class _SeverityChip extends StatelessWidget {
  final String label;
  final Color color;
  const _SeverityChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.5), width: 0.5),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
