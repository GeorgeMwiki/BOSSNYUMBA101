import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/invoices_service.dart';
import '../../core/api_client.dart';
import '../../l10n/generated/app_localizations.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.paymentsTitle)),
      body: FutureBuilder<ApiResponse<List<dynamic>>>(
        future: InvoicesService().listMine(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError || !snap.data!.isOk) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(snap.data?.error ?? snap.error?.toString() ?? l10n.stateFailedToLoad),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => setState(() {}),
                    child: Text(l10n.actionRetry),
                  ),
                ],
              ),
            );
          }
          final invoices = snap.data!.data ?? [];
          if (invoices.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(l10n.paymentsEmpty),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: invoices.length,
            itemBuilder: (_, i) {
              final inv = invoices[i] as Map<String, dynamic>;
              final amount = inv['amount'] ?? inv['totalAmount'] ?? 0;
              final status = inv['status'] ?? 'PENDING';
              return Card(
                child: ListTile(
                  title: Text('${inv['description'] ?? l10n.paymentsInvoiceFallback}'),
                  subtitle: Text(
                    '$amount ${inv['currency'] ?? 'KES'} • $status',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
              );
            },
          );
        },
      ),
    );
  }
}
