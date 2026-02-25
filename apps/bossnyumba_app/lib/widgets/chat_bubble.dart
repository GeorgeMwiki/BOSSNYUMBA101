import 'package:flutter/material.dart';

class ChatBubble extends StatelessWidget {
  final String message;
  final bool isSent;
  final String? sender;
  final String? time;
  final bool isGroup;

  const ChatBubble({
    super.key,
    required this.message,
    required this.isSent,
    this.sender,
    this.time,
    this.isGroup = false,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isSent ? Alignment.centerRight : Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Column(
          crossAxisAlignment: isSent ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (isGroup && !isSent && sender != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 2, left: 4),
                child: Text(
                  sender!,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF1DB954), fontWeight: FontWeight.w600),
                ),
              ),
            Container(
              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.85),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isSent ? const Color(0xFF1DB954) : const Color(0xFF282828),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isSent ? 18 : 4),
                  bottomRight: Radius.circular(isSent ? 4 : 18),
                ),
              ),
              child: Text(
                message,
                style: TextStyle(
                  color: isSent ? Colors.black : Colors.white,
                  fontSize: 15,
                ),
              ),
            ),
            if (time != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  time!,
                  style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
