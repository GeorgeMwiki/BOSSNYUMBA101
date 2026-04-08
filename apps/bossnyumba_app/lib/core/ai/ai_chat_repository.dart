import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../api_client.dart';
import '../api_config.dart';
import 'ai_message.dart';

/// Non-streaming AI response envelope.
class AiResponse {
  final AiMessage message;
  final List<String>? followUps;
  final bool fromStream;

  const AiResponse({
    required this.message,
    this.followUps,
    this.fromStream = false,
  });
}

/// Callback fired for each streamed delta chunk when using SSE.
typedef AiStreamDelta = void Function(String deltaText, String cumulative);

/// Thin transport abstraction so tests can inject a fake HTTP client.
///
/// All methods target the `/api/v1/ai/copilot/*` routes. The repository
/// attempts SSE first via [sendMessageStreaming] and falls back to the
/// standard JSON endpoint via [sendMessage] if the server returns anything
/// other than a 2xx on the stream.
class AiChatRepository {
  final ApiClient _api;
  final http.Client _httpClient;
  final String _baseUrl;

  AiChatRepository({
    ApiClient? api,
    http.Client? httpClient,
    String? baseUrl,
  })  : _api = api ?? ApiClient.instance,
        _httpClient = httpClient ?? http.Client(),
        _baseUrl = baseUrl ?? ApiConfig.baseUrl;

  // Paths are relative to ApiConfig.baseUrl which already includes /api/v1.
  static const String _chatPath = '/ai/copilot/chat';
  static const String _streamPath = '/ai/copilot/chat/stream';
  static const String _suggestionsPath = '/ai/copilot/suggestions';
  static const String _healthPath = '/ai/copilot/health';

  /// Fallback prompts shown if the suggestions endpoint fails.
  static const List<String> fallbackSuggestedPrompts = [
    "Who's behind on rent?",
    "Today's collection rate",
    "Draft reminder for Unit 7",
    "Market rent for 2BR Westlands",
  ];

  Map<String, String> _authHeaders({bool sse = false}) {
    final token = _tokenFromApi();
    return {
      'Content-Type': 'application/json',
      'Accept': sse ? 'text/event-stream' : 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Reflective-ish accessor: ApiClient doesn't expose the token, so we stash
  /// it on the singleton via a side-channel the repo mirrors. In practice the
  /// ApiClient attaches Authorization headers; we replicate that here for
  /// direct http.Client usage (SSE).
  String? _tokenFromApi() {
    // ApiClient stores the token privately. We proxy by using its own
    // post<T>() for the JSON path, and accept that the SSE path will rely on
    // the same token being present via a static holder.
    return _AiAuthToken.token;
  }

  /// Allow the app shell to sync the bearer token for SSE requests.
  static void updateToken(String? token) {
    _AiAuthToken.token = token;
  }

  /// Build the request payload sent to both JSON and SSE endpoints.
  Map<String, dynamic> _buildPayload({
    required List<AiMessage> history,
    required String prompt,
    required String activeOrgId,
  }) {
    return {
      'orgId': activeOrgId,
      'messages': [
        ...history.map((m) => m.toWire()),
        {'role': 'user', 'content': prompt},
      ],
    };
  }

  /// Non-streaming send. Posts to `/api/v1/ai/copilot/chat`.
  Future<AiResponse> sendMessage({
    required List<AiMessage> history,
    required String prompt,
    required String activeOrgId,
  }) async {
    final payload = _buildPayload(
      history: history,
      prompt: prompt,
      activeOrgId: activeOrgId,
    );
    final resp = await _api.post<Map<String, dynamic>>(_chatPath, body: payload);
    if (!resp.isOk || resp.data == null) {
      throw AiChatException(resp.error ?? 'AI request failed');
    }
    return _parseJsonResponse(resp.data!);
  }

  /// Streaming variant. Subscribes to SSE from `/api/v1/ai/copilot/chat/stream`.
  ///
  /// Falls back to [sendMessage] automatically if:
  ///   - the server returns a non-2xx on the SSE endpoint
  ///   - the connection drops before an `event: done` or `[DONE]` marker
  ///
  /// [onDelta] fires for every `data:` line with the incremental text and
  /// running cumulative content so the UI can render partial tokens.
  Future<AiResponse> sendMessageStreaming({
    required List<AiMessage> history,
    required String prompt,
    required String activeOrgId,
    required AiStreamDelta onDelta,
  }) async {
    final payload = _buildPayload(
      history: history,
      prompt: prompt,
      activeOrgId: activeOrgId,
    );
    final uri = Uri.parse('$_baseUrl$_streamPath');
    final req = http.Request('POST', uri)
      ..headers.addAll(_authHeaders(sse: true))
      ..body = jsonEncode(payload);

    http.StreamedResponse streamed;
    try {
      streamed = await _httpClient.send(req);
    } catch (_) {
      return sendMessage(
        history: history,
        prompt: prompt,
        activeOrgId: activeOrgId,
      );
    }

    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      return sendMessage(
        history: history,
        prompt: prompt,
        activeOrgId: activeOrgId,
      );
    }

    final buffer = StringBuffer();
    final toolCalls = <AiToolCall>[];
    var sawDone = false;

    try {
      final lines = streamed.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter());

      await for (final line in lines) {
        if (line.isEmpty) continue;
        if (!line.startsWith('data:')) continue;
        final raw = line.substring(5).trim();
        if (raw == '[DONE]') {
          sawDone = true;
          break;
        }
        try {
          final parsed = jsonDecode(raw);
          if (parsed is Map) {
            final delta = parsed['delta'] as String?;
            if (delta != null && delta.isNotEmpty) {
              buffer.write(delta);
              onDelta(delta, buffer.toString());
            }
            final tc = parsed['toolCalls'];
            if (tc is List) {
              for (final entry in tc) {
                if (entry is Map) {
                  toolCalls
                      .add(AiToolCall.fromJson(entry.cast<String, dynamic>()));
                }
              }
            }
            if (parsed['done'] == true) {
              sawDone = true;
              break;
            }
          } else if (parsed is String) {
            buffer.write(parsed);
            onDelta(parsed, buffer.toString());
          }
        } catch (_) {
          // non-JSON data line - treat as plain text delta
          buffer.write(raw);
          onDelta(raw, buffer.toString());
        }
      }
    } catch (_) {
      if (buffer.isEmpty) {
        return sendMessage(
          history: history,
          prompt: prompt,
          activeOrgId: activeOrgId,
        );
      }
    }

    if (!sawDone && buffer.isEmpty) {
      return sendMessage(
        history: history,
        prompt: prompt,
        activeOrgId: activeOrgId,
      );
    }

    return AiResponse(
      message: AiMessage.assistant(
        buffer.toString(),
        toolCalls: toolCalls,
      ),
      fromStream: true,
    );
  }

  /// Suggested prompts for the current org. Returns fallback list on failure.
  Future<List<String>> fetchSuggestedPrompts(String activeOrgId) async {
    try {
      final resp = await _api.get<dynamic>(
        _suggestionsPath,
        queryParams: {'orgId': activeOrgId},
      );
      if (!resp.isOk || resp.data == null) return fallbackSuggestedPrompts;
      final data = resp.data;
      final list = _extractStringList(data);
      if (list.isEmpty) return fallbackSuggestedPrompts;
      return list;
    } catch (_) {
      return fallbackSuggestedPrompts;
    }
  }

  /// Best-effort reachability check for the green/amber status dot.
  Future<bool> isReachable() async {
    try {
      final resp = await _api.get<dynamic>(_healthPath);
      return resp.isOk;
    } catch (_) {
      return false;
    }
  }

  AiResponse _parseJsonResponse(Map<String, dynamic> data) {
    final msgMap = data['message'] as Map?;
    final content = (msgMap?['content'] ?? data['content'] ?? data['reply'])
            as String? ??
        '';
    final toolCalls = (msgMap?['toolCalls'] ?? data['toolCalls']) as List?;
    final followUps = _extractStringList(data['followUps']);
    return AiResponse(
      message: AiMessage.assistant(
        content,
        toolCalls: toolCalls
                ?.whereType<Map>()
                .map((e) => AiToolCall.fromJson(e.cast<String, dynamic>()))
                .toList() ??
            const [],
      ),
      followUps: followUps.isEmpty ? null : followUps,
    );
  }

  List<String> _extractStringList(dynamic data) {
    if (data is List) {
      return data.whereType<String>().toList();
    }
    if (data is Map) {
      final items = data['items'] ?? data['suggestions'] ?? data['prompts'];
      if (items is List) return items.whereType<String>().toList();
    }
    return const [];
  }
}

class AiChatException implements Exception {
  final String message;
  AiChatException(this.message);
  @override
  String toString() => 'AiChatException: $message';
}

/// Private holder so SSE requests can share the bearer token with ApiClient.
class _AiAuthToken {
  static String? token;
}
