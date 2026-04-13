import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bossnyumba_app/core/ai/ai_chat_repository.dart';
import 'package:bossnyumba_app/core/ai/ai_message.dart';
import 'package:bossnyumba_app/core/api_client.dart';
import 'package:bossnyumba_app/screens/owner/owner_ai_screen.dart';

/// A test double for [AiChatRepository] that records calls and returns
/// canned responses without touching the network.
class _FakeRepo extends AiChatRepository {
  _FakeRepo({
    required this.suggestions,
    required this.reachable,
    required this.responder,
  }) : super(api: ApiClient());

  final List<String> suggestions;
  final bool reachable;
  final AiResponse Function(
      List<AiMessage> history, String prompt, String orgId) responder;

  List<AiMessage>? lastHistory;
  String? lastPrompt;
  String? lastOrgId;
  int sendCount = 0;

  @override
  Future<List<String>> fetchSuggestedPrompts(String activeOrgId) async =>
      suggestions;

  @override
  Future<bool> isReachable() async => reachable;

  @override
  Future<AiResponse> sendMessage({
    required List<AiMessage> history,
    required String prompt,
    required String activeOrgId,
  }) async {
    sendCount++;
    lastHistory = List<AiMessage>.from(history);
    lastPrompt = prompt;
    lastOrgId = activeOrgId;
    return responder(history, prompt, activeOrgId);
  }

  @override
  Future<AiResponse> sendMessageStreaming({
    required List<AiMessage> history,
    required String prompt,
    required String activeOrgId,
    required AiStreamDelta onDelta,
  }) =>
      sendMessage(
        history: history,
        prompt: prompt,
        activeOrgId: activeOrgId,
      );
}

class _ControllableStt implements SpeechToTextService {
  bool _available = true;
  bool _listening = false;

  @override
  bool get isAvailable => _available;

  @override
  bool get isListening => _listening;

  @override
  Future<bool> initialize() async {
    _available = true;
    return true;
  }

  @override
  Future<void> listen(void Function(String partial) onResult) async {
    _listening = true;
  }

  @override
  Future<void> stop() async {
    _listening = false;
  }
}

Widget _wrap(Widget child) => MaterialApp(home: child);

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
    'sending a message calls the repository with right history + activeOrgId',
    (tester) async {
      final repo = _FakeRepo(
        suggestions: const ['Pick me'],
        reachable: true,
        responder: (_, __, ___) => AiResponse(
          message: AiMessage.assistant('The answer is 42.'),
        ),
      );

      await tester.pumpWidget(_wrap(
        OwnerAiScreen(
          repository: repo,
          activeOrgIdOverride: 'org-1',
          userIdOverride: 'user-1',
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      await tester.enterText(
          find.byKey(const ValueKey('owner_ai_text_field')), 'Hello?');
      await tester.tap(find.byKey(const ValueKey('owner_ai_send_button')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(repo.sendCount, 1);
      expect(repo.lastPrompt, 'Hello?');
      expect(repo.lastOrgId, 'org-1');
      // History should NOT yet contain the just-sent user turn; the
      // repository appends it itself when building the wire payload.
      expect(repo.lastHistory, isEmpty);
      expect(find.text('Hello?'), findsOneWidget);
      expect(find.text('The answer is 42.'), findsOneWidget);

      // Follow-up message: prior turns should be included in history.
      await tester.enterText(
          find.byKey(const ValueKey('owner_ai_text_field')), 'Follow up');
      await tester.tap(find.byKey(const ValueKey('owner_ai_send_button')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(repo.sendCount, 2);
      expect(repo.lastPrompt, 'Follow up');
      expect(repo.lastOrgId, 'org-1');
      expect(repo.lastHistory!.length, 2);
      expect(repo.lastHistory![0].role, AiMessageRole.user);
      expect(repo.lastHistory![0].content, 'Hello?');
      expect(repo.lastHistory![1].role, AiMessageRole.assistant);
      expect(repo.lastHistory![1].content, 'The answer is 42.');
    },
  );

  testWidgets('suggested prompts render from a mocked endpoint',
      (tester) async {
    final repo = _FakeRepo(
      suggestions: const ['Who is behind?', 'Collection rate?'],
      reachable: true,
      responder: (_, __, ___) => AiResponse(
        message: AiMessage.assistant('ok'),
      ),
    );

    await tester.pumpWidget(_wrap(
      OwnerAiScreen(
        repository: repo,
        activeOrgIdOverride: 'org-1',
        userIdOverride: 'user-1',
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('Who is behind?'), findsOneWidget);
    expect(find.text('Collection rate?'), findsOneWidget);
    // Hardcoded fallback prompts should NOT render when endpoint succeeds.
    expect(find.text("Who's behind on rent?"), findsNothing);
  });

  testWidgets('voice toggle changes the mic button color', (tester) async {
    final repo = _FakeRepo(
      suggestions: const ['x'],
      reachable: false,
      responder: (_, __, ___) => AiResponse(
        message: AiMessage.assistant('ok'),
      ),
    );

    final stt = _ControllableStt();
    await tester.pumpWidget(_wrap(
      OwnerAiScreen(
        repository: repo,
        sttService: stt,
        activeOrgIdOverride: 'org-1',
        userIdOverride: 'user-1',
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    final before = tester.widget<Icon>(
      find.descendant(
        of: find.byKey(const ValueKey('owner_ai_mic_button')),
        matching: find.byType(Icon),
      ),
    );
    expect(before.color, Colors.white70);

    await tester.tap(find.byKey(const ValueKey('owner_ai_mic_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    final after = tester.widget<Icon>(
      find.descendant(
        of: find.byKey(const ValueKey('owner_ai_mic_button')),
        matching: find.byType(Icon),
      ),
    );
    expect(after.color, const Color(0xFF1DB954));
  });
}
