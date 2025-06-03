// Chat API Service (for real-time chat functionality)
import { apiRequest } from './client';
import type { 
  ChatRequest,
  ApiResponse
} from './types';

/**
 * Send a chat message (non-streaming version)
 */
export async function sendChatMessage(chatRequest: ChatRequest): Promise<ApiResponse<any>> {
  return apiRequest('/chat', {
    method: 'POST',
    body: chatRequest,
  });
}

/**
 * Send a streaming chat message over HTTP streaming
 * This uses server-sent events (SSE) to stream the response from the server
 */
export function createChatStream(
  accountId: string,
  conversationId: string,
  onStart: () => void,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onSummary: (summary: any) => void,
  onError: (error: string) => void
): { abort: () => void } {
  // Create an AbortController to allow canceling the stream
  const controller = new AbortController();
  const { signal } = controller;
  
  // Flag to track if the stream is active
  let isActive = true;
  
  // Start the streaming process
  (async () => {
    try {
      // Create the EventSource for SSE
      const eventSource = new EventSource(`/http/stream?account_id=${accountId}&conversation_id=${conversationId}`);
      
      // Track when the stream should be aborted
      signal.addEventListener('abort', () => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
        isActive = false;
      });
      
      // Handle incoming events
      eventSource.onmessage = (event) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'start':
              onStart();
              break;
              
            case 'chunk':
              onChunk(data.data.chunk || '');
              break;
              
            case 'complete':
              onComplete(data.data.full_response || '');
              eventSource.close();
              break;
              
            case 'summary':
              onSummary(data.data);
              break;
              
            case 'error':
              onError(data.data.message || 'Unknown error');
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
          onError('Failed to parse server response');
          eventSource.close();
        }
      };
      
      // Handle connection errors
      eventSource.onerror = () => {
        if (!isActive) return;
        onError('Stream connection error');
        eventSource.close();
      };
      
    } catch (error) {
      if (!isActive) return;
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  })();
  
  // Return an object with an abort method
  return {
    abort: () => {
      isActive = false;
      controller.abort();
    }
  };
}

/**
 * Send a streaming chat message over HTTP
 */
export async function sendStreamMessage(
  accountId: string,
  conversationId: string,
  message: string,
  onStart: () => void,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onSummary: (summary: any) => void,
  onError: (error: string) => void
): Promise<{ abort: () => void }> {
  try {
    // Prepare the request
    const request: ChatRequest = {
      account_id: accountId,
      conversation_id: conversationId,
      message: message
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
      throw new Error(errorText || `HTTP error ${response.status}`);
    }
    
    if (!response.body) {
      throw new Error('Response body is null');
    }
    
    // Create a reader for the response stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Create an AbortController to allow canceling the stream
    const controller = new AbortController();
    let isActive = true;
    
    // Signal handler for aborting
    controller.signal.addEventListener('abort', () => {
      isActive = false;
    });
    
    // Process the stream
    (async () => {
      try {
        onStart();
        let fullResponse = '';
        
        while (isActive) {
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
                const jsonData = JSON.parse(eventData.substring(6));
                
                switch (jsonData.type) {
                  case 'chunk':
                    // Backend sends text property, not chunk
                    const chunkText = jsonData.data.text || '';
                    onChunk(chunkText);
                    fullResponse += chunkText;
                    break;
                    
                  case 'complete':
                    // Backend sends text property, not full_response
                    onComplete(jsonData.data.text || fullResponse);
                    break;
                    
                  case 'summary':
                    onSummary(jsonData.data);
                    break;
                    
                  case 'error':
                    onError(jsonData.data.message || 'Unknown error');
                    return;
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e, eventData);
              }
            }
            
            eventEnd = buffer.indexOf('\n\n');
          }
        }
      } catch (error) {
        if (isActive) {
          onError(error instanceof Error ? error.message : 'Stream processing error');
        }
      }
    })();
    
    // Return an object with an abort method
    return { 
      abort: () => {
        isActive = false;
        controller.abort();
        try {
          reader.cancel();
        } catch (e) {
          console.error('Error canceling stream:', e);
        }
      } 
    };
    
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Failed to start stream');
    return { abort: () => {} }; // Return a no-op abort function
  }
}
