import 'package:flutter/material.dart';

class StoriesBar extends StatelessWidget {
  const StoriesBar({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final stories = [
      _StoryItem(name: 'Your status', isOwn: true, hasNew: true),
      _StoryItem(name: 'Management', hasNew: true),
      _StoryItem(name: 'Community', hasNew: false),
    ];

    return SizedBox(
      height: 88,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        itemCount: stories.length,
        itemBuilder: (_, i) {
          final s = stories[i];
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              GestureDetector(
                onTap: () {},
                child: Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: s.hasNew
                        ? LinearGradient(
                            colors: [cs.primary, const Color(0xFFF59E0B), const Color(0xFF8B5CF6)],
                            begin: Alignment.topLeft, end: Alignment.bottomRight,
                          )
                        : null,
                    color: s.hasNew ? null : cs.surface,
                    border: s.hasNew ? null : Border.all(color: Colors.white24, width: 2),
                  ),
                  padding: const EdgeInsets.all(2),
                  child: Container(
                    width: 52, height: 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF1E293B),
                    ),
                    child: Center(
                      child: Text(
                        s.name[0],
                        style: TextStyle(color: cs.primary, fontSize: 20, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              SizedBox(
                width: 64,
                child: Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 11)),
              ),
            ]),
          );
        },
      ),
    );
  }
}

class _StoryItem {
  final String name;
  final bool isOwn;
  final bool hasNew;
  _StoryItem({required this.name, this.isOwn = false, this.hasNew = false});
}
