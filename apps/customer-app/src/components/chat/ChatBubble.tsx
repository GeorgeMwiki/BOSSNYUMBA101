'use client';

interface ChatBubbleProps {
  message: string;
  isSent: boolean;
  sender?: string;
  time?: string;
  isGroup?: boolean;
}

export function ChatBubble({
  message,
  isSent,
  sender,
  time,
  isGroup,
}: ChatBubbleProps) {
  return (
    <div className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[85%] ${isSent ? 'items-end' : 'items-start'}`}>
        {isGroup && !isSent && sender && (
          <p className="text-xs text-spotify-green mb-0.5 ml-1 font-medium">{sender}</p>
        )}
        <div
          className={
            isSent
              ? 'chat-bubble-sent'
              : 'chat-bubble-received'
          }
        >
          <p className="text-sm break-words">{message}</p>
        </div>
        {time && (
          <p className={`text-[10px] text-gray-500 mt-0.5 ${isSent ? 'text-right' : 'text-left'}`}>
            {time}
          </p>
        )}
      </div>
    </div>
  );
}
