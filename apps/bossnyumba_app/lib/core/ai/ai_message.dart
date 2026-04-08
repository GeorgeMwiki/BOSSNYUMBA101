import 'dart:convert';

/// Role of a conversation turn.
enum AiMessageRole { user, assistant, system }

String _roleToString(AiMessageRole r) {
  switch (r) {
    case AiMessageRole.user:
      return 'user';
    case AiMessageRole.assistant:
      return 'assistant';
    case AiMessageRole.system:
      return 'system';
  }
}

AiMessageRole _roleFromString(String? s) {
  switch (s) {
    case 'user':
      return AiMessageRole.user;
    case 'assistant':
      return AiMessageRole.assistant;
    case 'system':
      return AiMessageRole.system;
    default:
      return AiMessageRole.user;
  }
}

/// A single AI-agent tool invocation proposed or executed by the assistant.
///
/// Example: the assistant drafts a reminder via a tool call and asks the user
/// whether to send it. The UI renders action chips below the bubble based on
/// these.
class AiToolCall {
  final String id;
  final String name;
  final Map<String, dynamic> arguments;
  final String? resultPreview;
  final bool awaitingConfirmation;

  const AiToolCall({
    required this.id,
    required this.name,
    this.arguments = const {},
    this.resultPreview,
    this.awaitingConfirmation = false,
  });

  factory AiToolCall.fromJson(Map<String, dynamic> json) => AiToolCall(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        arguments: (json['arguments'] as Map?)?.cast<String, dynamic>() ?? {},
        resultPreview: json['resultPreview'] as String?,
        awaitingConfirmation: json['awaitingConfirmation'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'arguments': arguments,
        if (resultPreview != null) 'resultPreview': resultPreview,
        'awaitingConfirmation': awaitingConfirmation,
      };
}

/// A single turn in an AI copilot conversation.
class AiMessage {
  final String id;
  final AiMessageRole role;
  final String content;
  final DateTime timestamp;
  final List<AiToolCall> toolCalls;

  const AiMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.toolCalls = const [],
  });

  bool get isUser => role == AiMessageRole.user;
  bool get isAssistant => role == AiMessageRole.assistant;

  AiMessage copyWith({
    String? id,
    AiMessageRole? role,
    String? content,
    DateTime? timestamp,
    List<AiToolCall>? toolCalls,
  }) {
    return AiMessage(
      id: id ?? this.id,
      role: role ?? this.role,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      toolCalls: toolCalls ?? this.toolCalls,
    );
  }

  factory AiMessage.user(String content, {String? id, DateTime? at}) =>
      AiMessage(
        id: id ?? 'u_${DateTime.now().microsecondsSinceEpoch}',
        role: AiMessageRole.user,
        content: content,
        timestamp: at ?? DateTime.now(),
      );

  factory AiMessage.assistant(
    String content, {
    String? id,
    DateTime? at,
    List<AiToolCall> toolCalls = const [],
  }) =>
      AiMessage(
        id: id ?? 'a_${DateTime.now().microsecondsSinceEpoch}',
        role: AiMessageRole.assistant,
        content: content,
        timestamp: at ?? DateTime.now(),
        toolCalls: toolCalls,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': _roleToString(role),
        'content': content,
        'timestamp': timestamp.toIso8601String(),
        if (toolCalls.isNotEmpty)
          'toolCalls': toolCalls.map((t) => t.toJson()).toList(),
      };

  /// Wire-format for sending to the backend. Excludes local-only fields like id.
  Map<String, dynamic> toWire() => {
        'role': _roleToString(role),
        'content': content,
      };

  factory AiMessage.fromJson(Map<String, dynamic> json) => AiMessage(
        id: json['id'] as String? ??
            'm_${DateTime.now().microsecondsSinceEpoch}',
        role: _roleFromString(json['role'] as String?),
        content: json['content'] as String? ?? '',
        timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '') ??
            DateTime.now(),
        toolCalls: (json['toolCalls'] as List?)
                ?.whereType<Map>()
                .map((e) => AiToolCall.fromJson(e.cast<String, dynamic>()))
                .toList() ??
            const [],
      );

  static String encodeList(List<AiMessage> messages) =>
      jsonEncode(messages.map((m) => m.toJson()).toList());

  static List<AiMessage> decodeList(String raw) {
    try {
      final list = jsonDecode(raw);
      if (list is! List) return [];
      return list
          .whereType<Map>()
          .map((m) => AiMessage.fromJson(m.cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
