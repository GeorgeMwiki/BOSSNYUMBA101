import 'package:flutter/material.dart';

class ApprovalDetailScreen extends StatelessWidget {
  final String approvalId;
  const ApprovalDetailScreen({super.key, required this.approvalId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Approval')),
      body: Center(child: Text('Approval $approvalId')),
    );
  }
}
