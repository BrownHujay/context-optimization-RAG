import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { useHttpChat } from "../hooks"; // your actual hook
import type { UseHttpChatResult } from "../hooks"; // type-only import

// Define the shape of the StreamingChat context
interface StreamingChatContextType extends UseHttpChatResult {
  setSession: (newAccountId: string, newChatId: string) => void;
  accountId: string | null;
  chatId: string | null;
}

// Initialize with proper typing
const StreamingChatContext = createContext<StreamingChatContextType | null>(null);

export function StreamingChatProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const chatState = useHttpChat(accountId || '', chatId || ''); 

  const setSession = useCallback((newAccountId: string, newChatId: string) => {
    setAccountId(newAccountId);
    setChatId(newChatId);
  }, []);

  const value = useMemo(() => ({
    ...chatState,
    setSession,
    accountId,
    chatId,
  }), [chatState, setSession, accountId, chatId]);

  return (
    <StreamingChatContext.Provider value={value}>
      {children}
    </StreamingChatContext.Provider>
  );
}

export const useStreamingChat = () => {
  const ctx = useContext(StreamingChatContext);
  if (!ctx) throw new Error("useStreamingChat must be used inside a StreamingChatProvider");
  return ctx;
};
