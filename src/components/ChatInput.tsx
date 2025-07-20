import { useState, useRef, useEffect } from "react";
import { useChat as useChatContext } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useMessages } from "../hooks";
import { useStreamingChat } from "../context/StreamingChatComponent";
import ModelSelector from './ModelSelector';
import { modelsApi } from '../api/modelsApi';

// For rate limiting
const SEND_COOLDOWN = 500; // ms

export default function ChatInput() {
  const { activeChat, setActiveChat, createNewChat, chats, updateChatTitle } = useChatContext();
  const { currentUser } = useAuth();
  
  // Get the account ID from the auth context
  const accountId = currentUser?.id || '';
  const chatId = activeChat?.id || '';
  
  // Initialize API hooks
  const { sendMessage, isStreaming, streamingResponse, resetStream, summary, setSession } = useStreamingChat();
  const { addMessage, refreshMessages, updateMessage } = useMessages(accountId, chatId);
  
  // Track state
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama-3.2-3b");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSendTimeRef = useRef(0);
  // Add ref to track if we've already saved the current response
  const hasProcessedRef = useRef(false);
  const isHomepage = !chatId;

  // Set up streaming session when chat or account changes
  useEffect(() => {
    if (accountId && chatId) {
      console.log('🔗 Setting streaming session:', { accountId, chatId });
      setSession(accountId, chatId);
    }
  }, [accountId, chatId, setSession]);

  // Handle auto-sizing of textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Handle model selection and preloading
  const handleModelPreload = async (modelId: string) => {
    try {
      await modelsApi.preloadModel(modelId);
      console.log(`Model ${modelId} preloaded successfully`);
    } catch (error) {
      console.error(`Failed to preload model ${modelId}:`, error);
      throw error;
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    console.log(`Selected model changed to: ${modelId}`);
  };

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
        
        // 4. Set up streaming session immediately for new chat
        setSession(accountId, newChatId);
        console.log(`✅ Streaming session set for new chat: ${newChatId}`);
        
        // 5. We DON'T save the user message separately, just keep the message in memory
        // for the AI response. This ensures we save both prompt and response in one DB entry.
        console.log(`✅ User message stored: ${userMessage.substring(0, 30)}...`);
        
        // 6. Update URL without full page reload
        window.history.pushState({}, '', `/chat/${newChatId}`);
        console.log(`✅ URL updated to: /chat/${newChatId}`);
        
        // 7. Add user message to database and get its ID
        console.log('➕ Adding user message to DB for new chat...');
        const userMsgId = await addMessage(userMessage, 'user');
        if (!userMsgId) {
          throw new Error('Failed to save user message for new chat');
        }
        console.log(`✅ User message saved for new chat: ${userMsgId}`);

        // 8. Store message ID in localStorage
        localStorage.setItem(`last_message_id_${newChatId}`, userMsgId);
        console.log(`✅ Stored message ID for new chat in localStorage: ${userMsgId}`);

        // No longer need to refresh messages - our in-memory messages will handle this
        console.log(`✅ User message will be handled by in-memory state`);

        // 9. Start streaming response RIGHT AWAY, passing the userMsgId and selected model
        console.log('🎬 Starting streaming response for new chat...');
        
        // Use the streaming context to send the message with selected model
        sendMessage(userMessage, userMsgId, selectedModel);
        console.log('✅ Streaming started for new chat');
      } 
      // EXISTING CHAT
      else if (chatId) {
        console.log('🎬 Sending streaming message for existing chat...');
        
        // 1. Add user message to database
        const msgId = await addMessage(userMessage, 'user');
        console.log(`✅ User message saved: ${msgId}`);

        if (!msgId) {
          console.error("❌ Failed to save user message (msgId is null/undefined). Cannot proceed with streaming for existing chat.");
          // The finally block will reset isSending. We just return here.
          return;
        }
        
        // Store message ID in localStorage (msgId is now guaranteed to be a string)
        localStorage.setItem(`last_message_id_${chatId}`, msgId);
        console.log(`✅ Stored message ID in localStorage: ${msgId}`);
        
        // 2. Refresh messages to display user message
        await refreshMessages();
        console.log(`✅ Messages refreshed - user message should be visible`);
        
        // 3. Start streaming response RIGHT AWAY, passing the msgId (now guaranteed to be a string)
        console.log('🎬 Starting streaming response for existing chat...');
        await sendMessage(userMessage, msgId, selectedModel);
        console.log('✅ Streaming started for existing chat');
      }
    } catch (error) {
      console.error(' Error in handleSend:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Automatically save the AI response when streaming completes
  useEffect(() => {
    // Only save to database AFTER streaming is complete AND if we haven't processed this response yet
    if (!isStreaming && streamingResponse && streamingResponse.trim().length > 0 && !hasProcessedRef.current) {
      console.log(' Streaming COMPLETE - now saving to database');
      
      // Mark as processed immediately to prevent multiple saves
      hasProcessedRef.current = true;
      
      // Small delay before database operations to ensure UI stability
      setTimeout(async () => {
        try {
          if (streamingResponse.trim() && chatId && accountId) {
            console.log(' Saving completed assistant message to database...');
            
            // Unified logic: Get the message ID that was stored when the user message was created (for both new and existing chats)
            const lastMessageId = localStorage.getItem(`last_message_id_${chatId}`);
            
            if (lastMessageId) {
              console.log(`📝 Updating message ID: ${lastMessageId} with assistant response. Chat ID: ${chatId}, isHomepage: ${isHomepage}`);
              
              const updateSuccess = await updateMessage(lastMessageId, {
                response: streamingResponse, 
                _role: 'assistant'
              });
              
              if (updateSuccess) {
                console.log('✅ Assistant message updated successfully in DB & local state.');
                localStorage.removeItem(`last_message_id_${chatId}`);
                console.log(`🗑️ Cleared message ID from localStorage for chat ${chatId}`);
              } else {
                console.error('❌ Failed to update message with assistant response. Not creating duplicate.');
              }
            } else {
              console.error(`❌ No last_message_id found in localStorage for chat ${chatId} to update. Assistant response not saved to prevent duplicates.`);
              // This case indicates a potential logic flaw if a user message was sent but its ID wasn't stored/retrieved.
            }
            
            // If we have a summary, update the chat title
            if (summary?.title && activeChat) {
              console.log(' Updating chat title with summary:', summary.title);
              
              // Update chat title in database
              try {
                await updateChatTitle(chatId, summary.title);
                console.log(' Chat title updated in database');
                
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
                console.error(' Error updating chat title:', err);
              }
            }
            
            // No longer need to refresh messages - the in-memory state will handle this
            console.log(' In-memory messages already contain the completed response');
            
            // Reset streaming state after everything is done
            setTimeout(() => {
              resetStream();
              console.log(' Stream reset after database operations');
            }, 300);
          }
        } catch (error) {
          console.error(' Error saving assistant message:', error);
          setTimeout(() => resetStream(), 300);
        }
      }, 300);
    }
    
    // Reset our processed flag when streaming starts again
    if (isStreaming) {
      hasProcessedRef.current = false;
    }
  }, [isStreaming, streamingResponse, chatId, accountId, activeChat, summary, addMessage, refreshMessages, resetStream, updateChatTitle, isHomepage, setActiveChat, updateMessage]);

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
        disabled={isStreaming}
      />
      <div className="mt-2 flex items-center justify-between gap-4">
        {/* Model selector on the far left */}
        <div className="flex-shrink-0">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            onModelPreload={handleModelPreload}
          />
        </div>
        
        {/* Status indicator in the center (if streaming) */}
        <div className="flex-1 text-center">
          {isStreaming ? (
            <span className="flex items-center justify-center transition-opacity duration-300 ease-in-out text-sm text-[var(--text-tertiary)]">
              <span className="animate-pulse mr-2 text-[var(--theme-color)]">●</span>
              AI is responding...
            </span>
          ) : null}
        </div>
        
        {/* Send button on the far right */}
        <div className="flex-shrink-0">
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-[var(--theme-color)] text-white rounded hover:bg-[var(--theme-color-dark)] transition disabled:opacity-50 font-medium"
            disabled={isSending || isStreaming || input.trim() === ""}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
