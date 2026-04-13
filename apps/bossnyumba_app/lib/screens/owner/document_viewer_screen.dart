import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/documents/document.dart';

/// Document viewer + sign-on-the-go. Shows a document preview with
/// action bar for signing or declining.
///
/// Full PDF rendering requires `pdfx` or `flutter_pdfview` package.
/// This screen provides the structure + actions; the actual PDF widget
/// is a placeholder until the dep is added to pubspec.yaml.
class DocumentViewerScreen extends StatefulWidget {
  final String documentId;

  const DocumentViewerScreen({super.key, required this.documentId});

  @override
  State<DocumentViewerScreen> createState() => _DocumentViewerScreenState();
}

class _DocumentViewerScreenState extends State<DocumentViewerScreen> {
  Future<Map<String, dynamic>?>? _future;
  bool _signing = false;
  bool _declining = false;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<Map<String, dynamic>?> _fetch() async {
    final resp = await ApiClient.instance.get<dynamic>('/documents/${widget.documentId}');
    if (resp.isOk && resp.data is Map<String, dynamic>) {
      return resp.data as Map<String, dynamic>;
    }
    return null;
  }

  Future<void> _sign() async {
    setState(() => _signing = true);
    final resp = await ApiClient.instance.post<dynamic>(
      '/documents/${widget.documentId}/sign',
      body: {'signatureType': 'tap_to_sign'},
    );
    if (mounted) {
      setState(() => _signing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(resp.isOk ? 'Document signed' : 'Sign failed: ${resp.error}')),
      );
      if (resp.isOk) Navigator.of(context).pop(true);
    }
  }

  Future<void> _decline() async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) {
        String text = '';
        return Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Reason for declining', style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 12),
              TextField(
                autofocus: true,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Optional reason...',
                  border: OutlineInputBorder(),
                ),
                onChanged: (v) => text = v,
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(text),
                child: const Text('Confirm decline'),
              ),
            ],
          ),
        );
      },
    );
    if (reason == null) return;

    setState(() => _declining = true);
    final resp = await ApiClient.instance.post<dynamic>(
      '/documents/${widget.documentId}/decline',
      body: {'reason': reason},
    );
    if (mounted) {
      setState(() => _declining = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(resp.isOk ? 'Document declined' : 'Decline failed: ${resp.error}')),
      );
      if (resp.isOk) Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Document'),
        actions: [
          IconButton(icon: const Icon(Icons.share), onPressed: () {}),
          IconButton(icon: const Icon(Icons.download), onPressed: () {}),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final doc = snap.data;
          if (doc == null) {
            return const Center(child: Text('Document not found'));
          }

          final title = doc['title']?.toString() ?? 'Untitled';
          final status = doc['status']?.toString() ?? 'unknown';
          final signable = doc['signableByMe'] == true && status == 'pending_signature';
          final fileSize = doc['fileSize']?.toString() ?? '';
          final mimeType = doc['mimeType']?.toString() ?? '';

          return Column(
            children: [
              // Document preview area
              Expanded(
                child: Container(
                  color: Colors.grey[100],
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.picture_as_pdf, size: 64, color: Colors.red[300]),
                        const SizedBox(height: 16),
                        Text(title, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
                        const SizedBox(height: 8),
                        Text(
                          'PDF viewer requires pdfx or flutter_pdfview package',
                          style: TextStyle(color: Colors.grey[500], fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                        if (fileSize.isNotEmpty)
                          Text('$mimeType · $fileSize', style: TextStyle(color: Colors.grey[400], fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ),
              // Action bar (only for signable docs)
              if (signable)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8, offset: const Offset(0, -2))],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _declining ? null : _decline,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red,
                            minimumSize: const Size.fromHeight(48),
                          ),
                          child: _declining
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Decline'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: FilledButton(
                          onPressed: _signing ? null : _sign,
                          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                          child: _signing
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Sign document'),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
