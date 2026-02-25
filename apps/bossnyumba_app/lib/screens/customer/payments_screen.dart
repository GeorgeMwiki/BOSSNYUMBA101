import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  Map<String, dynamic>? _balance;
  List<dynamic> _invoices = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      // Load balance and invoices in parallel
      final balanceResp = ApiClient.instance.get<Map<String, dynamic>>('/bff/customer-app/payments/balance');
      final invoicesResp = ApiClient.instance.get<Map<String, dynamic>>('/bff/customer-app/payments/invoices');

      final results = await Future.wait([balanceResp, invoicesResp]);

      if (!mounted) return;

      if (results[0].isOk && results[0].data != null) {
        _balance = results[0].data as Map<String, dynamic>;
      }

      if (results[1].isOk && results[1].data != null) {
        final data = results[1].data as Map<String, dynamic>;
        _invoices = data['items'] ?? data['invoices'] ?? (data is List ? data : []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Payments')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Balance card
                  if (_balance != null)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [cs.primary, cs.primary.withAlpha(200)]),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Balance Due', style: TextStyle(color: Colors.white70, fontSize: 14)),
                        const SizedBox(height: 8),
                        Text(
                          '${_balance!['currency'] ?? 'KES'} ${_formatAmount(_balance!['totalDue'] ?? _balance!['amount'] ?? 0)}',
                          style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () {},
                          style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: cs.primary),
                          child: const Text('Pay Now'),
                        ),
                      ]),
                    ),
                  const SizedBox(height: 24),

                  // Invoices
                  Text('Invoices', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  if (_invoices.isEmpty)
                    Card(child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Center(child: Column(children: [
                        Icon(Icons.receipt_long, size: 48, color: Colors.grey[600]),
                        const SizedBox(height: 12),
                        const Text('No invoices yet'),
                      ])),
                    ))
                  else
                    ..._invoices.map((inv) {
                      final m = inv as Map<String, dynamic>;
                      final amount = m['amount'] ?? m['totalAmount'] ?? 0;
                      final status = (m['status'] ?? 'PENDING').toString().toUpperCase();
                      return Card(child: ListTile(
                        leading: _statusIcon(status),
                        title: Text(m['description'] ?? 'Invoice'),
                        subtitle: Text('${m['currency'] ?? 'KES'} ${_formatAmount(amount)} • $status'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {},
                      ));
                    }),
                ],
              ),
            ),
    );
  }

  Widget _statusIcon(String status) {
    switch (status) {
      case 'PAID': return const Icon(Icons.check_circle, color: Color(0xFF10B981));
      case 'OVERDUE': return const Icon(Icons.warning, color: Color(0xFFF43F5E));
      default: return const Icon(Icons.schedule, color: Color(0xFFF59E0B));
    }
  }

  String _formatAmount(dynamic amount) {
    if (amount is num) {
      return amount.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );
    }
    return amount.toString();
  }
}
