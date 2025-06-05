// src/components/Messages.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useMessages } from "../hooks";
import type { Message as ApiMessage } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import {useNavigate} from "react-router";
import { useStreamingChat } from "../context/StreamingChatComponent";

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
  const { currentUser } = useAuth();
  const { activeChat } = useChat();
  const accountId = currentUser?.id || '';
  const chatId = activeChat?.id || '';

  
  // Get the streaming state and messages from useStreamingChat hook
  const { streamingResponse, isStreaming, streamingId, messages: streamMessages } = useStreamingChat();
  
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
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastScrollPositionRef = useRef<number>(0);
  const scrollTimerRef = useRef<number | null>(null);
  
  // Track when user last scrolled manually
  const userScrollTimestampRef = useRef<number>(0);
  
  // Smart scroll detector - only auto-scroll if user is near bottom and hasn't scrolled recently
  const checkShouldAutoScroll = useCallback(() => {
    if (!scrollContainerRef.current) return true;
    
    const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Calculate time since last manual scroll
    const timeSinceLastScroll = Date.now() - userScrollTimestampRef.current;
    
    // If within 10% of container height from bottom OR user hasn't scrolled in last 500ms, auto-scroll
    // This is more permissive to ensure we don't lock scrolling
    const scrollThresholdPercent = 10; // 10% of container height
    const isNearBottom = distanceFromBottom < (clientHeight * scrollThresholdPercent / 100);
    const hasScrollPausePassed = timeSinceLastScroll > 500;
    
    // Consider both conditions, but prioritize user scroll intent
    const shouldScroll = isNearBottom && (hasScrollPausePassed || userScrollTimestampRef.current === 0);
    console.log(`Auto-scroll decision: ${shouldScroll ? 'Yes' : 'No'} (near bottom: ${isNearBottom}, time since scroll: ${timeSinceLastScroll}ms)`);
    setShouldAutoScroll(shouldScroll);
    return shouldScroll;
  }, []);
  
  // Function to scroll to bottom of messages with scroll conditions
  const scrollToBottom = useCallback(() => {
    // Prevent forced scrolling if the component was just mounted or user actively scrolling
    const isUserActivelyScrolling = Date.now() - userScrollTimestampRef.current < 300;
    
    if (shouldAutoScroll && messagesEndRef.current && !isUserActivelyScrolling) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.error('Error scrolling to bottom:', err);
      }
    }
  }, [shouldAutoScroll]);
  
  // Setup scroll event listener to detect when user scrolls
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      // Record that user just manually scrolled
      userScrollTimestampRef.current = Date.now();
      
      // Store current position
      lastScrollPositionRef.current = container.scrollTop;
      
      // Reset auto-scroll during streaming if user scrolls up
      const { scrollHeight, scrollTop, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // IMPORTANT: Create a local variable to track scroll state
      // This ensures we don't interfere with user scrolling
      let newShouldScroll = shouldAutoScroll;

      // If user scrolls more than 100px from bottom, disable auto-scroll
      // But if they scroll back to near bottom, re-enable it
      if (distanceFromBottom > 100) {
        newShouldScroll = false;
        console.log('User scrolled away from bottom, disabling auto-scroll');
      } else if (distanceFromBottom < 50) {
        newShouldScroll = true;
        console.log('User scrolled to bottom, enabling auto-scroll');
      }
      
      // Only update state if it changed to prevent render loops
      if (newShouldScroll !== shouldAutoScroll) {
        setShouldAutoScroll(newShouldScroll);
      }
      
      // Always clear previous timer to prevent conflicts
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }
      
      // Set a timer to check scroll position after user stops scrolling
      scrollTimerRef.current = window.setTimeout(() => {
        checkShouldAutoScroll();
      }, 300); // Reduced timeout for more responsive UI
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, [checkShouldAutoScroll]);

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
    // Only scroll if we should auto-scroll based on user's position
    if (shouldAutoScroll) {
      console.log('Auto-scrolling because user is near bottom');
      scrollToBottom();
    }
  }, [displayMessages, streamingResponse, shouldAutoScroll, scrollToBottom]);

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
      checkShouldAutoScroll();
    }
  }, [apiMessages, chatId, displayMessages.length, checkShouldAutoScroll]);
  
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
    if (streamingResponse && streamingId) {
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
  }, [chatId, streamMessages, streamingResponse, isStreaming, streamingId]);

  // Ensure messages are scrolled into view when they change
  useEffect(() => {
    // Always use bottom-up loading for optimal UX
    checkShouldAutoScroll();
    console.log('shouldAutoScroll', shouldAutoScroll);
    if (!isStreaming && displayMessages.length > 0) {
      // Only scroll to bottom if not streaming and we have messages
      scrollToBottom();
      
      // Mark the current scroll position for future reference
      const currentScrollY = window.scrollY;
      const currentScrollHeight = document.body.scrollHeight;
      
      // Store these values temporarily to help with scrolling optimization
      sessionStorage.setItem('scrollPosition', currentScrollY.toString());
      sessionStorage.setItem('scrollHeight', currentScrollHeight.toString());
    } else if (isStreaming && shouldAutoScroll) {
      // During streaming, respect user's scroll position preference
      // Only auto-scroll if they haven't manually scrolled away
      if (shouldAutoScroll) {
        scrollToBottom();
      } else {
        console.log('User has scrolled away, respecting scroll position during streaming');
      }
    }
  }, [displayMessages, isStreaming, streamingResponse, shouldAutoScroll]);

  // Apply scroll position preservation after any state update that might affect layout
  useEffect(() => {    
    // First check if we're in transition mode and need to preserve position
    if (preventScrollJump.current) {
      // Use precise restoration timing
      restoreScrollPosition();
    }
    // Otherwise, check if we should auto-scroll based on user's position
    else if (displayMessages.length > 0 || isStreaming) {
      if (shouldAutoScroll) {
        scrollToBottom();
      }
    }
    
    // After any major state update that affects messages, maintain scroll position if we're in transition
    return () => {
      if (isTransitioningRef.current) {
        saveScrollPosition();
      }
    };
  }, [displayMessages, shouldAutoScroll, scrollToBottom, restoreScrollPosition, saveScrollPosition]);

  // Log when streaming starts or stops - helpful for debugging
  
  // Handle streaming state changes
  useEffect(() => {
    if (isStreaming) {
      console.log('🎬 Streaming started');
      isTransitioningRef.current = false;
      
      // Only force scroll to bottom when streaming first starts,
      // but honor user scroll position after that
      if (userScrollTimestampRef.current === 0) { // No manual scroll yet
        scrollToBottom();
      } else {
        // After streaming has started, don't override user scroll
        checkShouldAutoScroll();
      }
      
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
  }, [isStreaming, streamingResponse, streamingId, checkShouldAutoScroll]);

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
          {displayMessages.map((message) => (
            <motion.div
              key={message.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`px-4 py-2 rounded-lg text-left break-words break-all whitespace-pre-wrap ${message.role === "user" ? "text-white ml-auto" : "mr-auto text-[var(--text-primary)]"}`}
              style={{
                maxWidth: "66%",
                width: message.content.length < 35 ? "fit-content" : "auto", // Use auto for wider messages
                minWidth: "4rem",
                backgroundColor: message.role === "user" ? "var(--theme-color)" : "var(--chat-bubble)",
                border: "none",
                outline: "none",
                boxShadow: "none"
              }}
            >
              <p>{message.content}</p>
              <div className="text-xs opacity-70 text-right mt-1">
                {message.isStreaming ? (
                  <><span className="inline-block animate-pulse">●</span> Typing...</>
                ) : message.timestamp}
              </div>
            </motion.div>
          ))}

          {/* We no longer need separate streaming message rendering as it's integrated in the message array */}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-4" /> {/* Scroll anchor */}
      </div>
    </div>
  );
}
