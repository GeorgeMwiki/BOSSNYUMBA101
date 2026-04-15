import 'package:flutter/material.dart';

class MorningBriefingScreen extends StatelessWidget {
  const MorningBriefingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Morning Briefing')),
      body: const Center(child: Text('Today at a glance')),
    );
  }
}
