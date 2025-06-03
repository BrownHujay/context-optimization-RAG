// src/components/ChatView.tsx
import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Messages from "../components/Messages";
import ChatInput from "../components/ChatInput";
import { useNotification } from "../context/NotificationContext";
import { useChat } from "../context/ChatContext";
import { useMessages } from "../hooks/useMessages";

export default function ChatView() {
  const { activeChat } = useChat();
  const { messages, loading: isLoading } = useMessages(activeChat?.id || "", activeChat?.id || "");
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Ensure we can go back to homepage with browser back button
  useEffect(() => {
    if (!id || !activeChat) {
      navigate('/');
    }
  }, [id, activeChat, navigate]);
  
  const { sendNotification, tabActive, updateTitleWithNotification } = useNotification();
  const prevMessagesLengthRef = useRef(messages?.length || 0);
  
  // Set the document title properly when the component mounts
  useEffect(() => {
    if (activeChat) {
      const chatTitle = activeChat.title || `Chat ${activeChat.id}`;
      document.title = chatTitle;
      console.log('ChatView: Setting initial chat title:', chatTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for visibility changes to update messages when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('ChatView: Visibility changed, document.hidden =', document.hidden);
      if (!document.hidden && messages && messages.length > 0) {
        // Set the proper chat title when the tab becomes visible
        if (activeChat) {
          const chatTitle = activeChat.title || `Chat ${activeChat.id}`;
          document.title = chatTitle;
          console.log('ChatView: Restoring chat title on visibility change:', chatTitle);
        }
      }
    };
    
    // Log initial visibility state
    console.log('ChatView: Initial visibility state, document.hidden =', document.hidden);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [messages, activeChat]);
  
  // Direct access to notification system for manual notifications
  useEffect(() => {
    // Expose notification API to window for debugging
    (window as any).__notifyChat = {
      sendNotification: (title: string, body: string) => {
        sendNotification(title, body);
        return 'Notification sent';
      },
      updateTitle: (count: number) => {
        updateTitleWithNotification(count);
        return 'Title updated';
      },
      checkTabActive: () => {
        return { tabActive, documentHidden: document.hidden };
      }
    };
    
    return () => {
      delete (window as any).__notifyChat;
    };
  }, [sendNotification, updateTitleWithNotification, tabActive]);

  // Add notification logic for new messages
  useEffect(() => {
    if (!messages) return;
    
    console.log(`ChatView: messages updated, now has ${messages.length} messages`);
    
    try {      
      // Check if there are new messages
      if (messages.length > prevMessagesLengthRef.current) {
        // Process all new messages since last update
        for (let i = prevMessagesLengthRef.current; i < messages.length; i++) {
          try {
            const message = messages[i];
            
            // Only notify for assistant messages
            if (message.role === 'assistant') {
              console.log(`ChatView: Processing assistant message at index ${i}:`, 
                message.text.substring(0, 30) + '...');
              
              // Special handling for first assistant message in a new chat
              if (prevMessagesLengthRef.current === 0 && i === 1) {
                console.log('ChatView: First assistant message in new chat, scheduling notification...');
                
                // Use slight delay to ensure UI is ready
                setTimeout(() => {
                  sendNotification(`New message in Chat ${activeChat?.id}`, message.text);
                  updateTitleWithNotification(1);
                }, 500);
              } else {
                console.log('ChatView: Regular assistant message, sending notification');
                sendNotification(`New message in Chat ${activeChat?.id}`, message.text);
                updateTitleWithNotification(1);
              }
            }
          } catch (err) {
            console.error('Error processing message at index', i, err);
          }
        }
      }
      
      // Update reference to current length
      prevMessagesLengthRef.current = messages.length;
    } catch (error) {
      console.error('ChatView: Error processing messages:', error);
    }
  }, [messages, activeChat, sendNotification, updateTitleWithNotification]);

  // Container animation variants - 40% faster
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.48, // 0.8 * 0.6 = 0.48 (40% faster)
        ease: "easeInOut",
        staggerChildren: 0.18 // 0.3 * 0.6 = 0.18 (40% faster)
      }
    },
    exit: { 
      opacity: 0,
      y: -20,
      transition: { 
        duration: 0.36, 
        ease: "easeInOut" 
      }
    }
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.36, 
        ease: "easeOut" 
      }
    }
  };

  const inputVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.42,
        delay: 0.24,
        ease: "easeOut" 
      }
    }
  };

  return (
    <motion.div
      className="flex flex-col h-screen w-full overflow-hidden fixed inset-0"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div 
        className="flex-1 overflow-hidden"
        variants={messageVariants}
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--theme-color)]"></div>
          </div>
        ) : (
          <Messages />
        )}
      </motion.div>
      <motion.div 
        className="w-full bg-[var(--bg-primary)] shadow-sm"
        variants={inputVariants}
      >
        <ChatInput />
      </motion.div>
    </motion.div>
  );
}
