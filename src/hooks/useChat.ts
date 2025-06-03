import { useState, useCallback, useEffect, useRef } from 'react';
import { sendStreamMessage } from '../api/chatApi';

export interface UseChatResult {
  streamingResponse: string;
  isStreaming: boolean;
  loading: boolean;
  error: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  sendStreamingMessage: (message: string) => Promise<boolean>;
  stopStream: () => void;
  resetStream: () => void;
  summary: {
    title?: string;
    bullets?: string[];
  } | null;
}

/**
 * React hook for chat functionality with HTTP streaming
 */
export function useChat(accountId: string, conversationId: string, streamingTextRef?: React.RefObject<HTMLPreElement | null>): UseChatResult {
  // State for messages and loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connected');
  const [summary, setSummary] = useState<{ title?: string; bullets?: string[] } | null>(null);
  
  // Reference to the current stream controller
  const streamControllerRef = useRef<{ abort: () => void } | null>(null);
  
  // Reset streaming state
  const resetStream = useCallback(() => {
    setStreamingResponse('');
    setError(null);
    setSummary(null);
    
    // Stop any active stream
    if (streamControllerRef.current && isStreaming) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [isStreaming]);
  
  // Stop the current stream
  const stopStream = useCallback(() => {
    if (streamControllerRef.current && isStreaming) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [isStreaming]);
  
  // Send streaming message via HTTP streaming
  const sendStreamingMessage = useCallback(async (message: string): Promise<boolean> => {
    console.log('Starting HTTP streaming message');
    resetStream();
    setLoading(true);
    
    try {
      // Set streaming state
      setIsStreaming(true);
      
      // Send the message using HTTP streaming
      const controller = await sendStreamMessage(
        accountId,
        conversationId,
        message,
        // onStart
        () => {
          console.log('Stream started');
        },
        // onChunk
        (chunk) => {
          const newResponse = (streamingResponse || '') + chunk;
          setStreamingResponse(newResponse);
          
          // Directly update DOM if ref is provided
          if (streamingTextRef?.current) {
            streamingTextRef.current.textContent = newResponse;
          }
        },
        // onComplete
        (_fullResponse) => {
          console.log('Stream completed');
          setIsStreaming(false);
          setLoading(false);
        },
        // onSummary
        (summaryData) => {
          console.log('Received summary:', summaryData);
          setSummary(summaryData);
        },
        // onError
        (errorMessage) => {
          console.error('Stream error:', errorMessage);
          setError(errorMessage);
          setIsStreaming(false);
          setLoading(false);
        }
      );
      
      // Store the controller for later abortion if needed
      streamControllerRef.current = controller;
      
      return true;
    } catch (error) {
      console.error('Error sending streaming message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      setIsStreaming(false);
      setLoading(false);
      return false;
    }
  }, [accountId, conversationId, resetStream]);
  
  // Clean up any active streams when component unmounts
  useEffect(() => {
    return () => {
      if (streamControllerRef.current) {
        streamControllerRef.current.abort();
        streamControllerRef.current = null;
      }
    };
  }, []);
  
  return {
    loading,
    error,
    streamingResponse,
    isStreaming,
    connectionStatus,
    sendStreamingMessage,
    stopStream,
    resetStream,
    summary
  };
}
