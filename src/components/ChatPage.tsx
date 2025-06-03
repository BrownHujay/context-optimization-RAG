import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat as useChatContext } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useMessages } from '../hooks';
import ChatInput from './ChatInput';
import Messages from './Messages';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { chats, activeChat, setActiveChat, loading: chatsLoading } = useChatContext();
  const accountId = currentUser?.id || '';
  const chatId = id || '';
  
  // Just need to know if messages are loading
  const { loading: messagesLoading } = useMessages(accountId, chatId);
  
  // Set active chat when ID changes
  useEffect(() => {
    if (id && chats.length > 0) {
      const chat = chats.find(c => c.id === id);
      if (chat) {
        setActiveChat(chat);
        // Update document title with chat name
        document.title = `${chat.title} | Chat App`;
      } else {
        // Chat not found, redirect to home
        navigate('/');
      }
    }
    
    // Cleanup - reset title when unmounting
    return () => {
      document.title = 'Chat App';
    };
  }, [id, chats, setActiveChat, navigate]);
  
  // Loading state
  if (chatsLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }
  
  // No active chat
  if (!activeChat && id) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-2xl font-bold mb-4">Chat not found</h2>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Go Home
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="p-3 border-b border-[var(--border-color)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {activeChat?.title || 'Chat'}
        </h1>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Messages />
      </div>
      
      <ChatInput />
    </div>
  );
}
