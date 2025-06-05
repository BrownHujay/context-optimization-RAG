import { useState, useRef, useCallback } from 'react';
import { parseSSEStream, streamChat } from '../utils/streamParser';

// Define Message type here to avoid dependency on ../types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Define the interface for the hook result
export interface UseHttpChatResult {
  messages: ChatMessage[];
  streamingResponse: string;
  isStreaming: boolean;
  error: string | null;
  streamingId: string | null; // Add streamingId to track which message is being streamed
  sendMessage: (message: string, originalMessageId?: string) => Promise<boolean>;
  resetStream: () => void;
  cancelMessage: () => void;
  summary: {
    title?: string;
    bullets?: string[];
  } | null;
}

/**
 * A reliable chat hook that uses HTTP streaming instead of WebSockets
 * This avoids all the WebSocket connection issues
 */
export function useHttpChat(accountId: string, conversationId: string): UseHttpChatResult {
  // State for messages and streaming
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingResponse, setStreamingResponse] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null); // Add streamingId state
  const [summary, setSummary] = useState<{ title?: string; bullets?: string[] } | null>(null);
  
  // Reference to abort controller for cancellation
  const streamControllerRef = useRef<AbortController | null>(null);
  
  // Function to reset streaming state
  const resetStream = useCallback(() => {
    setIsStreaming(false);
    setStreamingResponse('');
    setStreamingId(null);
    setError(null);
  }, []);
  
  // Function to cancel an ongoing streaming message
  const cancelMessage = useCallback(() => {
    if (streamControllerRef.current) {
      console.log('🛑 Cancelling stream request');
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);
  
  /**
   * Send a message to the chat API and stream the response
   */
  const sendMessage = useCallback(async (
    message: string,
    originalMessageId?: string
  ): Promise<boolean> => {
    console.log('📤 Sending message:', message);
    if (!message.trim()) {
      return false;
    }
    
    // Reset streaming state
    resetStream();
    setIsStreaming(true);
    
    try {
      // Create a user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message.trim(),
        timestamp: Date.now()
      };
      
      // Add user message to state
      setMessages(prev => [...prev, userMessage]);
      
      // Create abort controller for fetch
      const controller = new AbortController();
      streamControllerRef.current = controller;
      
      // Log the request
      const messageStr = typeof message === 'string' ? message : String(message);
      console.log(`📤 Sending message: ${messageStr.substring(0, 50)}${messageStr.length > 50 ? '...' : ''}`);
      
      // Generate a streaming ID for the assistant message that will be created
      const currentStreamingId = `assistant-${Date.now()}`;
      setStreamingId(currentStreamingId);
      
      // Create request with correct API URL
      const API_BASE_URL = 'http://localhost:8000';
      const request = new Request(`${API_BASE_URL}/http/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          account_id: accountId, 
          conversation_id: conversationId,
          original_message_id: originalMessageId || undefined
        }),
        signal: controller.signal
      });

      try {
        // Get the response stream
        const stream = await streamChat(request);
        let fullText = '';
        
        // Process the SSE stream
        for await (const chunk of parseSSEStream(stream)) {
          try {
            // Ensure chunk is treated as string
            const chunkText = String(chunk);
            
            // Accumulate the text for the complete response
            fullText += chunkText;
            
            // Update the streaming response state
            setStreamingResponse(fullText);
            
            console.log(`💬 Received chunk: ${chunkText.substring(0, 20)}${chunkText.length > 20 ? '...' : ''}`);
          } catch (chunkError) {
            console.error('Error processing chunk:', chunkError);
          }
        }
        
        console.log(`💬 Stream completed, total length: ${fullText.length}`);
        
        // First, mark streaming as complete but keep the response for transition
        // We don't add a new message to the array anymore, instead we rely on
        // the streamingId to identify which message was being streamed
        setIsStreaming(false);
        
        // Clear the controller reference immediately
        streamControllerRef.current = null;
        
        // We keep both the streamingResponse and streamingId briefly to allow
        // the Messages component to handle the transition from streaming to permanent
        // This gives Messages.tsx time to detect the transition state
        setTimeout(() => {
          setStreamingResponse('');
          setStreamingId(null);
        }, 500); // Increased delay to ensure state transitions properly
        return true;
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        setError(streamError instanceof Error ? streamError.message : 'Unknown streaming error');
        setIsStreaming(false);
        streamControllerRef.current = null;
        return false;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      setIsStreaming(false);
      return false;
    }
  }, [accountId, conversationId, resetStream]);

  return {
    messages,
    streamingResponse,
    isStreaming,
    error,
    streamingId,
    sendMessage,
    resetStream,
    cancelMessage,
    summary
  };
}
