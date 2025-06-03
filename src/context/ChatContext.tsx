import React, { createContext, useState, useContext } from 'react';
import type { Chat } from '../api/types';
import { useChats } from '../hooks';
import { useAuth } from './AuthContext';

interface ChatContextType {
  activeChat: Chat | null;
  setActiveChat: (chat: Chat | null) => void;
  chats: Chat[];
  loading: boolean;
  error: string | null;
  createNewChat: (title: string) => Promise<string | null>;
  updateChatTitle: (chatId: string, title: string) => Promise<boolean>;
  deleteChat: (chatId: string) => Promise<boolean>;
  refreshChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  
  const {
    chats,
    loading,
    error,
    createNewChat,
    updateTitle,
    removeChat,
    refreshChats
  } = useChats(currentUser?.id || '');

  // If active chat is deleted, clear it
  React.useEffect(() => {
    if (activeChat && !chats.some(chat => chat.id === activeChat.id)) {
      setActiveChat(null);
    }
  }, [chats, activeChat]);

  // Set document title based on active chat
  React.useEffect(() => {
    if (activeChat) {
      document.title = `${activeChat.title} | Chat App`;
    } else {
      document.title = 'Chat App';
    }
  }, [activeChat]);

  const value = {
    activeChat,
    setActiveChat,
    chats,
    loading,
    error,
    createNewChat,
    updateChatTitle: updateTitle,
    deleteChat: removeChat,
    refreshChats
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
