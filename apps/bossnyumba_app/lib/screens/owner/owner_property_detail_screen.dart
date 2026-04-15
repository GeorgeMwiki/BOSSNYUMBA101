import 'package:flutter/material.dart';

class OwnerPropertyDetailScreen extends StatelessWidget {
  final String propertyId;
  const OwnerPropertyDetailScreen({super.key, required this.propertyId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Property')),
      body: Center(child: Text('Property $propertyId')),
    );
  }
}
