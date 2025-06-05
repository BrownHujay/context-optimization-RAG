import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useChat as useChatContext } from '../context/ChatContext';
import { useMessages } from "../hooks";
import { useStreamingChat } from "../context/StreamingChatComponent";

// GLOBAL STATIC PROTECTION MECHANISMS - shared across all component instances
let staticIsSending = false;
let lastSendTimestamp = 0;
const sentMessageHashes = new Set<string>();

export default function HttpChatInput() {
  const { currentUser } = useAuth();
  const { activeChat, setActiveChat, createNewChat } = useChatContext();
  
  // Get account and chat IDs
  const accountId = currentUser?.id || '';
  const chatId = activeChat?.id || '';
  
  // Initialize API hooks 
  const { sendMessage, isStreaming, resetStream } = useStreamingChat();
  const { addMessage } = useMessages(accountId, chatId);
  
  // Track state for the input field
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);
  
  // Reset when chat changes
  useEffect(() => {
    resetStream();
    setInput("");
  }, [chatId, resetStream]);
  
  // This effect used to reload the conversation after streaming completion.
  // We've removed this to avoid unnecessary DB fetches since we're now
  // keeping messages in memory and only syncing with DB when needed.
  // The Messages component will display both API messages and streaming content.
  // Messages will automatically load from DB when the user navigates to the page.
  
  // Handle message submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Trim the input and check if it's empty
    const message = input.trim();
    if (!message || isSending || staticIsSending) return;
    
    console.log("📨 Processing message:", message);
    
    // Prevent double-sends
    const now = Date.now();
    if (now - lastSendTimestamp < 1000) {
      console.warn("⚠️ Throttling message send - too fast!");
      return;
    }
    lastSendTimestamp = now;
    
    // Simple hash to prevent duplicate messages
    const msgHash = `${message}-${now}`;
    if (sentMessageHashes.has(msgHash)) {
      console.warn("⚠️ Duplicate message detected!");
      return;
    }
    sentMessageHashes.add(msgHash);
    
    // Set sending flags first to prevent multiple submissions
    setIsSending(true);
    sendingRef.current = true;
    staticIsSending = true;
    
    try {
      // CORRECT FLOW ORDER:
      // 1. Create chat if needed
      // 2. Show user message immediately
      // 3. Start streaming response
      
      // STEP 1: Create a new chat if needed
      let currentChatId = chatId;
      if (!currentChatId) {
        console.log("💬 CRITICAL STEP 1: Creating new chat");
        const newChat: any = await createNewChat("New Chat");
        if (newChat && typeof newChat === 'object' && newChat.id) {
          currentChatId = newChat.id;
          // Set active chat will update the UI and chatId
          setActiveChat(newChat);
          
          // Update URL without navigation/reload
          window.history.pushState({}, "", `/chat/${newChat.id}`);
          console.log(`🔄 Updated URL to /chat/${newChat.id} without reload`);
          
          // IMPORTANT: We need to manually trigger a state update since we're modifying a variable
          // but not triggering a re-render
          setInput(""); // Force a re-render
          
          // CRITICAL: Wait for the active chat to be properly set before proceeding
          // This avoids the need to create a new hook instance
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          console.error("❌ Failed to create new chat");
          return;
        }
      }
      
      // STEP 2: Add user message immediately for instant feedback
      console.log(`📝 CRITICAL STEP 2: Adding user message to database for chat ${currentChatId}`);
      // Pass individual arguments instead of an object
      const userMessageId = await addMessage(message, "user");
      
      // Clear input immediately after showing user message
      setInput("");

      if (!userMessageId) {
        console.error("❌ Failed to save user message, cannot proceed with streaming.");
        // Reset sending flags if we can't proceed
        setIsSending(false);
        sendingRef.current = false;
        staticIsSending = false;
        return; 
      }
      
      // STEP 3: Start streaming the assistant response IMMEDIATELY
      console.log(`🚀 CRITICAL STEP 3: Starting real-time streaming for: ${message} (originalMessageId: ${userMessageId})`);
      console.log(`Account ID: ${accountId}, Chat ID: ${currentChatId}`);
      
      // FIXED: Never create a new hook instance here - this breaks React's rules of hooks
      // Instead, use the hook from the component level and wait for the active chat
      // to update if needed
      // Pass the user's message ID as originalMessageId
      const success = await sendMessage(message, userMessageId);
      console.log(`✅ Stream started: ${success}`);
    } catch (error) {
      console.error("❌ Error in chat process:", error);
    } finally {
      // Reset sending flags
      setIsSending(false);
      sendingRef.current = false;
      staticIsSending = false;
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Input form */}
      <form onSubmit={handleSubmit} className="relative flex items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-1 p-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none min-h-[50px] max-h-[200px] overflow-y-auto"
          disabled={isSending || isStreaming}
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending || isStreaming}
          className={`absolute right-3 bottom-3 rounded-full p-1 ${
            !input.trim() || isSending || isStreaming
              ? 'text-gray-400 dark:text-gray-600'
              : 'text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
