import { useState, useCallback, useRef } from 'react';

export interface UseHttpChatResult {
  streamingResponse: string;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<boolean>;
  resetStream: () => void;
  summary: {
    title?: string;
    bullets?: string[];
  } | null;
}

/**
 * A reliable chat hook that uses HTTP streaming instead of WebSockets
 * This avoids all the WebSocket connection issues
 */
export function useHttpChat(accountId: string, conversationId: string, streamingTextRef?: React.RefObject<HTMLPreElement>): UseHttpChatResult {
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ title?: string; bullets?: string[] } | null>(null);
  
  // Reference to the current stream controller
  const streamControllerRef = useRef<{ abort: () => void } | null>(null);
  
  // Function to reset the streaming state
  const resetStream = useCallback(() => {
    // First flag that streaming is complete
    setIsStreaming(false);
    
    // Store final response in localStorage as backup
    if (typeof window !== 'undefined' && streamingResponse) {
      try {
        localStorage.setItem('last_streaming_response', streamingResponse);
      } catch (e) {}
    }
    
    // Clear streaming response after a delay
    setTimeout(() => {
      setStreamingResponse("");
    }, 5000); // 5 second delay ensures smooth transition
  }, [streamingResponse]);
  
  // Flag to prevent duplicate saves - use ref to persist across renders
  const messageAlreadySavedRef = useRef<boolean>(false);
  
  // User's original message - saved when sending begins
  const userMessageRef = useRef<string>("");
  
  // Send a message using HTTP fetch with streaming response
  const sendMessage = useCallback(async (message: string): Promise<boolean> => {
    // Reset any previous state
    setStreamingResponse('');
    setError(null);
    setIsStreaming(true);
    
    // Reset our duplicate prevention flag
    messageAlreadySavedRef.current = false;
    
    // Store the user message for later database save
    userMessageRef.current = message;
    
    try {
      // Create the request payload
      const request = {
        message,
        account_id: accountId,
        conversation_id: conversationId
      };
      
      // Make a fetch request to start the stream
      const response = await fetch('/http/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        // Handle HTTP errors
        const errorText = await response.text();
        setError(errorText || `HTTP error ${response.status}`);
        setIsStreaming(false);
        return false;
      }
      
      if (!response.body) {
        setError('Response body is null');
        setIsStreaming(false);
        return false;
      }
      
      // Create a reader for the response stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      // Create an AbortController to allow canceling the stream
      const controller = { 
        abort: () => {
          try {
            reader.cancel();
          } catch (e) {
            console.error('Error canceling stream:', e);
          }
        } 
      };
      
      // Store the controller for later abortion if needed
      streamControllerRef.current = controller;
      
      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // Decode the chunk and add it to the buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete events in the buffer
        let eventEnd = buffer.indexOf('\n\n');
        while (eventEnd > -1) {
          const eventData = buffer.substring(0, eventEnd);
          buffer = buffer.substring(eventEnd + 2);
          
          // Parse the event data if it's valid
          if (eventData.startsWith('data: ')) {
            try {
              const jsonStr = eventData.substring(6);
              const jsonData = JSON.parse(jsonStr);
              
              switch (jsonData.type) {
                case 'start':
                  // Stream started - ensure UI is ready
                  setIsStreaming(true);
                  break;
                  
                case 'chunk':
                  // Get text chunk from the data object
                  const chunkText = jsonData.data.text || '';
                  fullResponse += chunkText;
                  
                  // MULTIPLE UPDATE METHODS FOR IMMEDIATE VISIBILITY:
                  
                  // 1. React state update
                  setStreamingResponse(fullResponse);
                  
                  // 2. Direct DOM update
                  if (streamingTextRef?.current) {
                    streamingTextRef.current.textContent = fullResponse;
                  }
                  
                  // 3. Update specific DOM elements
                  if (typeof document !== 'undefined') {
                    const elements = [
                      document.getElementById('streaming-text-display'),
                      document.getElementById('http-chat-streaming-content'),
                      document.getElementById('chat-input-streaming-content')
                    ];
                    
                    elements.forEach(el => {
                      if (el) el.textContent = fullResponse;
                    });
                  }
                  
                  // 4. Dispatch single event for other components
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('streaming-chunk', { 
                      detail: { text: fullResponse } 
                    }));
                  }
                  break;
                  
                case 'complete':
                  // Critical fix to prevent duplicate processing and database saves
                  // If this message has already been saved, skip all processing
                  if (messageAlreadySavedRef.current) {
                    console.log('Skipping duplicate message save - already processed');
                    break;
                  }
                  
                  // Immediately mark as processed to prevent any possibility of duplicate saves
                  // This flag persists across renders to ensure we never save twice
                  messageAlreadySavedRef.current = true;
                  
                  // Get the final complete response
                  fullResponse = jsonData.data.text || fullResponse;
                  setStreamingResponse(fullResponse);
                  
                  // Create a unique ID for this message combination to prevent duplicates
                  const messageUniqueId = `${Date.now()}-${conversationId}-${fullResponse.length}`;
                  
                  // First check if we've already saved this message by ID
                  try {
                    // Use session storage to track already saved messages during this session
                    const savedMessages = JSON.parse(sessionStorage.getItem('saved_message_ids') || '[]');
                    
                    if (savedMessages.includes(messageUniqueId)) {
                      console.log('Detected duplicate message save attempt, skipping database save');
                      setIsStreaming(false);
                      break;
                    }
                    
                    // Save ID to prevent future duplicates
                    savedMessages.push(messageUniqueId);
                    sessionStorage.setItem('saved_message_ids', JSON.stringify(savedMessages));
                  } catch (e) {
                    // If storage fails, continue with save attempt
                    console.warn('Failed to check for duplicate messages:', e);
                  }
                  
                  // Save to localStorage as backup
                  try {
                    localStorage.setItem('last_assistant_message', fullResponse);
                    localStorage.setItem('last_conversation_id', conversationId);
                  } catch (e) {}
                  
                  // Now save to database only once
                  try {
                    // Use our stored user message from the start of the interaction
                    const userMessage = userMessageRef.current;
                    
                    // Only log a brief message instead of full content
                    console.log('Saving message pair to database, conversation ID:', conversationId);
                    
                    // Use the message API to save a complete message with both prompt and response
                    const saveResponse = await fetch(`/api/messages`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        account_id: accountId,
                        chat_id: conversationId,
                        text: userMessage, // User's prompt
                        response: fullResponse, // AI's response
                        timestamp: new Date().toISOString(),
                        // Add unique ID to help backend prevent duplicates
                        _message_unique_id: messageUniqueId
                      }),
                    });
                    
                    // Notify other components after save, but only dispatch a single event
                    if (saveResponse.ok) {
                      console.log('Message pair saved successfully');
                      // Only dispatch one event to update the UI
                      window.dispatchEvent(new CustomEvent('database-messages-updated', {
                        detail: { conversationId }
                      }));
                    } else {
                      // Log error details if save failed
                      const errorText = await saveResponse.text();
                      console.error('Error saving message pair:', saveResponse.status, errorText);
                    }
                  } catch (error) {
                    console.error('Failed to save message pair:', error);
                  } finally {
                    // Turn off streaming flag first to signal completion
                    setIsStreaming(false);
                    
                    // Clear user message reference
                    userMessageRef.current = '';
                    
                    console.log('Streaming complete, message saved, UI refresh triggered');
                  }
                  break;
                  
                case 'summary':
                  // Handle summary data
                  setSummary(jsonData.data);
                  break;
                  
                case 'error':
                  // Handle error
                  console.log("Streaming response (raw):", response.body);
                  console.error('Stream error:', jsonData.data.message);
                  setError(jsonData.data.message || 'Unknown error');
                  setIsStreaming(false);
                  return false;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e, eventData);
            }
          }
          
          eventEnd = buffer.indexOf('\n\n');
        }
      }
      
      // Clean up after streaming is done
      setIsStreaming(false);
      streamControllerRef.current = null;
      return true;
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      setIsStreaming(false);
      streamControllerRef.current = null;
      return false;
    }
  }, [accountId, conversationId, streamingTextRef]);

  
  return {
    streamingResponse,
    isStreaming,
    error,
    sendMessage,
    resetStream,
    summary
  };
}
