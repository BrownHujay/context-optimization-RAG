import { useState, useEffect, useCallback } from 'react';
import type { Message, MessageCreate } from '../api/types';
import { getChatMessages, createMessage } from '../api';

interface UseMessagesResult {
  messages: Message[];
  loading: boolean;
  error: string | null;
  addMessage: (text: string, role: 'user' | 'assistant', responseText?: string) => Promise<string | null>;
  refreshMessages: () => Promise<void>;
}

export function useMessages(accountId: string, chatId: string): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await getChatMessages(chatId);
      
      if (response.error) {
        console.log("Error fetching messages:", response.error);
        setError(response.error);
      } else if (response.data) {
        console.log("Messages fetched successfully:", response.data);
        setMessages(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  const addMessage = useCallback(async (
    text: string, 
    role: 'user' | 'assistant',
    responseText?: string
  ): Promise<string | null> => {
    if (!accountId || !chatId) return null;
    
    try {
      // BACKEND VALIDATION FIX: Both text AND response fields are REQUIRED as non-empty strings
      // This critical fix ensures we always send valid data that matches backend expectations
      const messageData: MessageCreate = {
        account_id: accountId,
        chat_id: chatId,
        // For user messages: actual message in text, placeholder in response
        // For assistant messages: placeholder in text, actual message in response
        text: role === 'user' ? text : 'Assistant message',
        // Always ensure response field has a non-empty value
        response: role === 'assistant' ? text : (responseText || 'No response'),
        _role: role // Store role locally
      };
      
      console.log('Sending message data to backend:', messageData);
      
      const response = await createMessage(messageData);
      
      if (response.error) {
        setError(response.error);
        console.log("Error creating message:", response.error);
        return null;
      } else {
        // Add message to local state immediately for better UX
        const newMessage: Message = {
          id: response.data?.id || 'temp-id',
          account_id: accountId,
          chat_id: chatId,
          text,
          response: responseText,
          role,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, newMessage]);
        console.log("Message added successfully:", newMessage);
        return response.data?.id || null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add message');
      console.log("Error adding message:", err);
      return null;
    }
  }, [accountId, chatId]);

  // Initial fetch
  useEffect(() => {
    if (chatId) {
      fetchMessages();
    }
  }, [fetchMessages, chatId]);

  return {
    messages,
    loading,
    error,
    addMessage,
    refreshMessages: fetchMessages
  };
}
