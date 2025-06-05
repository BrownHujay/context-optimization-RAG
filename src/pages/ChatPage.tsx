import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Messages from "../components/Messages";
import ChatInput from "../components/ChatInput";
import { useChat } from "../context/ChatContext";
import { useStreamingChat } from "../context/StreamingChatComponent";
import { useAuth } from "../context/AuthContext";
import { useMessages } from "../hooks";

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeChat, setActiveChat, chats, loading } = useChat();
  const { currentUser } = useAuth();
  const accountId = currentUser?.id || '';
  
  // Local state to track if we've handled the pending message
  const [pendingMessageHandled, setPendingMessageHandled] = useState(false);
  
  // Handle pending message from localStorage if it exists
  const { sendMessage, setSession } = useStreamingChat();

  useEffect(() => {
    if (accountId && id) {
      setSession(accountId, id); // Initializes your chat session 🎉
    }
  }, [accountId, id]);

  const { refreshMessages } = useMessages(accountId, id || '');
  
  // Set active chat when ID changes and handle any pending message
  useEffect(() => {
    if (id && chats.length > 0) {
      const chat = chats.find(c => c.id === id);
      if (chat) {
        setActiveChat(chat);
        console.log(`🔄 Active chat set to: ${chat.title} (${chat.id})`);
        
        // Check for pending message after direct navigation
        if (!pendingMessageHandled) {
          const pendingChatId = localStorage.getItem('pendingChatId');
          const pendingMessage = localStorage.getItem('pendingUserMessage');
          
          if (pendingChatId === id && pendingMessage) {
            console.log(`🔥 Found pending message for chat ${id}: ${pendingMessage}`);
            
            // Force an immediate refresh to ensure user message is displayed
            (async () => {
              try {
                console.log('⚡ Refreshing messages...');
                await refreshMessages();
                
                // Start the streaming process
                console.log('🎬 Starting streaming response for pending message...');
                await sendMessage(pendingMessage);
                
                // Clear the pending message
                localStorage.removeItem('pendingUserMessage');
                localStorage.removeItem('pendingChatId');
                setPendingMessageHandled(true);
              } catch (err) {
                console.error('Failed to process pending message:', err);
              }
            })();
          }
        }
      } else {
        // Chat not found, redirect to home
        console.log(`⚠️ Chat with ID ${id} not found, redirecting to home`);
        navigate('/');
      }
    }
    
    // Cleanup - reset title when unmounting
    return () => {
      document.title = 'Chat App';
    };
  }, [id, chats, setActiveChat, navigate, sendMessage, refreshMessages, pendingMessageHandled]);
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-accent)]"></div>
      </div>
    );
  }
  
  // No active chat
  if (!activeChat && id) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-2xl font-bold mb-4">Chat not found</h2>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)]"
        >
          Go Home
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header with chat name - stays fixed */}
      <div className="p-4 border-b border-[var(--border-color)] z-10 bg-[var(--bg-primary)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {activeChat?.title || 'Chat'}
        </h1>
      </div>

      {/* Container for Messages - let Messages handle its own scrolling */}
      <div className="flex-1 overflow-hidden">
        <Messages />
      </div>

      {/* Input stays at bottom */}
      <div className="w-full bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        <ChatInput />
      </div>
    </div>
  );
}
