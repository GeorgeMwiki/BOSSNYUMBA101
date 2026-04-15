// Owner AI Copilot Screen
//
// Journey:
//   Owner opens AI tab → sees chat interface with suggested prompts
//   Types question → taps send → POST /ai/copilot/chat
//   Response streams in via SSE (JSON fallback if server doesn't stream)
//   History persisted to SharedPreferences (keyed by userId + activeOrgId)
//   Long-press message: Copy / Re-ask
//   Tap speaker icon on assistant message: TTS read-aloud

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:provider/provider.dart';

import '../../core/auth_provider.dart';
import '../../core/services/ai_chat_repository.dart';

class OwnerAiScreen extends StatefulWidget {
  const OwnerAiScreen({super.key});

  @override
  State<OwnerAiScreen> createState() => _OwnerAiScreenState();
}

class _OwnerAiScreenState extends State<OwnerAiScreen> {
  final AiChatRepository _repo = AiChatRepository();
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final FlutterTts _tts = FlutterTts();

  List<AiChatMessage> _messages = [];
  List<String> _suggestions = [];
  bool _loading = true;
  bool _streaming = false;
  String _streamingBuffer = '';
  StreamSubscription<AiChatEvent>? _sub;

  String get _userId => context.read<AuthProvider>().session?.id ?? 'anon';
  String get _orgId => context.read<AuthProvider>().session?.tenantId ?? 'default';
  String? get _token => null; // ApiClient already injects auth header

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final history = await _repo.loadHistory(_userId, _orgId);
    final suggestions = await _repo.fetchSuggestedPrompts(_orgId);
    if (!mounted) return;
    setState(() {
      _messages = history;
      _suggestions = suggestions;
      _loading = false;
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _input.dispose();
    _scroll.dispose();
    _tts.stop();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _streaming) return;
    _input.clear();

    final userMsg = AiChatMessage(
      role: 'user',
      content: trimmed,
      timestamp: DateTime.now(),
    );
    setState(() {
      _messages = [..._messages, userMsg];
      _streaming = true;
      _streamingBuffer = '';
    });
    _scrollToEnd();

    _sub?.cancel();
    _sub = _repo
        .chat(
          history: _messages,
          prompt: trimmed,
          activeOrgId: _orgId,
          authToken: _token,
        )
        .listen(
      (event) {
        if (!mounted) return;
        if (event.type == 'delta' && event.text != null) {
          setState(() => _streamingBuffer += event.text!);
          _scrollToEnd();
        } else if (event.type == 'done') {
          _finalizeAssistant();
        } else if (event.type == 'error') {
          setState(() {
            _streaming = false;
            _messages = [
              ..._messages,
              AiChatMessage(
                role: 'assistant',
                content: 'Error: ${event.message}',
                timestamp: DateTime.now(),
              ),
            ];
          });
          _persist();
        }
      },
      onDone: () {
        if (_streaming) _finalizeAssistant();
      },
      onError: (e) {
        if (!mounted) return;
        setState(() {
          _streaming = false;
          _messages = [
            ..._messages,
            AiChatMessage(
              role: 'assistant',
              content: 'Error: $e',
              timestamp: DateTime.now(),
            ),
          ];
        });
        _persist();
      },
    );
  }

  void _finalizeAssistant() {
    if (!_streaming) return;
    final content = _streamingBuffer.trim();
    setState(() {
      if (content.isNotEmpty) {
        _messages = [
          ..._messages,
          AiChatMessage(
            role: 'assistant',
            content: content,
            timestamp: DateTime.now(),
          ),
        ];
      }
      _streaming = false;
      _streamingBuffer = '';
    });
    _persist();
    _scrollToEnd();
  }

  Future<void> _persist() => _repo.saveHistory(_userId, _orgId, _messages);

  Future<void> _readAloud(String text) async {
    await _tts.stop();
    await _tts.setSpeechRate(0.5);
    await _tts.speak(text);
  }

  Future<void> _clear() async {
    await _repo.clearHistory(_userId, _orgId);
    setState(() => _messages = []);
  }

  void _showMessageMenu(AiChatMessage msg) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.copy),
              title: const Text('Copy'),
              onTap: () {
                Clipboard.setData(ClipboardData(text: msg.content));
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copied')),
                );
              },
            ),
            if (msg.role == 'user')
              ListTile(
                leading: const Icon(Icons.refresh),
                title: const Text('Re-ask'),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _send(msg.content);
                },
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Copilot'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep_outlined),
            tooltip: 'Clear conversation',
            onPressed: _messages.isEmpty ? null : _clear,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty && !_streaming
                ? _buildEmptyState()
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length + (_streaming ? 1 : 0),
                    itemBuilder: (ctx, i) {
                      if (i < _messages.length) {
                        return _buildBubble(_messages[i]);
                      }
                      return _buildStreamingBubble();
                    },
                  ),
          ),
          if (_suggestions.isNotEmpty && _messages.isEmpty)
            _buildSuggestions(),
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome, size: 64, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 12),
            Text(
              'Ask about your portfolio',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              'Arrears, occupancy, tenants, renewals — try one of the prompts below.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestions() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _suggestions
              .map(
                (s) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ActionChip(
                    label: Text(s),
                    onPressed: () => _send(s),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }

  Widget _buildBubble(AiChatMessage m) {
    final isUser = m.role == 'user';
    return GestureDetector(
      onLongPress: () => _showMessageMenu(m),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.all(12),
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
          decoration: BoxDecoration(
            color: isUser
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment:
                isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Text(
                m.content,
                style: TextStyle(
                  color: isUser
                      ? Theme.of(context).colorScheme.onPrimary
                      : Theme.of(context).colorScheme.onSurface,
                ),
              ),
              if (!isUser)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: InkWell(
                    onTap: () => _readAloud(m.content),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.volume_up, size: 16),
                        SizedBox(width: 4),
                        Text('Read aloud', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStreamingBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          _streamingBuffer.isEmpty ? 'Thinking…' : _streamingBuffer,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
      ),
    );
  }

  Widget _buildInput() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _input,
                enabled: !_streaming,
                decoration: const InputDecoration(
                  hintText: 'Ask the copilot…',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: _send,
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              icon: _streaming
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              onPressed: _streaming ? null : () => _send(_input.text),
            ),
          ],
        ),
      ),
    );
  }
}
