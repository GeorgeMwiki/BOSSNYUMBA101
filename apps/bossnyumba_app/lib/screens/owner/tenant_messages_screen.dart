import 'package:flutter/material.dart';

class TenantMessagesScreen extends StatelessWidget {
  const TenantMessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tenant Messages')),
      body: const Center(child: Text('Conversations with tenants')),
    );
  }
}
