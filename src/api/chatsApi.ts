// Chats API Service
import { apiRequest } from './client';
import type { 
  Chat,
  ChatCreate, 
  ChatUpdateTitle,
  Message,
  ApiResponse
} from './types';

/**
 * Create a new chat
 */
export async function createChat(chatData: ChatCreate): Promise<ApiResponse<{ id: string, message: string }>> {
  return apiRequest('/chats', {
    method: 'POST',
    body: chatData,
  });
}

/**
 * Get chat by ID
 */
export async function getChat(chatId: string): Promise<ApiResponse<Chat>> {
  return apiRequest(`/chats/${chatId}`);
}

/**
 * Update chat title
 */
export async function updateChatTitle(
  chatId: string, 
  titleUpdate: ChatUpdateTitle
): Promise<ApiResponse<{ message: string }>> {
  return apiRequest(`/chats/${chatId}/title`, {
    method: 'PUT',
    body: titleUpdate,
  });
}

/**
 * Delete chat
 */
export async function deleteChat(chatId: string): Promise<ApiResponse<{ message: string }>> {
  return apiRequest(`/chats/${chatId}`, {
    method: 'DELETE',
  });
}

/**
 * Get chat messages
 */
export async function getChatMessages(chatId: string): Promise<ApiResponse<Message[]>> {
  return apiRequest(`/chats/${chatId}/messages`);
}

/**
 * Get recent messages for a chat
 */
export async function getRecentMessages(chatId: string, limit?: number): Promise<ApiResponse<Message[]>> {
  const queryParams = limit ? `?limit=${limit}` : '';
  return apiRequest(`/chats/${chatId}/messages/recent${queryParams}`);
}
