import 'package:flutter/material.dart';

class DocumentViewerScreen extends StatelessWidget {
  final String documentId;
  const DocumentViewerScreen({super.key, required this.documentId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Document')),
      body: Center(child: Text('Document $documentId')),
    );
  }
}
