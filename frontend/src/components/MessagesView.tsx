import React, { useEffect, useState, useRef } from 'react';
import { MessageFormatter } from './MessageFormatter';
import { Loader2 } from 'lucide-react';

interface MessagesViewProps {
  sessionId: string;
  sessionStatus?: string;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ sessionId, sessionStatus }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const outputs = await window.electron?.invoke('sessions:get-output', sessionId) || [];
        
        // Parse JSON messages only
        const jsonMessages = outputs
          .filter((output: any) => output.type === 'json')
          .map((output: any) => {
            try {
              return JSON.parse(output.data);
            } catch {
              return null;
            }
          })
          .filter((msg: any) => msg !== null);
        
        setMessages(jsonMessages);
        
        // Check if new messages have been added
        if (jsonMessages.length > lastMessageCountRef.current) {
          // Find the first tool_use message that doesn't have a corresponding result
          let lastToolIndex = -1;
          for (let i = jsonMessages.length - 1; i >= 0; i--) {
            const msg = jsonMessages[i];
            if (msg.type === 'assistant' && msg.message?.content) {
              const content = msg.message.content;
              if (Array.isArray(content)) {
                const hasToolUse = content.some((item: any) => item.type === 'tool_use');
                if (hasToolUse) {
                  // Check if there's a result after this
                  let hasResult = false;
                  for (let j = i + 1; j < jsonMessages.length; j++) {
                    const nextMsg = jsonMessages[j];
                    if (nextMsg.type === 'user' && nextMsg.message?.content) {
                      const nextContent = nextMsg.message.content;
                      if (Array.isArray(nextContent)) {
                        hasResult = nextContent.some((item: any) => item.type === 'tool_result');
                        if (hasResult) break;
                      }
                    }
                  }
                  if (!hasResult) {
                    lastToolIndex = i;
                    break;
                  }
                }
              }
            }
          }
          
          if (lastToolIndex >= 0 && (sessionStatus === 'running' || sessionStatus === 'waiting')) {
            setCurrentProcessingIndex(lastToolIndex);
            setProcessingStartTime(Date.now());
          } else {
            setCurrentProcessingIndex(null);
            setProcessingStartTime(null);
          }
          
          lastMessageCountRef.current = jsonMessages.length;
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
    
    // Poll for updates while session is active
    let interval: NodeJS.Timeout | null = null;
    if (sessionStatus === 'running' || sessionStatus === 'waiting') {
      interval = setInterval(loadMessages, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionId, sessionStatus]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No messages yet
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto p-4 space-y-4 bg-gray-900"
    >
      {messages.map((message, index) => (
        <MessageFormatter
          key={index}
          message={message}
          isProcessing={index === currentProcessingIndex}
          startTime={index === currentProcessingIndex ? processingStartTime : null}
        />
      ))}
      
      {/* Show loading indicator at the bottom when session is active */}
      {(sessionStatus === 'running' || sessionStatus === 'initializing') && (
        <div className="flex items-center gap-2 text-blue-400 pb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Claude is working...</span>
        </div>
      )}
    </div>
  );
};