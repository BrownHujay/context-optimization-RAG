// src/components/Messages.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useMessages } from "../hooks";
import type { Message as ApiMessage } from "../api/types";
import { useChat } from "../context/ChatContext";
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import {useNavigate} from "react-router";
import { useStreamingChat } from "../context/StreamingChatComponent";
import MarkdownRenderer from "./MarkdownRenderer";
import ThinkingDropdown from "./ThinkingDropdown";
import { parseThinkingMessage } from "../utils/thinkingParser";

// Local Message interface for component display
interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  source?: "streaming" | "database"; // Track message source for debugging
  permanent?: boolean; // Indicates if message is permanent (vs. temporary streaming message)
  isStreaming?: boolean; // Flag to identify if this is currently streaming
}

export default function Messages(): React.ReactElement {
  const { activeChat } = useChat();
  const { currentUser } = useAuth();
  
  // Get the account ID from the auth context
  const accountId = currentUser?.id || '';
  const chatId = activeChat?.id || '';

  
  // Get the streaming state and messages from useStreamingChat hook
  const { streamingResponse, isStreaming, streamingId, messages: streamMessages, chatId: streamingChatId, accountId: streamingAccountId } = useStreamingChat();
  
  // Only show streaming content if it's for the current chat
  const isStreamingForCurrentChat = streamingChatId === chatId && streamingAccountId === accountId;
  
  // Timer reference for handling streaming state transitions
  const lastStreamingTimerRef = useRef<number | null>(null);

  //SCROLL
  
  // Enhanced scroll position preservation system
  const scrollPositionRef = useRef(0);
  const preventScrollJump = useRef(false);
  const isTransitioningRef = useRef(false);
  const frameRequestRef = useRef<number | null>(null);
  
  // Get messages data from the hook
  const { messages: apiMessages, loading, error, refreshMessages } = useMessages(accountId, chatId);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  
  // Precise scroll position management for transitions
  const saveScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      console.log(`📏 Saving scroll position: ${scrollPositionRef.current}`);
    }
  }, []);
  
  const restoreScrollPosition = useCallback(() => {
    if (scrollContainerRef.current && preventScrollJump.current) {
      // Use RAF for more precise timing after layout
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
      
      frameRequestRef.current = requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
          console.log(`🔁 Restored scroll position: ${scrollPositionRef.current}`);
          frameRequestRef.current = null;
        }
      });
    }
  }, []);
  
  // Refs for scroll management 
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // Gentle scroll animation for new messages 
  const scrollToBottomGently = useCallback(() => {
    if (messagesEndRef.current) {
      try {
        // Use a gentler scroll with custom timing
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      } catch (err) {
        console.error('Error scrolling:', err);
      }
    }
  }, []);

  //REFRESH/RENDER

  // Handle refresh when needed
  const handleForceRefresh = useCallback(() => {
    if (activeChat && activeChat.id) {
      refreshMessages();
    }
  }, [activeChat, refreshMessages]);
  
  // Listen for events that require message list refresh, but only when explicitly triggered
  useEffect(() => {
    window.addEventListener('force-messages-refresh', handleForceRefresh as unknown as EventListener);
    return () => {
      window.removeEventListener('force-messages-refresh', handleForceRefresh as unknown as EventListener);
    };
  }, [handleForceRefresh]);
  
  // For navigation
  const navigate = useNavigate();
  
  // Debug log when active chat changes
  useEffect(() => {
    console.log(`🔍 Active chat changed: ${activeChat?.id} - ${activeChat?.title}`);
    
    // CRITICAL FIX: Only navigate if we're not already on this URL
    // This prevents the page from reloading during streaming
    if (activeChat?.id) {
      const currentPath = window.location.pathname;
      const targetPath = `/chat/${activeChat.id}`;
      
      // Only navigate if we're not already on this path AND not streaming
      // This prevents any navigation during or immediately after streaming
      if (currentPath !== targetPath && !isStreaming) {
        console.log(`🚩 Navigating from ${currentPath} to ${targetPath}`);
        navigate(targetPath, { replace: true }); // Use replace to avoid adding to history
      } else {
        console.log(`🚫 Skipping navigation - already at ${currentPath} or currently streaming`);
      }
    }
  }, [activeChat, navigate]);
  
  // Handle scroll logic after messages or streaming response updates
  useEffect(() => {
    scrollToBottomGently();
  }, [displayMessages, streamingResponse, scrollToBottomGently]);

  // Process new messages when they arrive without swapping existing ones
  useEffect(() => {
    // First time loading or when chat changes, clear the message list
    if (!chatId) {
      setDisplayMessages([]);
      return;
    }
    
    // Only process API messages if we don't have them already
    // This prevents unnecessary re-renders and message swapping
    if (apiMessages && apiMessages.length > 0 && displayMessages.length === 0) {
      console.log(`🔄 Initial load of ${apiMessages.length} history messages`);
      
      // Process API messages for initial load - UPDATED to display both user and assistant messages
      const dbMessages: DisplayMessage[] = [];
      
      apiMessages.forEach((msg: ApiMessage) => {
        // Format timestamp safely
        let formattedTimestamp = 'Unknown time';
        try {
          if (msg.created_at) {
            formattedTimestamp = new Date(msg.created_at).toLocaleTimeString();
          } else {
            formattedTimestamp = new Date().toLocaleTimeString();
          }
        } catch (err) {
          console.error('Error formatting timestamp:', err);
        }
        
        // Add user message if it exists - use the text field
        if (msg.text && msg.text.trim()) {
          dbMessages.push({
            id: `${msg.id}-user`,
            role: 'user',
            content: msg.text.trim(),
            timestamp: formattedTimestamp,
            source: 'database' as const,
            permanent: true
          });
        }
        
        // Add assistant response if it exists - use the response field
        if (msg.response && msg.response.trim()) {
          dbMessages.push({
            id: `${msg.id}-assistant`,
            role: 'assistant',
            content: msg.response.trim(),
            timestamp: formattedTimestamp,
            source: 'database' as const,
            permanent: true
          });
        }
      });
      
      setDisplayMessages(dbMessages);
    }
  }, [apiMessages, chatId, displayMessages.length]);

  // Handle streaming and permanent messages in a unified way
  useEffect(() => {
    if (!chatId) return;
    
    // Only add new messages from streamMessages that don't already exist
    if (streamMessages && streamMessages.length > 0) {  
      setDisplayMessages(currentMessages => {
        // Get all existing message IDs for quick lookup
        const existingIds = new Set(currentMessages.map(m => m.id));
        
        // Process new messages from the stream that aren't already displayed
        const newMessages = streamMessages
          .filter(msg => {
            // Skip empty messages
            if (!msg.content?.trim()) return false;
            
            // Skip if we already have this message by ID
            if (existingIds.has(msg.id)) return false;
            
            return true;
          })
          .map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.timestamp || Date.now()).toLocaleTimeString(),
            source: 'streaming' as const,
            permanent: true,
            isStreaming: false // Not a streaming message
          }));
        
        // If no new messages to add, don't update state
        if (newMessages.length === 0) return currentMessages;
        
        console.log(`📱 Adding ${newMessages.length} new messages from stream`);
        return [...currentMessages, ...newMessages];
      });
    }
    
    // Handle creation of a streaming message or updating an existing one
    if (streamingResponse && streamingId && isStreamingForCurrentChat) {
      setDisplayMessages(currentMessages => {
        // Check if the streaming message already exists in our list
        const streamingMessageIndex = currentMessages.findIndex(m => m.id === streamingId);
        
        // Create a copy of current messages to modify
        const updatedMessages = [...currentMessages];
        
        if (streamingMessageIndex !== -1) {
          // Update existing streaming message
          updatedMessages[streamingMessageIndex] = {
            ...updatedMessages[streamingMessageIndex],
            content: streamingResponse,
            isStreaming: isStreaming,
            permanent: !isStreaming // Mark as permanent when streaming ends
          };
        } else if (isStreaming) {
          // Add new streaming message
          updatedMessages.push({
            id: streamingId,
            role: 'assistant',
            content: streamingResponse,
            timestamp: new Date().toLocaleTimeString(),
            source: 'streaming',
            permanent: false,
            isStreaming: true
          });
        }
        
        return updatedMessages;
      });
    }
  }, [chatId, streamMessages, streamingResponse, isStreaming, streamingId, isStreamingForCurrentChat]);

  // Ensure messages are scrolled into view when they change
  useEffect(() => {
    scrollToBottomGently();
  }, [displayMessages, isStreaming, streamingResponse, scrollToBottomGently]);

  // Apply scroll position preservation after any state update that might affect layout
  useEffect(() => {    
    // First check if we're in transition mode and need to preserve position
    if (preventScrollJump.current) {
      // Use precise restoration timing
      restoreScrollPosition();
    }
  }, [displayMessages, restoreScrollPosition]);

  // Log when streaming starts or stops - helpful for debugging
  
  // Handle streaming state changes
  useEffect(() => {
    if (isStreaming) {
      console.log('🎬 Streaming started');
      isTransitioningRef.current = false;
      
      // Gentle scroll when streaming starts
      scrollToBottomGently();
      
      // Release any scroll locks that might have been applied
      preventScrollJump.current = false;
      
      // Clear any previous transitions
      if (lastStreamingTimerRef.current) {
        window.clearTimeout(lastStreamingTimerRef.current);
      }
    } else if (streamingResponse && streamingId) {
      // Streaming just finished but we have a response
      console.log('✅ Streaming finished, finalizing message');
      
      // Mark that we're in transition mode
      isTransitioningRef.current = true;
      
      // Save scroll position at transition start
      saveScrollPosition();
      preventScrollJump.current = true;
      
      // Note: We don't need to save lastStreamingResponse anymore since
      // we're handling the transition within the message array itself
      
      // After a delay, turn off transitioning mode
      if (lastStreamingTimerRef.current) {
        window.clearTimeout(lastStreamingTimerRef.current);
      }
      
      lastStreamingTimerRef.current = window.setTimeout(() => {
        console.log('💬 Transition complete');
        isTransitioningRef.current = false;
        lastStreamingTimerRef.current = null;
      }, 500);
    }
    
    return () => {
      // Cleanup timer on unmount
      if (lastStreamingTimerRef.current) {
        window.clearTimeout(lastStreamingTimerRef.current);
      }
    };
  }, [isStreaming, streamingResponse, streamingId]);

  // Handle loading and error states
  if (loading && displayMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-pulse text-[var(--text-secondary)]">
          Loading messages...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-red-500">
          Error loading messages: {error}
        </div>
      </div>
    );
  }

  if (!activeChat) {
    console.log('⚠️ No active chat selected, rendering empty state');
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)] text-center">
          <p className="text-xl mb-2">No active chat selected</p>
          <p className="text-sm">Select a chat from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[var(--bg-primary)] flex flex-col overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="flex-1 w-full px-4 py-4 space-y-4 overflow-y-auto h-full"
      >
        <AnimatePresence initial={false}>
          {displayMessages.map((message) => {
            const parsedMessage = parseThinkingMessage(message.content);
            
            return (
              <motion.div
                key={message.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex flex-col ${message.role === "user" ? "ml-auto" : "mr-auto"}`}
                style={{
                  maxWidth: "66%",
                  width: message.content.length < 35 ? "fit-content" : "auto",
                  minWidth: "4rem"
                }}
              >
                {/* Thinking dropdown for assistant messages with thinking content */}
                {message.role === "assistant" && parsedMessage.hasThinking && parsedMessage.thinkingContent && (
                  <ThinkingDropdown 
                    thinkingContent={parsedMessage.thinkingContent}
                    className="mb-2"
                  />
                )}
                
                {/* Main message bubble */}
                <div
                  className={`px-4 py-3 rounded-lg text-left ${message.role === "user" ? "text-white" : "text-[var(--text-primary)]"}`}
                  style={{
                    backgroundColor: message.role === "user" ? "var(--theme-color)" : "var(--chat-bubble)",
                    border: "none",
                    outline: "none",
                    boxShadow: "none"
                  }}
                >
                  {message.role === "user" ? (
                    <div className="whitespace-pre-wrap break-words">
                      {parsedMessage.displayContent}
                    </div>
                  ) : (
                    <MarkdownRenderer 
                      content={parsedMessage.displayContent}
                      className="prose prose-sm max-w-none"
                    />
                  )}
                  
                  <div className="text-xs opacity-70 text-right mt-2">
                    {message.isStreaming ? (
                      <><span className="inline-block animate-pulse">●</span> Typing...</>
                    ) : message.timestamp}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* We no longer need separate streaming message rendering as it's integrated in the message array */}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-4" /> {/* Scroll anchor */}
      </div>
    </div>
  );
}
