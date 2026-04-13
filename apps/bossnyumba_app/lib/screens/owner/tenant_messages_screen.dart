import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/org_provider.dart';
import '../../widgets/chat_bubble.dart';

/// AI-triaged tenant message inbox. Messages are tagged by AI:
/// urgent (red), needs-reply (amber), info (blue), complaint (purple).
class TenantMessagesScreen extends StatefulWidget {
  const TenantMessagesScreen({super.key});

  @override
  State<TenantMessagesScreen> createState() => _TenantMessagesScreenState();
}

class _TenantMessagesScreenState extends State<TenantMessagesScreen> {
  String? _filterTag;
  Future<List<_Thread>>? _future;
  String? _lastOrgId;

  Future<List<_Thread>> _fetch() async {
    final params = <String, String>{'limit': '30'};
    if (_filterTag != null) params['tag'] = _filterTag!;
    final resp = await ApiClient.instance.get<dynamic>('/messages/threads', queryParams: params);
    if (!resp.isOk || resp.data == null) return [];
    final list = resp.data is List ? resp.data as List : [];
    return list
        .map((e) => e is Map<String, dynamic> ? _Thread.fromJson(e) : null)
        .whereType<_Thread>()
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final orgId = context.watch<OrgProvider>().activeOrgId;
    if (_future == null || orgId != _lastOrgId) {
      _lastOrgId = orgId;
      _future = _fetch();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
      ),
      body: Column(
        children: [
          // Filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _FilterChip(label: 'All', selected: _filterTag == null, onTap: () => setState(() { _filterTag = null; _future = _fetch(); })),
                _FilterChip(label: 'Urgent', selected: _filterTag == 'urgent', color: Colors.red, onTap: () => setState(() { _filterTag = 'urgent'; _future = _fetch(); })),
                _FilterChip(label: 'Needs reply', selected: _filterTag == 'needs_reply', color: Colors.amber, onTap: () => setState(() { _filterTag = 'needs_reply'; _future = _fetch(); })),
                _FilterChip(label: 'Info', selected: _filterTag == 'info', color: Colors.blue, onTap: () => setState(() { _filterTag = 'info'; _future = _fetch(); })),
                _FilterChip(label: 'Complaint', selected: _filterTag == 'complaint', color: Colors.purple, onTap: () => setState(() { _filterTag = 'complaint'; _future = _fetch(); })),
              ],
            ),
          ),
          // Thread list
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                final f = _fetch();
                setState(() => _future = f);
                await f;
              },
              child: FutureBuilder<List<_Thread>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final threads = snap.data ?? [];
                  if (threads.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 100),
                      Center(child: Text('No messages')),
                    ]);
                  }
                  return ListView.separated(
                    itemCount: threads.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final t = threads[i];
                      return ListTile(
                        leading: CircleAvatar(child: Text(t.tenantInitials)),
                        title: Row(
                          children: [
                            Expanded(child: Text(t.tenantName, style: const TextStyle(fontWeight: FontWeight.w600))),
                            _TagPill(tag: t.aiTag),
                          ],
                        ),
                        subtitle: Text(t.lastMessage, maxLines: 1, overflow: TextOverflow.ellipsis),
                        trailing: Text(t.timeAgo, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        onTap: () {
                          Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => _ThreadDetailScreen(threadId: t.id, tenantName: t.tenantName),
                          ));
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// -------------------------------------------------------------------------
// Thread detail with AI-suggested replies
// -------------------------------------------------------------------------

class _ThreadDetailScreen extends StatefulWidget {
  final String threadId;
  final String tenantName;

  const _ThreadDetailScreen({required this.threadId, required this.tenantName});

  @override
  State<_ThreadDetailScreen> createState() => _ThreadDetailScreenState();
}

class _ThreadDetailScreenState extends State<_ThreadDetailScreen> {
  final _controller = TextEditingController();
  Future<List<_Message>>? _messagesFuture;
  Future<List<String>>? _suggestionsFuture;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _messagesFuture = _fetchMessages();
    _suggestionsFuture = _fetchSuggestions();
  }

  Future<List<_Message>> _fetchMessages() async {
    final resp = await ApiClient.instance.get<dynamic>('/messages/threads/${widget.threadId}/messages');
    if (!resp.isOk || resp.data == null) return [];
    final list = resp.data is List ? resp.data as List : [];
    return list.map((e) => e is Map<String, dynamic> ? _Message.fromJson(e) : null).whereType<_Message>().toList();
  }

  Future<List<String>> _fetchSuggestions() async {
    final resp = await ApiClient.instance.get<dynamic>('/ai/copilot/suggestions', queryParams: {'threadId': widget.threadId});
    if (!resp.isOk || resp.data == null) return ['Thank you for reaching out.', 'I will look into this.', 'Please call our office.'];
    final list = resp.data is List ? resp.data as List : [];
    return list.map((e) => e.toString()).toList();
  }

  Future<void> _send() async {
    final body = _controller.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    await ApiClient.instance.post<dynamic>('/messages/threads/${widget.threadId}/reply', body: {'body': body});
    _controller.clear();
    setState(() {
      _sending = false;
      _messagesFuture = _fetchMessages();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.tenantName)),
      body: Column(
        children: [
          // Messages
          Expanded(
            child: FutureBuilder<List<_Message>>(
              future: _messagesFuture,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final messages = snap.data ?? [];
                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.all(12),
                  itemCount: messages.length,
                  itemBuilder: (context, i) {
                    final m = messages[messages.length - 1 - i];
                    return Align(
                      alignment: m.isOwner ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: m.isOwner ? Theme.of(context).colorScheme.primary : Colors.grey[200],
                          borderRadius: BorderRadius.circular(16),
                        ),
                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                        child: Text(
                          m.body,
                          style: TextStyle(color: m.isOwner ? Colors.white : Colors.black87),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          // AI-suggested replies
          FutureBuilder<List<String>>(
            future: _suggestionsFuture,
            builder: (context, snap) {
              final suggestions = snap.data ?? [];
              if (suggestions.isEmpty) return const SizedBox();
              return SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Row(
                  children: suggestions.map((s) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ActionChip(
                      label: Text(s, style: const TextStyle(fontSize: 12)),
                      onPressed: () => _controller.text = s,
                    ),
                  )).toList(),
                ),
              );
            },
          ),
          // Input bar
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4, offset: const Offset(0, -1))],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: 'Type a reply...',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// -------------------------------------------------------------------------
// Internal models
// -------------------------------------------------------------------------

class _Thread {
  final String id;
  final String tenantName;
  final String lastMessage;
  final String aiTag;
  final DateTime lastMessageAt;

  _Thread({required this.id, required this.tenantName, required this.lastMessage, required this.aiTag, required this.lastMessageAt});

  String get tenantInitials {
    final parts = tenantName.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return tenantName.isNotEmpty ? tenantName[0].toUpperCase() : '?';
  }

  String get timeAgo {
    final diff = DateTime.now().difference(lastMessageAt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${diff.inDays}d';
  }

  factory _Thread.fromJson(Map<String, dynamic> json) => _Thread(
    id: json['id']?.toString() ?? '',
    tenantName: json['tenantName']?.toString() ?? 'Unknown',
    lastMessage: json['lastMessage']?.toString() ?? '',
    aiTag: json['aiTag']?.toString() ?? 'info',
    lastMessageAt: DateTime.tryParse(json['lastMessageAt']?.toString() ?? '') ?? DateTime.now(),
  );
}

class _Message {
  final String body;
  final bool isOwner;
  _Message({required this.body, required this.isOwner});

  factory _Message.fromJson(Map<String, dynamic> json) => _Message(
    body: json['body']?.toString() ?? '',
    isOwner: json['sender'] == 'owner' || json['isOwner'] == true,
  );
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({required this.label, required this.selected, this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        selectedColor: color?.withOpacity(0.2),
        onSelected: (_) => onTap(),
      ),
    );
  }
}

class _TagPill extends StatelessWidget {
  final String tag;
  const _TagPill({required this.tag});

  Color get _color {
    switch (tag) {
      case 'urgent': return Colors.red;
      case 'needs_reply': return Colors.amber;
      case 'info': return Colors.blue;
      case 'complaint': return Colors.purple;
      default: return Colors.grey;
    }
  }

  String get _label {
    switch (tag) {
      case 'urgent': return 'Urgent';
      case 'needs_reply': return 'Reply';
      case 'info': return 'Info';
      case 'complaint': return 'Issue';
      default: return tag;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: _color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(_label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _color)),
    );
  }
}
