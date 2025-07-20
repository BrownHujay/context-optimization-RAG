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
  const { activeChat, setActiveChat, chats, loading, updateChatTitle } = useChat();
  const { currentUser } = useAuth();
  const accountId = currentUser?.id || '';
  
  // Local state to track if we've handled the pending message
  const [pendingMessageHandled, setPendingMessageHandled] = useState(false);
  
  // Handle pending message from localStorage if it exists
  const { sendMessage, setSession } = useStreamingChat();

  // Set up chat session when ID changes
  useEffect(() => {
    if (accountId && id) {
      setSession(accountId, id); // Initializes your chat session 🎉
    }
  }, [accountId, id, setSession]);

  const { refreshMessages, addMessage } = useMessages(accountId, id || '');
  
  // Set active chat when ID changes and handle any pending message
  useEffect(() => {
    // Make sure we have an ID and chats have loaded
    if (!id || chats.length === 0) return;
    
    // Find the chat that matches the URL parameter
    const chat = chats.find(c => c.id === id);
    
    if (chat) {
      console.log(`🔄 CHATPAGE: Setting active chat: ${chat.title} (${chat.id})`);
      setActiveChat(chat);

      // Only process pending messages if we haven't done so already
      if (!pendingMessageHandled) {
        // Mark as handled immediately to prevent multiple processing
        setPendingMessageHandled(true);
        
        // Check if there's a pending message for this chat
        const pendingChatId = localStorage.getItem('pendingChatId');
        const pendingMessage = localStorage.getItem('pendingUserMessage');
        
        console.log(`🔄 CHATPAGE: Checking for pending message: ${pendingChatId === id ? 'FOUND' : 'NONE'}`);
        
        // Only process if the pending message is for this chat
        if (pendingChatId === id && pendingMessage) {
          console.log(`🔄 CHATPAGE: Processing pending message: ${pendingMessage.substring(0, 20)}...`);
          
          // Process after a short delay to ensure chat state is ready
          setTimeout(async () => {
            try {
              // Step 1: Save the user message
              const userMsgId = await addMessage(pendingMessage, 'user');
              if (!userMsgId) {
                throw new Error('Failed to save user message');
              }
              
              // Step 2: Refresh messages to show the user message
              await refreshMessages();
              
              // Step 3: Clear pending message data right away to prevent duplicates
              localStorage.removeItem('pendingUserMessage');
              localStorage.removeItem('pendingChatId');
              
              // Step 4: Start streaming the AI response
              await sendMessage(pendingMessage, userMsgId);
              
              // Step 5: Update chat title based on message content
              if (typeof updateChatTitle === 'function') {
                try {
                  const words = pendingMessage.split(' ');
                  const shortTitle = words.slice(0, 3).join(' ') + 
                    (words.length > 3 ? '...' : '');
                  await updateChatTitle(id, shortTitle);
                } catch (err) {
                  console.error('Failed to update chat title:', err);
                }
              }
            } catch (err) {
              console.error('Error processing pending message:', err);
              alert('There was a problem processing your message.');
            }
          }, 500); // Longer delay to ensure everything is ready
        }
      }
    } else {
      console.warn(`⚠️ Chat not found: ${id}, redirecting to homepage`);
      navigate('/');
    }
    
    // Cleanup - reset title when unmounting
    return () => {
      document.title = 'Chat App';
    };
  }, [id, chats, pendingMessageHandled, navigate, setActiveChat, addMessage, refreshMessages, sendMessage]);
  
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
