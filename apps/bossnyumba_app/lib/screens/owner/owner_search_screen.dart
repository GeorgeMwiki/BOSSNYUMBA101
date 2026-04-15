import 'package:flutter/material.dart';

class OwnerSearchScreen extends StatelessWidget {
  const OwnerSearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: const Center(child: Text('Search portfolio')),
    );
  }
}
