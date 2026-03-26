'use client';

import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
      <div className="p-3 bg-gray-800 rounded-full mb-4">
        <MessageSquare className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-white font-semibold text-lg">No conversations yet</h3>
      <p className="text-gray-400 text-sm mt-1 max-w-xs">
        Messages with your property manager will appear here.
      </p>
    </div>
  );
}
