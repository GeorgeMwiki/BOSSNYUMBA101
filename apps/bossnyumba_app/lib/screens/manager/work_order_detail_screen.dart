import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/services/work_orders_service.dart';
import '../../core/api_client.dart';

class WorkOrderDetailScreen extends StatefulWidget {
  final String workOrderId;

  const WorkOrderDetailScreen({super.key, required this.workOrderId});

  @override
  State<WorkOrderDetailScreen> createState() => _WorkOrderDetailScreenState();
}

class _WorkOrderDetailScreenState extends State<WorkOrderDetailScreen> {
  final _svc = WorkOrdersService();
  Future<ApiResponse<Map<String, dynamic>>>? _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _svc.getById(widget.workOrderId);
  }

  void _reload() {
    setState(() {
      _future = _svc.getById(widget.workOrderId);
    });
  }

  Future<void> _withBusy(Future<ApiResponse<Map<String, dynamic>>> Function() op, String successMsg) async {
    setState(() => _busy = true);
    final resp = await op();
    if (!mounted) return;
    setState(() => _busy = false);
    if (resp.isOk) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMsg)));
      _reload();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(resp.error ?? 'Action failed')),
      );
    }
  }

  Future<void> _start() => _withBusy(() => _svc.start(widget.workOrderId), 'Work started');

  /// Opens a bottom sheet that lets the technician attach proof photos and a
  /// note, then submits via [WorkOrdersService.completeWithProof].
  Future<void> _completeWithProof() async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetCtx) => _CompleteWithProofSheet(workOrderId: widget.workOrderId, svc: _svc),
    );
    if (!mounted) return;
    if (result == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Work order completed')),
      );
      _reload();
      // Pop and return true so the parent list refreshes.
      Navigator.of(context).pop(true);
    }
  }

  Future<void> _assignSelf() async {
    await _withBusy(
      () => _svc.assign(widget.workOrderId, assignedToUserId: 'self'),
      'Assigned',
    );
  }

  Widget _actionsFor(String status) {
    final s = status.toLowerCase();
    final actions = <Widget>[];
    if (['assigned', 'scheduled', 'approved'].contains(s)) {
      actions.add(FilledButton.icon(
        onPressed: _busy ? null : _start,
        icon: const Icon(Icons.play_arrow),
        label: const Text('Start'),
      ));
    }
    if (s == 'in_progress') {
      actions.add(FilledButton.icon(
        onPressed: _busy ? null : _completeWithProof,
        icon: const Icon(Icons.photo_camera),
        label: const Text('Complete with proof'),
      ));
    }
    if (['submitted', 'triaged', 'approved'].contains(s)) {
      actions.add(OutlinedButton.icon(
        onPressed: _busy ? null : _assignSelf,
        icon: const Icon(Icons.assignment_ind),
        label: const Text('Assign to me'),
      ));
    }
    if (actions.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Wrap(spacing: 12, runSpacing: 12, children: actions),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Work Order')),
      body: FutureBuilder<ApiResponse<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snap.hasData || !snap.data!.isOk) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(snap.data?.error ?? snap.error?.toString() ?? 'Failed to load'),
              ),
            );
          }
          final wo = snap.data!.data!;
          final status = (wo['status'] ?? 'SUBMITTED').toString();
          final priority = (wo['priority'] ?? 'MEDIUM').toString();
          final category = (wo['category'] ?? 'OTHER').toString();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                (wo['workOrderNumber'] ?? wo['ticketNumber'] ?? '').toString(),
                style: Theme.of(context).textTheme.labelSmall,
              ),
              const SizedBox(height: 4),
              Text(
                (wo['title'] ?? 'Work Order').toString(),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                Chip(label: Text(status)),
                Chip(label: Text(priority)),
                Chip(label: Text(category)),
              ]),
              if (wo['description'] != null) ...[
                const SizedBox(height: 16),
                Text('Description', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['description'].toString()),
              ],
              if (wo['location'] != null) ...[
                const SizedBox(height: 16),
                Text('Location', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['location'].toString()),
              ],
              if (wo['scheduledDate'] != null) ...[
                const SizedBox(height: 16),
                Text('Scheduled', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['scheduledDate'].toString()),
              ],
              if (wo['completionNotes'] != null) ...[
                const SizedBox(height: 16),
                Text('Completion notes', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(wo['completionNotes'].toString()),
              ],
              _actionsFor(status),
            ],
          );
        },
      ),
    );
  }
}

/// Bottom-sheet form for capturing proof photos + a completion note and
/// uploading them via multipart. Stays open on failure for retry.
class _CompleteWithProofSheet extends StatefulWidget {
  final String workOrderId;
  final WorkOrdersService svc;

  const _CompleteWithProofSheet({required this.workOrderId, required this.svc});

  @override
  State<_CompleteWithProofSheet> createState() => _CompleteWithProofSheetState();
}

class _CompleteWithProofSheetState extends State<_CompleteWithProofSheet> {
  final _picker = ImagePicker();
  final _notesCtrl = TextEditingController();
  final List<XFile> _photos = [];
  bool _uploading = false;
  String? _error;

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhotos() async {
    try {
      final picked = await _picker.pickMultiImage(imageQuality: 75, maxWidth: 1600);
      if (picked.isEmpty) return;
      setState(() => _photos.addAll(picked));
    } catch (e) {
      setState(() => _error = 'Could not open gallery: $e');
    }
  }

  void _removeAt(int idx) {
    setState(() => _photos.removeAt(idx));
  }

  Future<void> _submit() async {
    if (_photos.isEmpty) {
      setState(() => _error = 'Add at least one proof photo.');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
    });

    // Convert XFile list to MultipartFile bytes payload.
    final List<http.MultipartFile> files = [];
    for (var i = 0; i < _photos.length; i++) {
      final xf = _photos[i];
      final Uint8List bytes = await xf.readAsBytes();
      final mime = xf.mimeType ?? _guessMime(xf.name);
      final parts = mime.split('/');
      files.add(http.MultipartFile.fromBytes(
        'photos',
        bytes,
        filename: xf.name.isNotEmpty ? xf.name : 'proof_$i.jpg',
        contentType: parts.length == 2 ? MediaType(parts[0], parts[1]) : MediaType('image', 'jpeg'),
      ));
    }

    final resp = await widget.svc.completeWithProof(
      widget.workOrderId,
      completionNotes: _notesCtrl.text.trim(),
      photos: files,
    );

    if (!mounted) return;
    if (resp.isOk) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _uploading = false;
      _error = resp.error ?? 'Upload failed';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_error!)),
    );
  }

  String _guessMime(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.heic')) return 'image/heic';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.task_alt),
                const SizedBox(width: 8),
                Text('Complete with proof',
                    style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  onPressed: _uploading ? null : () => Navigator.pop(context, false),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _uploading ? null : _pickPhotos,
              icon: const Icon(Icons.add_a_photo_outlined),
              label: Text(_photos.isEmpty
                  ? 'Add proof photos'
                  : 'Add more (${_photos.length} selected)'),
            ),
            const SizedBox(height: 12),
            if (_photos.isNotEmpty) _PhotoGrid(photos: _photos, onRemove: _removeAt, disabled: _uploading),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              maxLines: 4,
              enabled: !_uploading,
              decoration: const InputDecoration(
                labelText: 'Completion notes',
                hintText: 'Describe what was done',
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 16),
            if (_uploading)
              Column(
                children: const [
                  LinearProgressIndicator(),
                  SizedBox(height: 8),
                  Text('Uploading proof…'),
                ],
              )
            else
              FilledButton.icon(
                onPressed: _submit,
                icon: const Icon(Icons.cloud_upload),
                label: const Text('Submit completion'),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _PhotoGrid extends StatelessWidget {
  final List<XFile> photos;
  final void Function(int) onRemove;
  final bool disabled;

  const _PhotoGrid({required this.photos, required this.onRemove, required this.disabled});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: photos.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemBuilder: (ctx, i) {
        final xf = photos[i];
        return Stack(
          fit: StackFit.expand,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: FutureBuilder<Uint8List>(
                future: xf.readAsBytes(),
                builder: (ctx, snap) {
                  if (!snap.hasData) {
                    return Container(color: Colors.black12);
                  }
                  return Image.memory(snap.data!, fit: BoxFit.cover);
                },
              ),
            ),
            Positioned(
              top: 2,
              right: 2,
              child: Material(
                color: Colors.black54,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: disabled ? null : () => onRemove(i),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(Icons.close, size: 14, color: Colors.white),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// Silence unused-import warnings if kDebugMode-only logging gets stripped.
// ignore: unused_element
void _silenceDebug() {
  if (kDebugMode) debugPrint('proof sheet ready');
}
