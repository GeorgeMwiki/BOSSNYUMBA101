import 'package:flutter/material.dart';

class FeedCard extends StatefulWidget {
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
  State<FeedCard> createState() => _FeedCardState();
}

class _FeedCardState extends State<FeedCard> {
  late int _likes = widget.likes;
  bool _liked = false;
  bool _saved = false;

  void _toggleLike() {
    setState(() {
      if (_liked) {
        _liked = false;
        _likes = (_likes - 1).clamp(0, 1 << 30);
      } else {
        _liked = true;
        _likes += 1;
      }
    });
  }

  void _toggleSave() {
    setState(() => _saved = !_saved);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_saved ? 'Post saved' : 'Removed from saved')),
    );
  }

  void _showComments() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Comments are available after your lease is activated')),
    );
  }

  void _share() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Sharing "${widget.author}" post link copied')),
    );
  }

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
                    widget.author.isEmpty ? '?' : widget.author[0].toUpperCase(),
                    style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.author, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
                      Text(widget.timeAgo, style: TextStyle(fontSize: 12, color: Colors.grey[400])),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (widget.imageUrl != null)
            AspectRatio(
              aspectRatio: 1,
              child: Container(
                color: const Color(0xFF181818),
                child: Center(child: Icon(Icons.image, size: 48, color: Colors.grey[600])),
              ),
            ),
          if (widget.content != null && widget.content!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Text(widget.content!, style: TextStyle(color: Colors.grey[300], fontSize: 14)),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _ActionButton(
                  icon: _liked ? Icons.favorite : Icons.favorite_border,
                  color: _liked ? const Color(0xFFEC4899) : Colors.grey[400]!,
                  label: _likes > 0 ? '$_likes' : 'Like',
                  onTap: _toggleLike,
                ),
                const SizedBox(width: 16),
                _ActionButton(
                  icon: Icons.chat_bubble_outline,
                  color: Colors.grey[400]!,
                  label: widget.comments > 0 ? '${widget.comments}' : 'Comment',
                  onTap: _showComments,
                ),
                const SizedBox(width: 16),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  icon: Icon(Icons.share_outlined, size: 22, color: Colors.grey[400]),
                  onPressed: _share,
                ),
                const Spacer(),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  icon: Icon(
                    _saved ? Icons.bookmark : Icons.bookmark_border,
                    size: 22,
                    color: _saved ? const Color(0xFF1DB954) : Colors.grey[400],
                  ),
                  onPressed: _toggleSave,
                ),
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
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 13, color: color)),
          ],
        ),
      ),
    );
  }
}
