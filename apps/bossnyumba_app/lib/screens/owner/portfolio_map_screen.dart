import 'package:flutter/material.dart';

class PortfolioMapScreen extends StatelessWidget {
  const PortfolioMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Portfolio Map')),
      body: const Center(child: Text('Map of properties')),
    );
  }
}
