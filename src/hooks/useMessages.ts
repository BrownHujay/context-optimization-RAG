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
    if (!chatId) {
      console.log("No chatId provided to fetchMessages");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Fetching messages for chat:", chatId);
      const response = await getChatMessages(chatId);
      
      if (response.error) {
        console.log("Error fetching messages:", response.error);
        setError(response.error);
        
        // If we get a 404 or other error, create mock messages
        if (response.error.includes('not found') || response.status === 404) {
          console.log("Creating mock messages for chat", chatId);
          const mockMessages: Message[] = [
            {
              id: `welcome-${chatId}`,
              account_id: accountId,
              chat_id: chatId,
              text: "Hello! How can I help you today?",
              role: 'assistant',
              created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
            }
          ];
          setMessages(mockMessages);
        }
      } else if (response.data) {
        console.log("Messages fetched successfully:", response.data.length);
        setMessages(response.data);
      } else {
        // Empty response with no error
        console.log("No messages returned for chat", chatId);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
      
      // Create mock welcome message
      const mockMessages: Message[] = [
        {
          id: `welcome-${chatId}`,
          account_id: accountId,
          chat_id: chatId,
          text: "Hello! How can I help you today?",
          role: 'assistant',
          created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        }
      ];
      setMessages(mockMessages);
    } finally {
      setLoading(false);
    }
  }, [chatId, accountId]);

  const addMessage = useCallback(async (
    text: string,
    role: 'user' | 'assistant',
    responseText?: string
  ): Promise<string | null> => {
    console.log("addMessage CALLED", { text, role, responseText, stack: new Error().stack });
    if (!accountId || !chatId) {
      console.log("Missing accountId or chatId", { accountId, chatId });
      return null;
    }
    
    // Create a temporary message ID for local state management
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // First add message to local state immediately for better UX
    const newMessage: Message = {
      id: tempId,
      account_id: accountId,
      chat_id: chatId,
      text: text,
      response: role === 'assistant' ? text : (responseText || "[No response yet]"),
      role,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    console.log("Message added to local state:", newMessage);
    
    try {
      // Check if accountId is a valid MongoDB ObjectId (24 hex chars)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(accountId);
      
      if (!isValidObjectId) {
        console.error("Invalid accountId format, not sending to backend:", accountId);
        setError('Invalid account ID format');
        return tempId; // Return the temp ID to allow UI updates
      }
      
      // BACKEND VALIDATION FIX: Both text AND response fields are REQUIRED as non-empty strings
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
        console.log("Error creating message:", response.error);
        setError(response.error);
        // Keep the message in local state with temp ID
        return tempId;
      } else {
        // Update the temporary message with the real ID from the backend
        const realId = response.data?.id || tempId;
        
        if (realId !== tempId) {
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, id: realId } : msg
          ));
        }
        
        console.log("Message successfully saved to backend with ID:", realId);
        return realId;
      }
    } catch (err) {
      console.error("Error adding message:", err);
      setError(err instanceof Error ? err.message : 'Failed to add message');
      // The message is already in local state with the temp ID
      return tempId;
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
    
    // Check if it's a temporary ID (not from backend)
    const isTempId = messageId.startsWith('temp-');
    
    // Always update the message in local state first for better UX
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
    
    // For temporary messages or if accountId isn't a valid ObjectId, don't call the backend
    if (isTempId || !/^[0-9a-fA-F]{24}$/.test(accountId)) {
      console.log(`Skipping backend update for ${isTempId ? 'temporary' : 'invalid account ID'} message:`, messageId);
      return true; // Return success since we've updated the local state
    }
    
    try {
      console.log(`Updating message ${messageId} in backend with data:`, updateData);
      const response = await updateMessage(messageId, updateData);
      
      if (response.error) {
        setError(response.error);
        console.log('Error updating message in backend:', response.error);
        return true; // Still return true since local state was updated
      } 
      
      console.log('Message updated successfully in backend:', messageId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message in backend');
      console.log('Error updating message in backend:', err);
      return true; // Still return true since local state was updated
    }
  }, [accountId]);

  return {
    messages,
    loading,
    error,
    addMessage,
    updateMessage: updateMessageFunc,
    refreshMessages: fetchMessages
  };
}
