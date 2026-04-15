import 'package:flutter/material.dart';

class StoriesBar extends StatelessWidget {
  const StoriesBar({super.key});

  @override
  Widget build(BuildContext context) {
    final stories = [
      _StoryItem(name: 'Your status', isOwn: true, hasNew: true),
      _StoryItem(name: 'Sunrise Apartments', hasNew: true),
      _StoryItem(name: 'Plumber Pro', hasNew: false),
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
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(s.hasNew
                            ? '${s.name} has new updates'
                            : 'No new updates from ${s.name}'),
                      ),
                    );
                  },
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: s.hasNew
                          ? const LinearGradient(
                              colors: [Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF8B5CF6)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: s.hasNew ? null : const Color(0xFF282828),
                      border: s.hasNew ? null : Border.all(color: Colors.white24, width: 2),
                    ),
                    padding: const EdgeInsets.all(2),
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFF282828),
                      ),
                      child: Center(
                        child: Text(
                          s.name.isEmpty ? '?' : s.name[0].toUpperCase(),
                          style: const TextStyle(
                            color: Color(0xFF1DB954),
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  width: 64,
                  child: Text(
                    s.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ),
              ],
            ),
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
