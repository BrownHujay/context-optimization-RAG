// Messages API Service
import { apiRequest } from './client';
import type { 
  Message,
  MessageCreate,
  SearchQuery,
  ApiResponse
} from './types';

/**
 * Create a new message
 */
export async function createMessage(messageData: MessageCreate): Promise<ApiResponse<{ id: string, message: string }>> {
  // Validate required fields before sending to backend
  if (!messageData.text || !messageData.response) {
    console.error('Message data missing required fields:', messageData);
    return {
      error: 'Missing required fields: text and response must both be present',
      data: undefined,
      status: 400
    };
  }
  
  // Filter out frontend-only fields (those prefixed with underscore)
  const apiMessageData = Object.fromEntries(
    Object.entries(messageData).filter(([key]) => !key.startsWith('_'))
  );
  
  console.log('Sending message data to backend:', apiMessageData);
  
  return apiRequest('/messages', {
    method: 'POST',
    body: apiMessageData,
  });
}

/**
 * Search messages by query
 */
export async function searchMessages(searchData: SearchQuery): Promise<ApiResponse<Message[]>> {
  console.log('Sending search data to backend:', searchData);
  return apiRequest('/messages/search', {
    method: 'POST',
    body: searchData,
  });
}

/**
 * Update an existing message
 * Used to update assistant responses after streaming completes
 */
export async function updateMessage(
  messageId: string, 
  updateData: Partial<MessageCreate>
): Promise<ApiResponse<{ id: string, message: string }>> {
  if (!messageId) {
    console.error('Cannot update message: Missing message ID');
    return {
      error: 'Missing message ID',
      data: undefined,
      status: 400
    };
  }
  
  // Filter out frontend-only fields (those prefixed with underscore)
  const apiUpdateData = Object.fromEntries(
    Object.entries(updateData).filter(([key]) => !key.startsWith('_'))
  );
  
  console.log(`Updating message ${messageId} with data:`, apiUpdateData);
  
  return apiRequest(`/messages/${messageId}`, {
    method: 'PUT',
    body: apiUpdateData,
  });
}
