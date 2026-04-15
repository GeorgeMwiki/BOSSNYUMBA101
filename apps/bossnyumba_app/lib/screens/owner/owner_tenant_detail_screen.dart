import 'package:flutter/material.dart';

class OwnerTenantDetailScreen extends StatelessWidget {
  final String tenantId;
  const OwnerTenantDetailScreen({super.key, required this.tenantId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tenant')),
      body: Center(child: Text('Tenant $tenantId')),
    );
  }
}
