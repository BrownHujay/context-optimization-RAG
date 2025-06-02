// src/components/ChatView.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Messages from "../components/Messages";
import ChatInput from "../components/ChatInput";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatViewProps {
  activeId: string;
  messages: string[];
  updateMessages: (id: string, messages: string[]) => void;
}

export default function ChatView({ activeId, messages: chatMessages, updateMessages }: ChatViewProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Ensure we can go back to homepage with browser back button
  useEffect(() => {
    if (!id || !activeId) {
      navigate('/');
    }
  }, [id, activeId, navigate]);
  
  // Convert string[] to Message[] if needed
  const initialMessages = chatMessages.map(msg => {
    try {
      const parsed = JSON.parse(msg);
      // Ensure the role is strictly typed
      if (parsed.role === "user" || parsed.role === "assistant") {
        return parsed as Message;
      } else {
        // Fallback to assistant role if invalid role
        return { role: "assistant" as const, content: parsed.content || msg };
      }
    } catch {
      // If not valid JSON, create a default message
      return { role: "assistant" as const, content: msg };
    }
  });
  
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  // This function will be called when ChatInput updates messages
  const handleMessagesUpdate = (newStringMessages: string[]) => {
    // Convert string[] to Message[] for local state
    const newMessages = newStringMessages.map(msg => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.role === "user" || parsed.role === "assistant") {
          return parsed as Message;
        } else {
          return { role: "assistant" as const, content: parsed.content || msg };
        }
      } catch {
        return { role: "assistant" as const, content: msg };
      }
    });
    
    // Update local state
    setMessages(newMessages);
    
    // Update parent state if this component is controlled
    if (updateMessages && activeId) {
      updateMessages(activeId, newStringMessages);
    }
  };

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
      className="flex flex-col h-full w-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div 
        className="flex-grow overflow-y-auto"
        variants={messageVariants}
      >
        <Messages messages={messages} />
      </motion.div>
      <motion.div 
        className="sticky bottom-0"
        variants={inputVariants}
      >
        <ChatInput 
          messages={chatMessages} 
          updateMessages={handleMessagesUpdate} 
        />
      </motion.div>
    </motion.div>
  );
}
