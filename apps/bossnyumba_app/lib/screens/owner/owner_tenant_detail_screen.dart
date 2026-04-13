import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../widgets/contact_action_buttons.dart';

/// "In-a-meeting needs answers" tenant detail surface. The above-the-fold
/// section is deliberately dense: avatar, contact buttons, status pill and a
/// 2x2 quick-stats grid. Scrollable sections live below.
class OwnerTenantDetailScreen extends StatefulWidget {
  final String tenantId;
  final String? initialName;
  final ApiClient? apiClient;

  const OwnerTenantDetailScreen({
    super.key,
    required this.tenantId,
    this.initialName,
    this.apiClient,
  });

  @override
  State<OwnerTenantDetailScreen> createState() =>
      _OwnerTenantDetailScreenState();
}

class _OwnerTenantDetailScreenState extends State<OwnerTenantDetailScreen> {
  late final ApiClient _api;

  Map<String, dynamic>? _tenant;
  List<dynamic> _payments = [];
  List<dynamic> _tickets = [];
  List<dynamic> _notes = [];
  List<dynamic> _documents = [];

  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = widget.apiClient ?? ApiClient.instance;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final id = widget.tenantId;
    final tenantResp = await _api.get<Map<String, dynamic>>('/tenants/$id');
    final paymentsResp =
        await _api.get<Map<String, dynamic>>('/tenants/$id/payments');
    final ticketsResp =
        await _api.get<Map<String, dynamic>>('/tenants/$id/tickets');
    final notesResp =
        await _api.get<Map<String, dynamic>>('/tenants/$id/notes');
    final docsResp =
        await _api.get<Map<String, dynamic>>('/tenants/$id/documents');

    if (!mounted) return;

    setState(() {
      _tenant = tenantResp.isOk ? tenantResp.data : null;
      _payments = _asList(paymentsResp.data).take(12).toList();
      _tickets = _asList(ticketsResp.data).take(5).toList();
      _notes = _asList(notesResp.data);
      _documents = _asList(docsResp.data);
      _loading = false;
      _error = tenantResp.isOk ? null : tenantResp.error;
    });
  }

  List<dynamic> _asList(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map && raw['items'] is List) return raw['items'] as List;
    return const [];
  }

  String _displayName() {
    final t = _tenant;
    if (t == null) return widget.initialName ?? 'Tenant';
    final fn = (t['firstName'] ?? '').toString();
    final ln = (t['lastName'] ?? '').toString();
    final combined = ('$fn $ln').trim();
    return combined.isNotEmpty
        ? combined
        : (t['name']?.toString() ?? widget.initialName ?? 'Tenant');
  }

  @override
  Widget build(BuildContext context) {
    final name = _displayName();
    return Scaffold(
      appBar: AppBar(
        title: Text(name),
        actions: [
          PopupMenuButton<String>(
            onSelected: _onMenuSelected,
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'message', child: Text('Send message')),
              PopupMenuItem(value: 'call', child: Text('Schedule call')),
              PopupMenuItem(value: 'note', child: Text('Add note')),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _buildContent(context, name),
                ),
    );
  }

  void _onMenuSelected(String v) {
    final messenger = ScaffoldMessenger.of(context);
    switch (v) {
      case 'message':
        messenger.showSnackBar(const SnackBar(content: Text('Open message composer')));
        break;
      case 'call':
        messenger.showSnackBar(const SnackBar(content: Text('Schedule a call')));
        break;
      case 'note':
        messenger.showSnackBar(const SnackBar(content: Text('Add a note')));
        break;
    }
  }

  Widget _buildError() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SizedBox(height: 64),
        const Icon(Icons.error_outline, size: 48),
        const SizedBox(height: 8),
        Center(child: Text(_error ?? 'Failed to load tenant')),
        const SizedBox(height: 16),
        Center(
          child: OutlinedButton(onPressed: _load, child: const Text('Retry')),
        ),
      ],
    );
  }

  Widget _buildContent(BuildContext context, String name) {
    final tenant = _tenant ?? const <String, dynamic>{};
    final role = tenant['role']?.toString() ?? 'Tenant';
    final phone = tenant['phone']?.toString();
    final email = tenant['email']?.toString();
    final status = tenant['status']?.toString() ?? 'active';

    final balance = (tenant['currentBalance'] as num?)?.toDouble() ?? 0;
    final lastPayment = tenant['lastPayment'] as Map<String, dynamic>?;
    final leaseEnds = tenant['leaseEndDate']?.toString();
    final daysLate = (tenant['daysLate'] as num?)?.toInt() ?? 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ------- Above-the-fold -------
        Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundImage: (tenant['avatarUrl'] != null)
                  ? NetworkImage(tenant['avatarUrl'] as String)
                  : null,
              child: tenant['avatarUrl'] == null
                  ? Text(
                      _initials(name),
                      style: Theme.of(context).textTheme.titleLarge,
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: Theme.of(context).textTheme.titleLarge,
                      overflow: TextOverflow.ellipsis),
                  Text(role,
                      style: Theme.of(context).textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ContactActionButtons(
          tenantName: name,
          phone: phone,
          email: email,
        ),
        const SizedBox(height: 12),
        _StatusPill(status: status),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.1,
          children: [
            _QuickStat(
              label: 'Current balance',
              value: _money(balance),
              accent: balance > 0 ? Colors.red : Colors.green,
            ),
            _QuickStat(
              label: 'Last payment',
              value: lastPayment == null
                  ? '—'
                  : _money((lastPayment['amount'] as num?)?.toDouble() ?? 0),
              sub: lastPayment == null
                  ? null
                  : _shortDate(lastPayment['date']?.toString()),
            ),
            _QuickStat(
              label: 'Lease ends',
              value: _shortDate(leaseEnds) ?? '—',
            ),
            _QuickStat(
              label: 'Days late',
              value: daysLate.toString(),
              accent: daysLate > 0 ? Colors.red : null,
            ),
          ],
        ),

        const SizedBox(height: 24),
        const Divider(),

        // ------- Below-the-fold -------
        _SectionTitle('Lease'),
        _LeaseCard(tenant: tenant),

        const SizedBox(height: 16),
        _SectionTitle('Payment history'),
        if (_payments.isEmpty)
          const Text('No payments recorded')
        else
          ..._payments.map((p) {
            final m = p as Map<String, dynamic>;
            return ListTile(
              leading: const Icon(Icons.payments),
              title: Text(_money((m['amount'] as num?)?.toDouble() ?? 0)),
              subtitle: Text(
                '${_shortDate(m['date']?.toString()) ?? '—'} • '
                '${m['method']?.toString() ?? '—'}',
              ),
              trailing: Text(m['status']?.toString() ?? ''),
            );
          }),

        const SizedBox(height: 16),
        _SectionTitle('Open tickets'),
        if (_tickets.isEmpty)
          const Text('No open tickets')
        else
          ..._tickets.map((t) {
            final m = t as Map<String, dynamic>;
            return ListTile(
              leading: const Icon(Icons.build_circle),
              title: Text(m['title']?.toString() ?? 'Ticket'),
              subtitle: Text(m['status']?.toString() ?? ''),
              trailing: Text(_shortDate(m['openedAt']?.toString()) ?? ''),
            );
          }),

        const SizedBox(height: 16),
        _SectionTitle('Notes'),
        if (_notes.isEmpty)
          const Text('No notes yet')
        else
          ..._notes.map((n) {
            final m = n as Map<String, dynamic>;
            final pinned = m['pinned'] == true;
            return Card(
              child: ListTile(
                leading: Icon(pinned ? Icons.push_pin : Icons.note),
                title: Text(m['body']?.toString() ?? ''),
                subtitle: Text(
                  '${m['author']?.toString() ?? 'Owner'} • '
                  '${_shortDate(m['createdAt']?.toString()) ?? ''}',
                ),
              ),
            );
          }),

        const SizedBox(height: 16),
        _SectionTitle('Documents'),
        if (_documents.isEmpty)
          const Text('No documents attached')
        else
          ..._documents.map((d) {
            final m = d as Map<String, dynamic>;
            return ListTile(
              leading: const Icon(Icons.description),
              title: Text(m['name']?.toString() ?? 'Document'),
              subtitle: Text(m['type']?.toString() ?? ''),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            );
          }),
        const SizedBox(height: 32),
      ],
    );
  }

  String _initials(String name) {
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String _money(double v) => NumberFormat.currency(symbol: 'KSh ').format(v);

  String? _shortDate(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    try {
      final d = DateTime.parse(iso);
      return DateFormat.yMMMd().format(d);
    } catch (_) {
      return iso;
    }
  }
}

class _SectionTitle extends StatelessWidget {
  final String label;
  const _SectionTitle(this.label);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        label,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;
    switch (status.toLowerCase()) {
      case 'late':
        bg = Colors.red.shade100;
        fg = Colors.red.shade900;
        label = 'Late';
        break;
      case 'notice':
      case 'notice_given':
      case 'notice given':
        bg = Colors.amber.shade100;
        fg = Colors.amber.shade900;
        label = 'Notice given';
        break;
      case 'eviction':
        bg = Colors.deepOrange.shade100;
        fg = Colors.deepOrange.shade900;
        label = 'Eviction';
        break;
      default:
        bg = Colors.green.shade100;
        fg = Colors.green.shade900;
        label = 'Active';
    }
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(color: fg, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _QuickStat extends StatelessWidget {
  final String label;
  final String value;
  final String? sub;
  final Color? accent;

  const _QuickStat({
    required this.label,
    required this.value,
    this.sub,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 4),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: accent,
                  ),
              overflow: TextOverflow.ellipsis,
            ),
            if (sub != null)
              Text(sub!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _LeaseCard extends StatelessWidget {
  final Map<String, dynamic> tenant;
  const _LeaseCard({required this.tenant});

  @override
  Widget build(BuildContext context) {
    final unit = tenant['unit']?.toString() ?? tenant['unitLabel']?.toString() ?? '—';
    final property = tenant['property']?.toString() ?? tenant['propertyName']?.toString() ?? '—';
    final rent = (tenant['monthlyRent'] as num?)?.toDouble() ?? 0;
    final deposit = (tenant['deposit'] as num?)?.toDouble() ?? 0;
    final start = tenant['leaseStartDate']?.toString() ?? '—';
    final end = tenant['leaseEndDate']?.toString() ?? '—';
    final money = NumberFormat.currency(symbol: 'KSh ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$unit @ $property',
                style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            Text('Rent: ${money.format(rent)}/month'),
            Text('Deposit: ${money.format(deposit)}'),
            Text('Lease: $start  →  $end'),
          ],
        ),
      ),
    );
  }
}
