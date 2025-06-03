import { useState, useCallback } from 'react';

interface UseSimpleChatResult {
  streamingResponse: string;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<boolean>;
  resetStream: () => void;
}

/**
 * A simplified chat hook that uses HTTP fetch instead of Socket.IO
 * This avoids all the WebSocket connection issues
 */
export function useSimpleChat(accountId: string, conversationId: string): UseSimpleChatResult {
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reset streaming state
  const resetStream = useCallback(() => {
    setStreamingResponse('');
    setError(null);
  }, []);
  
  // Send a message using HTTP fetch with streaming response
  const sendMessage = useCallback(async (message: string): Promise<boolean> => {
    console.log('Sending message via HTTP fetch');
    resetStream();
    setIsStreaming(true);
    
    try {
      // Create the request
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          account_id: accountId,
          conversation_id: conversationId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      // Get the reader from the response body stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is null');
      }
      
      // Read the stream
      const decoder = new TextDecoder();
      let done = false;
      
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setStreamingResponse(prev => prev + chunk);
        }
      }
      
      setIsStreaming(false);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      setIsStreaming(false);
      return false;
    }
  }, [accountId, conversationId, resetStream]);
  
  return {
    streamingResponse,
    isStreaming,
    error,
    sendMessage,
    resetStream
  };
}
