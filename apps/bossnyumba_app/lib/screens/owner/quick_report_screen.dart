import 'package:flutter/material.dart';

class QuickReportScreen extends StatelessWidget {
  const QuickReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quick Report')),
      body: const Center(child: Text('Generate a quick report')),
    );
  }
}
