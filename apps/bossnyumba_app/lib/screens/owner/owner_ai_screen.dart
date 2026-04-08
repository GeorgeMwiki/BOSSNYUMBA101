import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/ai/ai_chat_repository.dart';
import '../../core/ai/ai_message.dart';
import '../../core/auth_provider.dart';
import '../../widgets/chat_bubble.dart';

/// Minimal abstractions for voice I/O so the screen compiles regardless of
/// whether `speech_to_text` / `flutter_tts` are present in pubspec.
///
/// When those packages are added, wire real implementations here (or via
/// [OwnerAiScreen.sttService] / [OwnerAiScreen.ttsService]) and the UI will
/// light up automatically.
abstract class SpeechToTextService {
  Future<bool> initialize();
  Future<void> listen(void Function(String partial) onResult);
  Future<void> stop();
  bool get isAvailable;
  bool get isListening;
}

abstract class TextToSpeechService {
  Future<void> speak(String text);
  Future<void> stop();
  bool get isAvailable;
}

class _NoopSpeechToText implements SpeechToTextService {
  @override
  bool get isAvailable => false;
  @override
  bool get isListening => false;
  @override
  Future<bool> initialize() async => false;
  @override
  Future<void> listen(void Function(String) onResult) async {}
  @override
  Future<void> stop() async {}
}

class _NoopTts implements TextToSpeechService {
  @override
  bool get isAvailable => false;
  @override
  Future<void> speak(String text) async {}
  @override
  Future<void> stop() async {}
}

/// The centerpiece of the Owner mobile companion: a conversational AI that
/// knows the active portfolio and answers actionable questions in seconds.
class OwnerAiScreen extends StatefulWidget {
  final AiChatRepository? repository;
  final SpeechToTextService? sttService;
  final TextToSpeechService? ttsService;
  final String? activeOrgIdOverride;
  final String? userIdOverride;

  const OwnerAiScreen({
    super.key,
    this.repository,
    this.sttService,
    this.ttsService,
    this.activeOrgIdOverride,
    this.userIdOverride,
  });

  @override
  State<OwnerAiScreen> createState() => _OwnerAiScreenState();
}

class _OwnerAiScreenState extends State<OwnerAiScreen> {
  static const int _maxPersistedMessages = 50;

  late final AiChatRepository _repo;
  late final SpeechToTextService _stt;
  late final TextToSpeechService _tts;

  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  final List<AiMessage> _messages = [];
  List<String> _suggestedPrompts = AiChatRepository.fallbackSuggestedPrompts;

  bool _loading = false;
  bool _sending = false;
  bool _handsBusyMode = false;
  bool _reachable = false;
  bool _listening = false;
  String? _error;
  String? _lastActiveOrgId;
  String? _lastUserId;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? AiChatRepository();
    _stt = widget.sttService ?? _NoopSpeechToText();
    _tts = widget.ttsService ?? _NoopTts();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    _tts.stop();
    _stt.stop();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final ids = _currentIds();
    _lastUserId = ids.userId;
    _lastActiveOrgId = ids.activeOrgId;
    await _loadPersisted();
    await Future.wait([
      _loadSuggestions(),
      _refreshReachability(),
      _stt.initialize(),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  _Identity _currentIds() {
    UserSession? session;
    try {
      session = context.read<AuthProvider>().session;
    } catch (_) {
      // No AuthProvider in scope (e.g. widget tests) - fall back to overrides.
      session = null;
    }
    return _Identity(
      userId: widget.userIdOverride ?? session?.id ?? 'anon',
      activeOrgId:
          widget.activeOrgIdOverride ?? session?.tenantId ?? 'default-org',
    );
  }

  String _storageKey(_Identity ids) =>
      'owner_ai_chat:${ids.userId}:${ids.activeOrgId}';

  Future<void> _loadPersisted() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = _currentIds();
      final raw = prefs.getString(_storageKey(ids));
      if (raw == null) return;
      final loaded = AiMessage.decodeList(raw);
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(loaded.take(_maxPersistedMessages));
      });
    } catch (_) {
      // persistence is best-effort
    }
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = _currentIds();
      final trimmed = _messages.length > _maxPersistedMessages
          ? _messages.sublist(_messages.length - _maxPersistedMessages)
          : _messages;
      await prefs.setString(_storageKey(ids), AiMessage.encodeList(trimmed));
    } catch (_) {
      // best-effort
    }
  }

  Future<void> _loadSuggestions() async {
    try {
      final ids = _currentIds();
      final list = await _repo.fetchSuggestedPrompts(ids.activeOrgId);
      if (!mounted) return;
      setState(() => _suggestedPrompts = list);
    } catch (_) {
      // keep fallback
    }
  }

  Future<void> _refreshReachability() async {
    try {
      final ok = await _repo.isReachable();
      if (!mounted) return;
      setState(() => _reachable = ok);
    } catch (_) {
      if (!mounted) return;
      setState(() => _reachable = false);
    }
  }

  Future<void> _sendPrompt(String prompt) async {
    final text = prompt.trim();
    if (text.isEmpty || _sending) return;
    final ids = _currentIds();

    final userMsg = AiMessage.user(text);
    setState(() {
      _messages.add(userMsg);
      _sending = true;
      _error = null;
      _inputController.clear();
    });
    _scrollToBottom();

    try {
      // history excludes the just-added user turn; repository re-appends it
      final history =
          _messages.where((m) => m.id != userMsg.id).toList(growable: false);
      final resp = await _repo.sendMessage(
        history: history,
        prompt: text,
        activeOrgId: ids.activeOrgId,
      );
      if (!mounted) return;
      setState(() {
        _messages.add(resp.message);
        _sending = false;
      });
      unawaited(_persist());
      _scrollToBottom();
      if (_handsBusyMode && _tts.isAvailable) {
        unawaited(_tts.speak(resp.message.content));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = e.toString();
      });
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _toggleListening() async {
    if (!_stt.isAvailable) {
      final ready = await _stt.initialize();
      if (!ready && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Voice input unavailable on this device'),
          ),
        );
        return;
      }
    }
    if (_listening) {
      await _stt.stop();
      if (!mounted) return;
      setState(() => _listening = false);
      return;
    }
    setState(() => _listening = true);
    await _stt.listen((partial) {
      if (!mounted) return;
      setState(() => _inputController.text = partial);
    });
  }

  Future<void> _clearConversation() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear conversation?'),
        content: const Text(
            'This will remove the messages in this chat. This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _messages.clear());
    final prefs = await SharedPreferences.getInstance();
    final ids = _currentIds();
    await prefs.remove(_storageKey(ids));
  }

  Future<void> _onLongPressMessage(AiMessage msg) async {
    final action = await showModalBottomSheet<_MessageAction>(
      context: context,
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.copy),
                title: const Text('Copy'),
                onTap: () =>
                    Navigator.of(ctx).pop(_MessageAction.copy),
              ),
              ListTile(
                leading: const Icon(Icons.volume_up),
                title: const Text('Read aloud'),
                onTap: () =>
                    Navigator.of(ctx).pop(_MessageAction.readAloud),
              ),
              if (msg.isUser)
                ListTile(
                  leading: const Icon(Icons.refresh),
                  title: const Text('Re-ask'),
                  onTap: () =>
                      Navigator.of(ctx).pop(_MessageAction.reAsk),
                ),
            ],
          ),
        );
      },
    );
    if (action == null) return;
    switch (action) {
      case _MessageAction.copy:
        await Clipboard.setData(ClipboardData(text: msg.content));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Copied to clipboard')),
        );
        break;
      case _MessageAction.readAloud:
        if (_tts.isAvailable) {
          await _tts.speak(msg.content);
        } else if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Text-to-speech unavailable')),
          );
        }
        break;
      case _MessageAction.reAsk:
        await _sendPrompt(msg.content);
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF181818),
        title: Row(
          children: [
            const Text('Boss AI'),
            const SizedBox(width: 8),
            _StatusDot(reachable: _reachable),
          ],
        ),
        actions: [
          IconButton(
            tooltip: _handsBusyMode
                ? 'Hands-busy mode: ON'
                : 'Hands-busy mode: OFF',
            icon: Icon(
              _handsBusyMode ? Icons.headset_mic : Icons.headset_off,
              color: _handsBusyMode ? const Color(0xFF1DB954) : null,
            ),
            onPressed: () =>
                setState(() => _handsBusyMode = !_handsBusyMode),
          ),
          IconButton(
            tooltip: 'Clear conversation',
            icon: const Icon(Icons.delete_outline),
            onPressed: _messages.isEmpty ? null : _clearConversation,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? _EmptyState(
                        suggestions: _suggestedPrompts,
                        onSelect: _sendPrompt,
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        itemCount: _messages.length + (_sending ? 1 : 0),
                        itemBuilder: (ctx, i) {
                          if (i == _messages.length) {
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2),
                                ),
                              ),
                            );
                          }
                          final m = _messages[i];
                          return GestureDetector(
                            onLongPress: () => _onLongPressMessage(m),
                            child: Column(
                              crossAxisAlignment: m.isUser
                                  ? CrossAxisAlignment.end
                                  : CrossAxisAlignment.start,
                              children: [
                                ChatBubble(
                                  message: m.content,
                                  isSent: m.isUser,
                                ),
                                if (m.isAssistant)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                        left: 16, bottom: 6),
                                    child: IconButton(
                                      tooltip: 'Read aloud',
                                      iconSize: 18,
                                      visualDensity: VisualDensity.compact,
                                      icon: const Icon(
                                        Icons.volume_up,
                                        color: Colors.white70,
                                      ),
                                      onPressed: () => _tts.isAvailable
                                          ? _tts.speak(m.content)
                                          : ScaffoldMessenger.of(context)
                                              .showSnackBar(const SnackBar(
                                              content: Text(
                                                  'Text-to-speech unavailable'),
                                            )),
                                    ),
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
            ),
          _InputBar(
            controller: _inputController,
            sending: _sending,
            listening: _listening,
            onSend: () => _sendPrompt(_inputController.text),
            onMicPressed: _toggleListening,
          ),
        ],
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final bool reachable;
  const _StatusDot({required this.reachable});

  @override
  Widget build(BuildContext context) {
    final color = reachable ? const Color(0xFF1DB954) : const Color(0xFFFFB300);
    return Tooltip(
      message: reachable ? 'Online' : 'Offline / degraded',
      child: Container(
        key: const ValueKey('owner_ai_status_dot'),
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: color.withOpacity(0.5), blurRadius: 4),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final List<String> suggestions;
  final void Function(String) onSelect;
  const _EmptyState({required this.suggestions, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 24),
          const Icon(Icons.auto_awesome, size: 56, color: Color(0xFF1DB954)),
          const SizedBox(height: 16),
          const Text(
            'Ask me anything about your portfolio',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Short, actionable answers. Voice in, voice out.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              for (final s in suggestions)
                ActionChip(
                  key: ValueKey('owner_ai_suggestion_$s'),
                  backgroundColor: const Color(0xFF282828),
                  label: Text(
                    s,
                    style: const TextStyle(color: Colors.white),
                  ),
                  onPressed: () => onSelect(s),
                ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Boss AI uses Anthropic Claude. Your data stays in your region per the privacy policy.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white38, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool sending;
  final bool listening;
  final VoidCallback onSend;
  final VoidCallback onMicPressed;

  const _InputBar({
    required this.controller,
    required this.sending,
    required this.listening,
    required this.onSend,
    required this.onMicPressed,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: const BoxDecoration(
          color: Color(0xFF181818),
          border: Border(top: BorderSide(color: Color(0xFF282828))),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                key: const ValueKey('owner_ai_text_field'),
                controller: controller,
                minLines: 1,
                maxLines: 4,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Ask Boss AI…',
                  hintStyle: const TextStyle(color: Colors.white54),
                  filled: true,
                  fillColor: const Color(0xFF282828),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                ),
                onSubmitted: (_) => onSend(),
              ),
            ),
            const SizedBox(width: 6),
            IconButton(
              key: const ValueKey('owner_ai_mic_button'),
              tooltip: listening ? 'Stop listening' : 'Start voice input',
              icon: Icon(
                listening ? Icons.mic : Icons.mic_none,
                color: listening ? const Color(0xFF1DB954) : Colors.white70,
              ),
              onPressed: onMicPressed,
            ),
            IconButton(
              key: const ValueKey('owner_ai_send_button'),
              tooltip: 'Send',
              icon: sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send, color: Color(0xFF1DB954)),
              onPressed: sending ? null : onSend,
            ),
          ],
        ),
      ),
    );
  }
}

enum _MessageAction { copy, readAloud, reAsk }

class _Identity {
  final String userId;
  final String activeOrgId;
  const _Identity({required this.userId, required this.activeOrgId});
}
