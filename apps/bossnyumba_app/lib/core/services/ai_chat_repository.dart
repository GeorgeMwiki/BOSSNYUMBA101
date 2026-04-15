// AI Chat Repository
//
// Talks to the api-gateway AI copilot routes:
//   POST /ai/copilot/chat          — SSE stream of deltas, JSON fallback
//   GET  /ai/copilot/suggestions   — context-aware suggested prompts
//
// Persists conversation history to SharedPreferences keyed by userId+orgId.

import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../api_client.dart';
import '../api_config.dart';

class AiChatMessage {
  final String role; // 'user' | 'assistant'
  final String content;
  final DateTime timestamp;

  AiChatMessage({
    required this.role,
    required this.content,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
        'role': role,
        'content': content,
        'timestamp': timestamp.toIso8601String(),
      };

  factory AiChatMessage.fromJson(Map<String, dynamic> j) => AiChatMessage(
        role: j['role'] as String,
        content: j['content'] as String,
        timestamp: DateTime.tryParse(j['timestamp'] as String? ?? '') ?? DateTime.now(),
      );
}

class AiChatEvent {
  final String type; // 'delta' | 'done' | 'error'
  final String? text;
  final String? message;
  final String? providerId;

  AiChatEvent._({required this.type, this.text, this.message, this.providerId});

  factory AiChatEvent.delta(String text) => AiChatEvent._(type: 'delta', text: text);
  factory AiChatEvent.done({String? providerId}) =>
      AiChatEvent._(type: 'done', providerId: providerId);
  factory AiChatEvent.error(String msg) => AiChatEvent._(type: 'error', message: msg);
}

class AiChatRepository {
  final ApiClient _api;

  AiChatRepository({ApiClient? api}) : _api = api ?? ApiClient.instance;

  String _historyKey(String userId, String orgId) => 'ai_chat_history::${userId}::${orgId}';

  Future<List<AiChatMessage>> loadHistory(String userId, String orgId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_historyKey(userId, orgId));
    if (raw == null || raw.isEmpty) return [];
    try {
      final List<dynamic> arr = jsonDecode(raw) as List<dynamic>;
      return arr
          .whereType<Map<String, dynamic>>()
          .map(AiChatMessage.fromJson)
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveHistory(
    String userId,
    String orgId,
    List<AiChatMessage> messages,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = jsonEncode(messages.map((m) => m.toJson()).toList());
    await prefs.setString(_historyKey(userId, orgId), encoded);
  }

  Future<void> clearHistory(String userId, String orgId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_historyKey(userId, orgId));
  }

  Future<List<String>> fetchSuggestedPrompts(String activeOrgId) async {
    final resp = await _api.get<Map<String, dynamic>>(
      '/ai/copilot/suggestions',
      queryParams: {'activeOrgId': activeOrgId},
    );
    if (!resp.isOk) return const [];
    final data = resp.data;
    if (data is Map && data['suggestions'] is List) {
      return (data['suggestions'] as List).map((e) => e.toString()).toList();
    }
    return const [];
  }

  /// Streams AI response deltas via SSE. Falls back to a single JSON response
  /// if the gateway doesn't support streaming.
  Stream<AiChatEvent> chat({
    required List<AiChatMessage> history,
    required String prompt,
    required String activeOrgId,
    String? authToken,
  }) async* {
    final uri = Uri.parse('${ApiConfig.baseUrl}/ai/copilot/chat');
    final req = http.Request('POST', uri);
    req.headers['Content-Type'] = 'application/json';
    req.headers['Accept'] = 'text/event-stream';
    if (authToken != null) {
      req.headers['Authorization'] = 'Bearer $authToken';
    }
    req.body = jsonEncode({
      'history': history.map((m) => {'role': m.role, 'content': m.content}).toList(),
      'prompt': prompt,
      'activeOrgId': activeOrgId,
      'stream': true,
    });

    http.StreamedResponse streamed;
    try {
      streamed = await http.Client().send(req).timeout(
            Duration(seconds: ApiConfig.timeoutSeconds),
          );
    } catch (e) {
      yield AiChatEvent.error('Network error: $e');
      return;
    }

    final ct = streamed.headers['content-type'] ?? '';
    if (streamed.statusCode >= 400) {
      final body = await streamed.stream.bytesToString();
      yield AiChatEvent.error('HTTP ${streamed.statusCode}: $body');
      return;
    }

    // JSON fallback (server didn't stream).
    if (!ct.contains('text/event-stream')) {
      final body = await streamed.stream.bytesToString();
      try {
        final decoded = jsonDecode(body);
        final data = decoded is Map && decoded['data'] != null ? decoded['data'] : decoded;
        final content = (data is Map ? data['content'] : null) ?? body;
        if (content is String && content.isNotEmpty) {
          yield AiChatEvent.delta(content);
        }
        yield AiChatEvent.done(
          providerId: data is Map ? data['providerId'] as String? : null,
        );
      } catch (_) {
        yield AiChatEvent.error('Invalid response');
      }
      return;
    }

    // SSE parse
    final lines = streamed.stream.transform(utf8.decoder).transform(const LineSplitter());
    String currentEvent = 'message';
    final dataBuffer = StringBuffer();

    await for (final line in lines) {
      if (line.isEmpty) {
        // event end
        final data = dataBuffer.toString();
        dataBuffer.clear();
        if (data.isNotEmpty) {
          try {
            final parsed = jsonDecode(data);
            if (currentEvent == 'delta') {
              final text = parsed is Map ? parsed['text'] as String? : null;
              if (text != null && text.isNotEmpty) yield AiChatEvent.delta(text);
            } else if (currentEvent == 'done') {
              yield AiChatEvent.done(
                providerId: parsed is Map ? parsed['providerId'] as String? : null,
              );
              return;
            } else if (currentEvent == 'error') {
              yield AiChatEvent.error(
                (parsed is Map ? parsed['message'] as String? : null) ?? 'Stream error',
              );
              return;
            }
          } catch (_) {
            // ignore malformed event
          }
        }
        currentEvent = 'message';
        continue;
      }
      if (line.startsWith('event:')) {
        currentEvent = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataBuffer.write(line.substring(5).trim());
      }
    }
    yield AiChatEvent.done();
  }
}
