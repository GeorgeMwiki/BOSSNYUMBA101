import 'package:flutter/material.dart';

class OwnerApprovalsScreen extends StatelessWidget {
  const OwnerApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Approvals')),
      body: const Center(child: Text('Pending approvals')),
    );
  }
}
