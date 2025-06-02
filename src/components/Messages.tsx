// src/components/Messages.tsx
import { useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MessagesProps {
  messages: Message[];
}

export default function Messages({ messages }: MessagesProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - 100;

    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex-1 overflow-hidden px-4 pt-6 bg-[var(--bg-primary)]">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto space-y-4 pr-2"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={message.role === "user" 
              ? "px-4 py-2 rounded-xl text-left break-words break-all whitespace-pre-wrap transition-all bg-[var(--theme-color)] text-white ml-auto" 
              : "px-4 py-2 text-left break-words break-all whitespace-pre-wrap transition-all mr-auto text-[var(--text-primary)]"}
            style={{
              maxWidth: "66%",
              width: message.content.length < 35 ? "fit-content" : "100%",
              minWidth: "4rem",
            }}
          >
            <p>{message.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
