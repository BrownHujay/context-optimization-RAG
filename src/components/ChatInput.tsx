import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatInput({ messages, updateMessages, isHome = false }: any) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    if (sending || input.trim() === "") return;

    setSending(true);
    // Create properly formatted message objects with roles
    const userMsg: Message = { role: "user", content: input.trim() };
    const botMsg: Message = { role: "assistant", content: "This is a reply!" };
    const newMessages = [...messages, JSON.stringify(userMsg), JSON.stringify(botMsg)];
    updateMessages(newMessages);
    setInput("");
    setTimeout(() => setSending(false), 500);
  };

  return (
    <div
      className={`w-full px-4 ${
        isHome ? "max-w-2xl mx-auto mt-8" : "border-t border-[var(--border-color)] pt-2 pb-4"
      }`}
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Send a message"
        rows={1}
        style={{ resize: "none", maxHeight: "150px", color: 'var(--text-primary)' }}
        className="w-full p-3 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-color)] text-[var(--text-primary)] caret-[var(--text-primary)] outline-none overflow-y-auto focus:ring-2 focus:ring-[var(--theme-color)]"
      />
      <div className="mt-2 flex justify-between items-center">
        <div className="text-sm text-[var(--text-tertiary)] italic">toolbar placeholder</div>
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-[var(--theme-color)] text-white rounded hover:bg-[var(--theme-color-dark)] transition disabled:opacity-50"
          disabled={sending || input.trim() === ""}
        >
          Send
        </button>
      </div>
    </div>
  );
}
