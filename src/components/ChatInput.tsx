import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useChat as useChatContext } from '../context/ChatContext';
import { useHttpChat } from "../hooks/useHttpChat";
import { useMessages } from "../hooks";
// Removed useNavigate since we're using direct window.location navigation

// For rate limiting
const SEND_COOLDOWN = 500; // ms

export default function ChatInput() {
  const { currentUser } = useAuth();
  const { activeChat, setActiveChat, createNewChat, chats, updateChatTitle } = useChatContext();
  
  // Get account and chat IDs
  const accountId = currentUser?.id || '';
  const chatId = activeChat?.id || '';
  
  // Initialize API hooks
  const { sendMessage, isStreaming, streamingResponse, resetStream, summary } = useHttpChat(accountId, chatId);
  const { addMessage, refreshMessages } = useMessages(accountId, chatId);
  
  // Track state
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSendTimeRef = useRef(0);
  const isHomepage = !chatId;

  // Handle auto-sizing of textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    // Don't send empty messages
    if (!input.trim()) return;
    
    // Basic rate limiting
    const now = Date.now();
    if (now - lastSendTimeRef.current < SEND_COOLDOWN) return;
    lastSendTimeRef.current = now;
    
    // Basic lock to prevent multiple sends
    if (isSending) return;
    setIsSending(true);
    
    // Store the message before clearing input
    const userMessage = input.trim();
    
    // Clear input immediately for better UX
    setInput("");

    try {
      // NEW CHAT CREATION (on homepage)
      if (isHomepage) {
        console.log("🆕 Creating new chat with a temporary title...");
        
        // 1. Create new chat first with a placeholder "Untitled Chat" title
        const newChatId = await createNewChat("Untitled Chat");
        if (!newChatId) {
          throw new Error('Failed to create chat');
        }
        console.log(`✅ New chat created: ${newChatId}`);
        
        // 2. Find the new chat object
        const newChat = chats.find(chat => chat.id === newChatId);
        if (!newChat) {
          throw new Error('Could not find newly created chat');
        }
        
        // 3. Set as active chat IMMEDIATELY
        setActiveChat(newChat);
        console.log(`✅ Active chat set to: ${newChat.title} (${newChat.id})`);
        
        // 4. We DON'T save the user message separately, just keep the message in memory
        // for the AI response. This ensures we save both prompt and response in one DB entry.
        console.log(`✅ User message stored: ${userMessage.substring(0, 30)}...`);
        
        // 5. Update URL without full page reload
        window.history.pushState({}, '', `/chat/${newChatId}`);
        console.log(`✅ URL updated to: /chat/${newChatId}`);
        
        // 6. Start streaming response RIGHT AWAY
        // The prompt+response will be saved as one entry after streaming completes
        console.log('🎬 Starting streaming response...');
        await sendMessage(userMessage);
        console.log('✅ Streaming started');
      } 
      // EXISTING CHAT
      else if (chatId) {
        console.log("💬 Sending message in existing chat...");
        
        // 1. Add user message to database
        const msgId = await addMessage(userMessage, 'user');
        console.log(`✅ User message saved: ${msgId}`);
        
        // 2. Refresh messages to display user message
        await refreshMessages();
        console.log(`✅ Messages refreshed - user message should be visible`);
        
        // 3. Start streaming response RIGHT AWAY
        console.log('🎬 Starting streaming response...');
        await sendMessage(userMessage);
        console.log('✅ Streaming started');
      }
    } catch (error) {
      console.error('❌ Error in handleSend:', error);
    } finally {
      // Always reset sending state
      setIsSending(false);
    }
  };

  // CRITICAL FIX: Only add assistant message when streaming COMPLETES, not during streaming
  // This prevents the chat from refreshing unexpectedly during streaming
  useEffect(() => {
    // Only save to database AFTER streaming is complete
    if (!isStreaming && streamingResponse && streamingResponse.trim().length > 0) {
      console.log('🏁 Streaming COMPLETE - now saving to database');
      
      // We only save to database AFTER streaming is done
      const saveCompletedMessage = async () => {
        try {
          if (streamingResponse.trim() && chatId && accountId) {
            console.log('💾 Saving completed assistant message to database...');
            
            // For existing chats, we add the message as normal
            if (!isHomepage) {
              // Save the final message to the database
              await addMessage(streamingResponse, 'assistant');
              console.log('✅ Assistant message saved successfully');
            }
            
            // If we have a summary, update the chat title
            if (summary?.title && activeChat) {
              console.log('📝 Updating chat title with summary:', summary.title);
              
              // Update chat title in database
              try {
                await updateChatTitle(chatId, summary.title);
                console.log('✅ Chat title updated in database');
                
                // Update local state with new title
                const updatedChat = {
                  ...activeChat,
                  title: summary.title
                };
                setActiveChat(updatedChat);
                
                // If we created a new chat and the title was changed from the default,
                // dispatch an event to update chat list
                if (isHomepage && activeChat.title === "Untitled Chat") {
                  window.dispatchEvent(new CustomEvent('chat-title-updated', { 
                    detail: { chatId, newTitle: summary.title } 
                  }));
                }
              } catch (err) {
                console.error('❌ Error updating chat title:', err);
              }
            }
            
            // Get fresh messages from database (without disrupting user's view)
            await refreshMessages();
            
            // Reset streaming state after everything is done
            setTimeout(() => {
              resetStream();
              console.log('🔄 Stream reset after database operations');
            }, 300);
          }
        } catch (error) {
          console.error('❌ Error saving assistant message:', error);
          setTimeout(() => resetStream(), 300);
        }
      };
      
      // Small delay before database operations to ensure UI stability
      setTimeout(saveCompletedMessage, 300);
    }
  }, [isStreaming, streamingResponse, addMessage, resetStream, chatId, accountId, summary, activeChat, setActiveChat]);

  // Create a reference to directly access and update the streaming content
  const directStreamingRef = useRef<HTMLDivElement>(null);

  // Immediately update the streaming content when streamingResponse changes
  useEffect(() => {
    if (directStreamingRef.current && streamingResponse) {
      directStreamingRef.current.textContent = streamingResponse;
    }
  }, [streamingResponse]);

  return (
    <div className={`w-full bg-[var(--bg-primary)] px-4 py-4 ${isHomepage ? "max-w-2xl mx-auto" : ""}`}>
      {/* CRITICAL FIX: Display the streaming response directly in this component */}
      {isStreaming && streamingResponse && (
        <div className="mb-4 p-4 rounded-lg border-2 border-[var(--theme-color)] bg-[var(--chat-bubble)] text-[var(--text-primary)]">
          <div className="flex items-start">
            <div className="w-8 h-8 rounded-full bg-[var(--theme-color)] flex items-center justify-center text-white mr-3 flex-shrink-0">
              AI
            </div>
            <div className="flex-grow">
              <div 
                ref={directStreamingRef} 
                className="whitespace-pre-wrap" 
                id="chat-input-streaming-content"
              >
                {streamingResponse}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] text-right mt-2">
                <span className="inline-block animate-pulse mr-1">●</span> 
                Live response...
              </div>
            </div>
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="What's on your mind?"
        rows={1}
        style={{ resize: "none", maxHeight: "150px" }}
        className="w-full p-3 bg-[var(--bg-tertiary)] rounded-md text-[var(--text-primary)] caret-[var(--text-primary)] outline-none overflow-y-auto focus:ring-2 focus:ring-[var(--theme-color)]"
        disabled={isStreaming || !currentUser}
      />
      <div className="mt-2 flex justify-between items-center">
        <div className="text-sm text-[var(--text-tertiary)]">
          {isStreaming ? (
            <span className="flex items-center transition-opacity duration-300 ease-in-out">
              <span className="animate-pulse mr-2 text-[var(--theme-color)]">●</span>
              AI is responding...
            </span>
          ) : null}
        </div>
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-[var(--theme-color)] text-white rounded hover:bg-[var(--theme-color-dark)] transition disabled:opacity-50"
          disabled={isSending || isStreaming || input.trim() === "" || !currentUser}
        >
          Send
        </button>
      </div>
    </div>
  );
}
