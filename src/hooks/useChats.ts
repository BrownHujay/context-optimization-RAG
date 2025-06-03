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
    if (!accountId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await getAccountChats(accountId);
      
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setChats(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const createNewChat = useCallback(async (title: string): Promise<string | null> => {
    if (!accountId) return null;
    
    try {
      const chatData: ChatCreate = {
        account_id: accountId,
        title
      };
      
      const response = await createChat(chatData);
      
      if (response.error) {
        setError(response.error);
        return null;
      } else {
        // Refresh chats list
        await fetchChats();
        return response.data?.id || null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chat');
      return null;
    }
  }, [accountId, fetchChats]);

  const updateTitle = useCallback(async (chatId: string, title: string): Promise<boolean> => {
    try {
      const titleUpdate: ChatUpdateTitle = { title };
      const response = await updateChatTitle(chatId, titleUpdate);
      
      if (response.error) {
        setError(response.error);
        return false;
      } else {
        // Update local state
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.id === chatId ? { ...chat, title } : chat
          )
        );
        return true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chat title');
      return false;
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
