import { useState, useEffect, useCallback } from 'react';
import type { Message, MessageCreate } from '../api/types';
import { getChatMessages, createMessage, updateMessage } from '../api';

interface UseMessagesResult {
  messages: Message[];
  loading: boolean;
  error: string | null;
  addMessage: (text: string, role: 'user' | 'assistant', responseText?: string) => Promise<string | null>;
  updateMessage: (messageId: string, updateData: Partial<MessageCreate>) => Promise<boolean>;
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
    console.log("addMessage CALLED", { text, role, responseText, stack: new Error().stack });
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
        response: role === 'assistant' ? text : (responseText || "[No response yet]"),
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

  // Add a function to update an existing message
  const updateMessageFunc = useCallback(async (
    messageId: string,
    updateData: Partial<MessageCreate>
  ): Promise<boolean> => {
    if (!messageId) {
      console.error('Cannot update message: Missing message ID');
      return false;
    }
    
    try {
      console.log(`Updating message ${messageId} with data:`, updateData);
      const response = await updateMessage(messageId, updateData);
      
      if (response.error) {
        setError(response.error);
        console.log('Error updating message:', response.error);
        return false;
      } else {
        // Update the message in local state
        setMessages(prev => prev.map(currentMsg => {
          if (currentMsg.id === messageId) {
            // Create a new object based on the current message, conforming to the Message type
            const updatedMessageState: Message = { ...currentMsg };

            // Apply 'response' from updateData if it exists
            if (updateData.response !== undefined) {
              updatedMessageState.response = updateData.response;
            }
            // Apply 'text' from updateData if it exists and is meant to update the message text
            if (updateData.text !== undefined) {
              updatedMessageState.text = updateData.text;
            }
            // Add any other fields from Partial<MessageCreate> that should update the Message state

            // Crucially, update the 'role' field based on '_role' from updateData
            if (updateData._role) {
              updatedMessageState.role = updateData._role;
            }
            return updatedMessageState;
          }
          return currentMsg;
        }));
        console.log('Message updated successfully:', messageId);
        return true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message');
      console.log('Error updating message:', err);
      return false;
    }
  }, []);

  return {
    messages,
    loading,
    error,
    addMessage,
    updateMessage: updateMessageFunc,
    refreshMessages: fetchMessages
  };
}
