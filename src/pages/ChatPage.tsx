// src/pages/ChatPage.tsx
import { useParams } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import Messages from "../components/Messages";
import Navbar from "../components/LeftNavbar";

type MessageType = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const { chatId } = useParams();
  const [darkMode, setDarkMode] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Dummy messages for each chat
  const dummyChats: Record<string, MessageType[]> = {
    "1": [
      { role: "user", content: "How do I link FAISS to Mongo properly again?" },
      { role: "assistant", content: "Dunno Boy figure it out lazy bum" },
    ],
    "2": [
      { role: "user", content: "Is my dog okay after the fireball test?" },
      { role: "assistant", content: "Call the vet, not me 😅" },
    ],
    "3": [
      { role: "user", content: "Should I normalize before embedding?" },
      { role: "assistant", content: "Yeah, usually a good idea." },
    ],
  };

  const [messages, setMessages] = useState<MessageType[]>(dummyChats[chatId!] || []);

  useEffect(() => {
    setMessages(dummyChats[chatId!] || []);
  }, [chatId]);

  const handleSend = () => {
    if (!inputValue.trim() || isWaitingForResponse) return;

    const userMessage: MessageType = { role: "user", content: inputValue.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsWaitingForResponse(true);

    setTimeout(() => {
      const botMessage: MessageType = {
        role: "assistant",
        content: "This is a simulated response from the Assistant.",
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsWaitingForResponse(false);
    }, 1000);
  };

  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.overflowY = "hidden";
      const maxHeight = 150;

      if (textarea.scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = "auto";
      } else {
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [inputValue]);

  return (
    <div className={`h-screen transition-colors duration-300 ${darkMode ? "bg-[#0d0d0d] text-white" : "bg-[#fefefe] text-gray-900"}`}>
      <header className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'} ${!darkMode ? 'bg-gray-100/50' : ''}`}>
        <h1 className="text-2xl font-semibold tracking-wide font-serif animate-fade-in">
          RAG AI Chat
        </h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="transition-colors duration-300 px-4 py-2 rounded-md bg-purple-700 hover:bg-purple-600 dark:bg-purple-400 dark:hover:bg-purple-500 text-white dark:text-black"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </header>

      <main className="flex flex-1 h-[calc(100vh-80px)]">
        <Navbar darkMode={darkMode} />
        <section className="flex-1 flex flex-col px-6 py-4 animate-fade-in">
          <Messages messages={messages} />

          {/* Input Area */}
          <div className="w-full px-2 mt-2">
            <div className="w-full rounded-xl bg-purple-900/20 dark:bg-purple-200/20 focus-within:ring-2 focus-within:ring-purple-500 transition-all px-4 py-3 flex flex-col gap-">
              <textarea
                ref={textareaRef}
                placeholder="Speak your thought..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className={`w-full max-h-[150px] min-h-[40px] bg-transparent focus:outline-none resize-none overflow-y-auto break-words break-all whitespace-pre-wrap text-left px-2 ${darkMode ? 'placeholder:text-gray-400' : 'placeholder:text-gray-500'}`}
              />
              <div className="flex items-center justify-between px-1">
                <div className="flex gap-2">
                  <button className="text-xs text-purple-300 opacity-50 cursor-default" disabled>
                    Tools coming soon...
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isWaitingForResponse}
                  aria-label="Send message"
                  className={`flex items-center justify-center rounded-full transition-colors h-9 w-9 ${!inputValue.trim() || isWaitingForResponse
                    ? "bg-gray-400 text-white hover:bg-gray-400"
                    : "bg-purple-700 hover:bg-purple-600 text-white dark:bg-purple-500 dark:hover:bg-purple-400 dark:text-black"}`}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.99992 14.9993V5.41334L4.70696 8.70631C4.31643 9.09683 3.68342 9.09683 3.29289 8.70631C2.90237 8.31578 2.90237 7.68277 3.29289 7.29225L8.29289 2.29225L8.36906 2.22389C8.76184 1.90354 9.34084 1.92613 9.70696 2.29225L14.707 7.29225L14.7753 7.36842C15.0957 7.76119 15.0731 8.34019 14.707 8.70631C14.3408 9.07242 13.7618 9.09502 13.3691 8.77467L13.2929 8.70631L9.99992 5.41334V14.9993C9.99992 15.5516 9.55221 15.9993 8.99992 15.9993C8.44764 15.9993 7.99993 15.5516 7.99992 14.9993Z" fill="currentColor"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
