import 'package:flutter/material.dart';

class OwnerUnitDetailScreen extends StatelessWidget {
  final String unitId;
  const OwnerUnitDetailScreen({super.key, required this.unitId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Unit')),
      body: Center(child: Text('Unit $unitId')),
    );
  }
}
