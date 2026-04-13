// Owner approvals queue — single place for "needs your sign-off" items.
//
// Shows vendor invoices over threshold, work-order quote approvals, lease
// renewals, and deposit refunds. Optimised for 30-second decisions: swipe
// right to approve, swipe left to reject, tap to see full context.
//
// The screen listens to [OrgProvider.activeOrgId] and refetches whenever
// the active org changes. A 4-second Undo snackbar sits between the user
// gesture and the actual POST, so accidental swipes don't hit the API.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/approvals/approval.dart';
import '../../core/approvals/approvals_repository.dart';
import '../../core/approvals/org_scope.dart';
import 'approval_detail_screen.dart';

/// Filter chip values. `null` == "All".
class _Filter {
  final String label;
  final ApprovalType? type;
  const _Filter(this.label, this.type);
}

const List<_Filter> _kFilters = [
  _Filter('All', null),
  _Filter('Vendor invoices', ApprovalType.vendorInvoice),
  _Filter('Work orders', ApprovalType.workOrder),
  _Filter('Leases', ApprovalType.lease),
  _Filter('Refunds', ApprovalType.refund),
];

class OwnerApprovalsScreen extends StatefulWidget {
  /// Optional repository override so tests can inject a fake.
  final ApprovalsRepository? repository;

  const OwnerApprovalsScreen({super.key, this.repository});

  @override
  State<OwnerApprovalsScreen> createState() => _OwnerApprovalsScreenState();
}

class _OwnerApprovalsScreenState extends State<OwnerApprovalsScreen> {
  late final ApprovalsRepository _repo;
  OrgProvider? _orgProvider;
  String? _lastOrgId;

  bool _loading = true;
  String? _error;
  List<Approval> _items = const [];
  _Filter _filter = _kFilters.first;

  // Search
  bool _searching = false;
  String _query = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ApprovalsRepository();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Re-wire org provider listener on every dependency change so that
    // changes to the active org trigger a refetch automatically.
    final next = _tryReadOrgProvider();
    if (!identical(next, _orgProvider)) {
      _orgProvider?.removeListener(_onOrgChanged);
      _orgProvider = next;
      _orgProvider?.addListener(_onOrgChanged);
    }
    final orgId = _orgProvider?.activeOrgId;
    if (orgId != _lastOrgId) {
      _lastOrgId = orgId;
      // Kick off initial/refetch load.
      _fetch();
    }
  }

  OrgProvider? _tryReadOrgProvider() {
    try {
      return Provider.of<OrgProvider>(context, listen: false);
    } catch (_) {
      return null;
    }
  }

  void _onOrgChanged() {
    final orgId = _orgProvider?.activeOrgId;
    if (orgId == _lastOrgId) return;
    _lastOrgId = orgId;
    _fetch();
  }

  @override
  void dispose() {
    _orgProvider?.removeListener(_onOrgChanged);
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    // Safe to setState from didChangeDependencies / callbacks; we also
    // guard with `mounted` after the async gap.
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final orgId = _orgProvider?.activeOrgId ?? '';
      final items = await _repo.listApprovals(
        type: _filter.type?.wireValue,
        activeOrgId: orgId,
      );
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _setFilter(_Filter f) {
    if (f.type == _filter.type) return;
    setState(() => _filter = f);
    _fetch();
  }

  List<Approval> get _visible {
    if (_query.isEmpty) return _items;
    final q = _query.toLowerCase();
    return _items
        .where((a) =>
            a.title.toLowerCase().contains(q) ||
            a.subtitle.toLowerCase().contains(q))
        .toList();
  }

  // --- Swipe actions -------------------------------------------------------

  /// Remove the card immediately, then queue the API call behind a 4-second
  /// Undo snackbar so the owner can cancel an accidental swipe.
  void _handleSwipe(Approval a, _SwipeAction action) {
    final originalIndex = _items.indexWhere((x) => x.id == a.id);
    if (originalIndex == -1) return;
    setState(() => _items = List.of(_items)..removeAt(originalIndex));

    final messenger = ScaffoldMessenger.of(context);
    messenger.clearSnackBars();

    bool undone = false;
    final completer = Completer<void>();

    final bar = SnackBar(
      duration: const Duration(seconds: 4),
      content: Text(action == _SwipeAction.approve
          ? 'Approving "${a.title}"'
          : 'Rejecting "${a.title}"'),
      action: SnackBarAction(
        label: 'Undo',
        onPressed: () {
          undone = true;
          setState(() {
            final list = List.of(_items);
            final insertAt =
                originalIndex <= list.length ? originalIndex : list.length;
            list.insert(insertAt, a);
            _items = list;
          });
          if (!completer.isCompleted) completer.complete();
        },
      ),
    );

    final controller = messenger.showSnackBar(bar);
    controller.closed.then((_) async {
      if (completer.isCompleted) return;
      completer.complete();
      if (undone) return;
      try {
        if (action == _SwipeAction.approve) {
          await _repo.approve(a.id);
        } else {
          await _repo.reject(a.id, reason: 'Rejected from queue');
        }
      } catch (e) {
        if (!mounted) return;
        // Restore on failure so the owner can retry.
        setState(() {
          final list = List.of(_items);
          final insertAt =
              originalIndex <= list.length ? originalIndex : list.length;
          list.insert(insertAt, a);
          _items = list;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    });
  }

  Future<void> _openDetail(Approval a) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            ApprovalDetailScreen(approval: a, repository: _repo),
      ),
    );
    if (result == true) {
      // Detail screen resolved (approved/rejected) — refetch the list.
      await _fetch();
    }
  }

  // --- UI ------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _searchCtrl,
                autofocus: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Search approvals',
                  hintStyle: TextStyle(color: Colors.white54),
                  border: InputBorder.none,
                ),
                onChanged: (v) => setState(() => _query = v),
              )
            : const Text('Approvals'),
        actions: [
          IconButton(
            tooltip: _searching ? 'Close search' : 'Search',
            icon: Icon(_searching ? Icons.close : Icons.search),
            onPressed: () {
              setState(() {
                if (_searching) {
                  _searching = false;
                  _query = '';
                  _searchCtrl.clear();
                } else {
                  _searching = true;
                }
              });
            },
          ),
        ],
      ),
      body: Column(
        children: [
          _FilterBar(
            current: _filter,
            onSelected: _setFilter,
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const _SkeletonList();
    if (_error != null) {
      return _ErrorView(message: _error!, onRetry: _fetch);
    }
    final list = _visible;
    if (list.isEmpty) return const _EmptyView();
    return RefreshIndicator(
      onRefresh: _fetch,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: list.length,
        separatorBuilder: (_, __) => const SizedBox(height: 4),
        itemBuilder: (context, i) {
          final a = list[i];
          return Dismissible(
            key: ValueKey('approval-${a.id}'),
            background: _swipeBg(
              color: Colors.green.shade700,
              icon: Icons.check,
              label: 'Approve',
              alignment: Alignment.centerLeft,
            ),
            secondaryBackground: _swipeBg(
              color: Colors.red.shade700,
              icon: Icons.close,
              label: 'Reject',
              alignment: Alignment.centerRight,
            ),
            onDismissed: (dir) => _handleSwipe(
              a,
              dir == DismissDirection.startToEnd
                  ? _SwipeAction.approve
                  : _SwipeAction.reject,
            ),
            child: ApprovalCard(
              approval: a,
              onTap: () => _openDetail(a),
            ),
          );
        },
      ),
    );
  }

  Widget _swipeBg({
    required Color color,
    required IconData icon,
    required String label,
    required Alignment alignment,
  }) {
    return Container(
      color: color,
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 8),
          Text(label,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              )),
        ],
      ),
    );
  }
}

enum _SwipeAction { approve, reject }

// ---------------------------------------------------------------------------
// ApprovalCard
// ---------------------------------------------------------------------------

class ApprovalCard extends StatelessWidget {
  final Approval approval;
  final VoidCallback? onTap;

  const ApprovalCard({super.key, required this.approval, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor:
                    theme.colorScheme.primary.withOpacity(0.15),
                child: Icon(approval.type.icon,
                    color: theme.colorScheme.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      approval.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      approval.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _timeAgo(approval.requestedAt),
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: Colors.grey),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _AmountBadge(amount: approval.amount, currency: approval.currency),
            ],
          ),
        ),
      ),
    );
  }
}

class _AmountBadge extends StatelessWidget {
  final double amount;
  final String currency;
  const _AmountBadge({required this.amount, required this.currency});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final nf = NumberFormat.currency(
      symbol: '$currency ',
      decimalDigits: 0,
    );
    Color color = theme.colorScheme.primary;
    if (amount >= 500000) {
      color = Colors.redAccent;
    } else if (amount >= 100000) {
      color = Colors.orangeAccent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        nf.format(amount),
        style: theme.textTheme.titleMedium?.copyWith(
          color: color,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

class _FilterBar extends StatelessWidget {
  final _Filter current;
  final ValueChanged<_Filter> onSelected;
  const _FilterBar({required this.current, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: [
          for (final f in _kFilters) ...[
            ChoiceChip(
              label: Text(f.label),
              selected: f.type == current.type,
              onSelected: (_) => onSelected(f),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _SkeletonList extends StatelessWidget {
  const _SkeletonList();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: 4,
      itemBuilder: (_, __) => const _SkeletonCard(),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    final base = Colors.white.withOpacity(0.08);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(radius: 22, backgroundColor: base),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(height: 14, width: 160, color: base),
                  const SizedBox(height: 6),
                  Container(height: 10, width: 120, color: base),
                  const SizedBox(height: 6),
                  Container(height: 10, width: 80, color: base),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              height: 30,
              width: 72,
              decoration: BoxDecoration(
                color: base,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: SizedBox(
          height: c.maxHeight,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.inbox_outlined,
                    size: 72, color: Colors.grey.shade600),
                const SizedBox(height: 12),
                const Text('Nothing to approve right now',
                    style: TextStyle(fontSize: 16)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final Future<void> Function() onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 56, color: Colors.redAccent),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _timeAgo(DateTime t) {
  final now = DateTime.now();
  final diff = now.difference(t);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays == 1) return 'yesterday';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return DateFormat.yMMMd().format(t);
}
