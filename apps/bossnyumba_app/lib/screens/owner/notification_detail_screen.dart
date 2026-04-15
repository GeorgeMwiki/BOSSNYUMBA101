import 'package:flutter/material.dart';

class NotificationDetailScreen extends StatelessWidget {
  final String notificationId;
  const NotificationDetailScreen({super.key, required this.notificationId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notification')),
      body: Center(child: Text('Notification $notificationId')),
    );
  }
}
