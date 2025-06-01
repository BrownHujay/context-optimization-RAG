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
    <div className="flex-1 overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto space-y-4 pr-2"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`px-4 py-2 rounded-xl text-left break-words break-all whitespace-pre-wrap transition-all
              ${message.role === "user"
                ? "bg-purple-700/30 dark:bg-purple-100/10 ml-auto"
                : "bg-purple-900/40 dark:bg-purple-200/20 mr-auto"
              }`}
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
