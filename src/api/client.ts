// API Client for Chat Application
import type { ApiResponse } from './types';

// Default API URL - should be updated in a production environment
// CRITICAL FIX: Ensure we're using the correct port for the FastAPI backend
// Port 8000 is standard for FastAPI but let's make it more robust
// Don't use process.env in browser code - it's not available
const API_BASE_URL = 'http://localhost:8000';
console.log('🌐 Using API base URL:', API_BASE_URL);

// HTTP Method types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Request options type
interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
}

// API Error class
export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * Handles HTTP requests to the API with retry capability
 */
export async function apiRequest<T>(
  endpoint: string, 
  options: RequestOptions = {},
  retries = 2 // Allow a few retries for transient network issues
): Promise<ApiResponse<T>> {
  try {
    const { method = 'GET', headers = {}, body } = options;
    
    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
    };
    
    // Add body if provided
    if (body) {
      requestOptions.body = JSON.stringify(body);
    }
    
    // Full URL for logging/debugging
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`🌐 Making ${method} request to: ${fullUrl}`);
    
    try {
      // Make the fetch request
      const response = await fetch(fullUrl, requestOptions);
      
      // Log status for debugging
      console.log(`📊 Response status: ${response.status} from ${endpoint}`);
      
      // Parse the response
      let data;
      try {
        data = response.status !== 204 ? await response.json() : null;
      } catch (parseError) {
        console.error('📛 Error parsing response:', parseError);
        return {
          error: 'Failed to parse response from server',
          status: response.status,
          rawResponse: await response.text() // Get raw text for debugging
        };
      }
      
      // Handle error responses
      if (!response.ok) {
        console.error(`❌ API error response (${response.status}):`, data);
        return {
          error: data?.detail || `Server error: ${response.statusText}`,
          status: response.status,
          data: data // Include any data returned even in error
        };
      }
      
      // Return successful response
      return {
        data,
        status: response.status,
      };
    } catch (fetchError) {
      // Handle network errors
      console.error(`📡 Network error for ${fullUrl}:`, fetchError);
      
      // Attempt to retry failed requests
      if (retries > 0) {
        console.log(`🔄 Retrying request to ${endpoint} (${retries} retries left)...`);
        // Add a small delay before retrying
        await new Promise(resolve => setTimeout(resolve, 300));
        return apiRequest(endpoint, options, retries - 1);
      }
      
      throw fetchError; // Re-throw after retries are exhausted
    }
  } catch (error) {
    console.error('❌ API request ultimately failed after retries:', error);
    
    // Create a detailed error message with debugging info
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Network error',
      url: `${API_BASE_URL}${endpoint}`,
      method: options.method || 'GET',
      // Include a stack trace for client-side debugging
      stack: error instanceof Error ? error.stack : undefined
    };
    
    console.error('📋 Detailed error info:', errorDetails);
    
    return {
      error: `Connection error: ${errorDetails.message}. Please check your network connection and try again.`,
      status: 0, // Use 0 to indicate network failure (no HTTP status)
      details: errorDetails
    };
  }
}

/**
 * Creates a WebSocket connection to the chat API
 * 
 * @deprecated This function is deprecated and will be removed in a future release.
 * Use the WebSocket implementation in useChat.ts instead to avoid connection conflicts.
 */
export function createWebSocketConnection(
  onMessage: (data: any) => void,
  onClose: () => void
): WebSocket {
  console.warn('⚠️ DEPRECATED: createWebSocketConnection is deprecated. Use the WebSocket implementation in useChat.ts.');
  
  // Use a consistent WebSocket URL
  const wsUrl = "ws://localhost:5173/ws/chat/stream";
  
  console.log(`🔌 CONNECTING WebSocket to URL: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);
  
  // Configure the WebSocket handlers
  ws.addEventListener('message', (event: MessageEvent) => {
    try {
      const rawData = event.data as string;
      console.log('📥 WebSocket message received:', rawData);
      
      // Try to parse as JSON first (for completion/error messages)
      try {
        const jsonData = JSON.parse(rawData);
        console.log('✅ Parsed as JSON:', jsonData);
        
        // ENHANCED MESSAGE HANDLING: Check for different event types from backend
        if (jsonData.event === 'token') {
          // Single token event
          console.log('🔤 Token received:', jsonData.token);
          onMessage({
            type: 'stream',
            content: jsonData.token || ''
          });
        } else if (jsonData.event === 'completion' || jsonData.completed) {
          // Stream completion event
          console.log('🏁 Stream completed');
          onMessage({
            type: 'end',
            content: '',
            metadata: jsonData
          });
        } else if (jsonData.event === 'error' || jsonData.error) {
          // Error event
          console.log('❌ Error event:', jsonData.error || jsonData.message);
          onMessage({
            type: 'error',
            content: jsonData.error || jsonData.message || 'Unknown error',
            metadata: jsonData
          });
        } else {
          // Other control messages
          console.log('ℹ️ Control message:', jsonData);
          onMessage({
            type: 'control',
            content: '',
            metadata: jsonData
          });
        }
      } catch (parseError) {
        // Not JSON, treat as streaming token
        console.log('🔤 Not JSON, treating as streaming token:', rawData);
        onMessage({
          type: 'stream',
          content: rawData
        });
      }
    } catch (error) {
      console.error('❌ Failed to process WebSocket message:', error);
    }
  });
  
  ws.addEventListener('close', () => {
    onClose();
  });
  
  // Simple connection opened handler - don't send any initialization message
  ws.addEventListener('open', () => {
    console.log('🔵 WebSocket connection established');
  });
  
  return ws;
}

export default {
  apiRequest,
  createWebSocketConnection,
};
