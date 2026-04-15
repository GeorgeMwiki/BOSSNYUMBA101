import 'package:flutter/material.dart';

class NotificationsInboxScreen extends StatelessWidget {
  const NotificationsInboxScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: const Center(child: Text('Inbox')),
    );
  }
}
