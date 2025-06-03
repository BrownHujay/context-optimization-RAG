import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useChat as useChatContext } from '../context/ChatContext';
import { useHttpChat } from "../hooks/useHttpChat";
import { useMessages } from "../hooks";

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
  
  // Initialize API hooks - using HTTP streaming instead of Socket.IO
  const { sendMessage, isStreaming, streamingResponse, resetStream } = useHttpChat(accountId, chatId);
  const { addMessage } = useMessages(accountId, chatId);
  
  // Track state for the input field
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Add ref for streaming content display
  const streamingTextRef = useRef<HTMLPreElement>(null);
  
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
  
  // Simple direct listener for database reload from streaming completion
  useEffect(() => {
    // Just reload the conversation when triggered
    const handleReloadConversation = () => {
      if (!activeChat?.id) return;
      
      // Wait a moment for database to update
      setTimeout(async () => {
        try {
          // Simple database fetch
          const response = await fetch(`/conversations/${activeChat.id}`);
          if (response.ok) {
            const updatedChat = await response.json();
            if (updatedChat && setActiveChat) {
              console.log(`✅ Loaded conversation with ${updatedChat.messages?.length || 0} messages`);
              setActiveChat(updatedChat);
            }
          }
        } catch (error) {
          console.error('Error loading conversation:', error);
        }
      }, 1000);
    };
    
    // Register event listener
    window.addEventListener('reload-conversation', handleReloadConversation);
    
    // Clean up
    return () => {
      window.removeEventListener('reload-conversation', handleReloadConversation);
    };
  }, [activeChat?.id, setActiveChat]);
  
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
      await addMessage(message, "user", "No response");
      
      // Clear input immediately after showing user message
      setInput("");
      
      // STEP 3: Start streaming the assistant response IMMEDIATELY
      console.log(`🚀 CRITICAL STEP 3: Starting real-time streaming for: ${message}`);
      console.log(`Account ID: ${accountId}, Chat ID: ${currentChatId}`);
      
      // FIXED: Never create a new hook instance here - this breaks React's rules of hooks
      // Instead, use the hook from the component level and wait for the active chat
      // to update if needed
      const success = await sendMessage(message);
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
      {/* Enhanced streaming response display */}
      {isStreaming && (
        <div className="p-4 mb-4 rounded-lg bg-[var(--chat-bubble)]">
          <div className="flex items-start">
            <div className="w-8 h-8 rounded-full bg-[var(--theme-color)] flex items-center justify-center text-white mr-3 flex-shrink-0">
              AI
            </div>
            <div className="flex-1">
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                {/* Three ways to ensure content appears: */}
                {/* 1. Direct reference with ID for DOM manipulation */}
                <pre 
                  id="http-chat-streaming-content"
                  ref={streamingTextRef}
                  className="whitespace-pre-wrap font-sans"
                  data-is-streaming={isStreaming.toString()}
                >
                  {/* 2. React state */}
                  {streamingResponse || "Thinking..."}
                </pre>
                
                {/* 3. Immediate script execution for direct DOM updates */}
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      // Enhanced streaming display with proper cleanup
                      (function() {
                        // Clear any existing intervals to prevent duplicates
                        if (window.httpStreamingInterval) {
                          clearInterval(window.httpStreamingInterval);
                          window.httpStreamingInterval = null;
                        }
                        
                        window.httpUpdateStreamingDisplay = function(text) {
                          const el = document.getElementById('http-chat-streaming-content');
                          if (el) el.textContent = text || el.textContent || "Processing...";
                        };
                        
                        // Store interval ID for later cleanup
                        window.httpStreamingInterval = setInterval(() => {
                          const el = document.getElementById('http-chat-streaming-content');
                          
                          // Stop checking if element is gone or streaming attribute shows it's inactive
                          if (!el || el.getAttribute('data-is-streaming') === 'false') {
                            clearInterval(window.httpStreamingInterval);
                            window.httpStreamingInterval = null;
                            return;
                          }
                          
                          // Only update if we have data and element exists
                          if (window.latestStreamingResponse && el) {
                            window.httpUpdateStreamingDisplay(window.latestStreamingResponse);
                          }
                        }, 500); // Less frequent polling
                        
                        // Listen for streaming completion and auto-reload messages from DB
                        window.addEventListener('streaming-complete', () => {
                          clearInterval(window.httpStreamingInterval);
                          window.httpStreamingInterval = null;
                        });
                        
                        // Clean up on page changes
                        window.addEventListener('beforeunload', function() {
                          if (window.httpStreamingInterval) {
                            clearInterval(window.httpStreamingInterval);
                            window.httpStreamingInterval = null;
                          }
                        });
                      })();
                    `
                  }}
                />
              </div>
              
              <div className="text-xs text-[var(--text-tertiary)] mt-2 text-right">
                <span className="inline-block animate-pulse mr-1">●</span> Live response...
              </div>
            </div>
          </div>
        </div>
      )}
      
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
