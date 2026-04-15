import 'package:flutter/material.dart';

class FeedCard extends StatelessWidget {
  final String author;
  final String? content;
  final String? imageUrl;
  final int likes;
  final int comments;
  final String timeAgo;

  const FeedCard({
    super.key,
    required this.author,
    this.content,
    this.imageUrl,
    this.likes = 0,
    this.comments = 0,
    this.timeAgo = '2h',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF282828),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: const Color(0xFF1DB954),
                  child: Text(
                    author.isEmpty ? '?' : author[0].toUpperCase(),
                    style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(author, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
                      Text(timeAgo, style: TextStyle(fontSize: 12, color: Colors.grey[400])),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (imageUrl != null)
            AspectRatio(
              aspectRatio: 1,
              child: Container(
                color: const Color(0xFF181818),
                child: Center(child: Icon(Icons.image, size: 48, color: Colors.grey[600])),
              ),
            ),
          if (content != null && content!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Text(content!, style: TextStyle(color: Colors.grey[300], fontSize: 14)),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _ActionButton(icon: Icons.favorite_border, label: likes > 0 ? '$likes' : 'Like'),
                const SizedBox(width: 16),
                _ActionButton(icon: Icons.chat_bubble_outline, label: comments > 0 ? '$comments' : 'Comment'),
                const SizedBox(width: 16),
                Icon(Icons.share_outlined, size: 22, color: Colors.grey[400]),
                const Spacer(),
                Icon(Icons.bookmark_border, size: 22, color: Colors.grey[400]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;

  const _ActionButton({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 22, color: Colors.grey[400]),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[400])),
      ],
    );
  }
}
