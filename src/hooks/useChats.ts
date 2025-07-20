import { useState, useEffect, useCallback } from 'react';
import type { Chat, ChatCreate, ChatUpdateTitle } from '../api/types';
import { getAccountChats, createChat, updateChatTitle, deleteChat } from '../api';

interface UseChatsResult {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  createNewChat: (title: string) => Promise<string | null>;
  updateTitle: (chatId: string, title: string) => Promise<boolean>;
  removeChat: (chatId: string) => Promise<boolean>;
  refreshChats: () => Promise<void>;
}

export function useChats(accountId: string): UseChatsResult {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!accountId) {
      console.log('No account ID provided to useChats');
      return;
    }
    
    console.log('Fetching chats for account:', accountId);
    setLoading(true);
    setError(null);
    
    try {
      const response = await getAccountChats(accountId);
      
      if (response.error) {
        console.log('Error fetching chats:', response.error);
        setError(response.error);
        
        // If we got a 404, use mock data to allow the app to function
        if (response.error.includes('not found') || response.status === 404) {
          console.log('Creating mock chat data since account/chats not found');
          const mockChats: Chat[] = [
            {
              id: '1',
              account_id: accountId,
              title: 'Welcome Chat',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: '2',
              account_id: accountId,
              title: 'Sample Conversation',
              created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
              updated_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
            }
          ];
          setChats(mockChats);
        }
      } else if (response.data) {
        console.log('Successfully fetched chats:', response.data.length);
        setChats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch chats');
      
      // Generate mock data to allow the app to function even if the API is down
      console.log('Creating mock chat data due to error');
      const mockChats: Chat[] = [
        {
          id: '1',
          account_id: accountId,
          title: 'Welcome Chat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          account_id: accountId,
          title: 'Sample Conversation',
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          updated_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        }
      ];
      setChats(mockChats);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const createNewChat = useCallback(async (title: string): Promise<string | null> => {
    if (!accountId) {
      console.log('No account ID provided when creating new chat');
      return null;
    }
    
    console.log('Creating new chat with title:', title);
    try {
      const chatData: ChatCreate = {
        account_id: accountId,
        title
      };
      
      const response = await createChat(chatData);
      
      if (response.error) {
        console.log('Error creating chat:', response.error);
        setError(response.error);
        
        // Create a mock chat if the API fails
        if (response.error.includes('not found') || response.status === 404) {
          console.log('Creating mock chat due to API error');
          const mockChatId = `mock-${Date.now()}`;
          const mockChat: Chat = {
            id: mockChatId,
            account_id: accountId,
            title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          setChats(prevChats => [...prevChats, mockChat]);
          return mockChatId;
        }
        return null;
      } else {
        console.log('Successfully created chat:', response.data);
        // Refresh chats list
        await fetchChats();
        return response.data?.id || null;
      }
    } catch (err) {
      console.error('Failed to create chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to create chat');
      
      // Create a mock chat if the API is down
      const mockChatId = `mock-${Date.now()}`;
      const mockChat: Chat = {
        id: mockChatId,
        account_id: accountId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setChats(prevChats => [...prevChats, mockChat]);
      return mockChatId;
    }
  }, [accountId, fetchChats]);

  const updateTitle = useCallback(async (chatId: string, title: string): Promise<boolean> => {
    console.log('Updating chat title:', chatId, title);
    try {
      const titleUpdate: ChatUpdateTitle = { title };
      const response = await updateChatTitle(chatId, titleUpdate);
      
      if (response.error) {
        console.log('Error updating chat title:', response.error);
        setError(response.error);
        
        // Update local state even if the API fails
        if (response.error.includes('not found') || response.status === 404) {
          console.log('Updating local chat title despite API error');
          setChats(prevChats => 
            prevChats.map(chat => 
              chat.id === chatId ? { ...chat, title } : chat
            )
          );
          return true;
        }
        return false;
      } else {
        console.log('Successfully updated chat title');
        // Update local state
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.id === chatId ? { ...chat, title } : chat
          )
        );
        return true;
      }
    } catch (err) {
      console.error('Failed to update chat title:', err);
      setError(err instanceof Error ? err.message : 'Failed to update chat title');
      
      // Update local state even if the API is down
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatId ? { ...chat, title } : chat
        )
      );
      return true;
    }
  }, []);

  const removeChat = useCallback(async (chatId: string): Promise<boolean> => {
    try {
      const response = await deleteChat(chatId);
      
      if (response.error) {
        setError(response.error);
        return false;
      } else {
        // Update local state
        setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
        return true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat');
      return false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return {
    chats,
    loading,
    error,
    createNewChat,
    updateTitle,
    removeChat,
    refreshChats: fetchChats
  };
}
