import { useEffect, useState } from "react";
import ChatInput from "../components/ChatInput";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function Homepage() {
  console.log("🏠 Homepage component rendered");
  const { currentUser, login } = useAuth();
  const [accountId, setAccountId] = useState("test-user-1");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Update document title
  useEffect(() => {
    document.title = "Chat App - Home";
  }, []);

  const handleLogin = async () => {
    if (!accountId.trim()) return;
    setIsLoggingIn(true);
    try {
      const success = await login(accountId);
      if (!success) {
        console.error("Login failed");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Direct login method that bypasses API for testing
  const handleDirectLogin = () => {
    localStorage.setItem('accountId', 'test-user-1');
    window.location.reload();
  };
  

  return (
    <motion.div 
      className="flex flex-col flex-1 items-center justify-center h-full bg-[var(--bg-primary)] text-[var(--text-primary)]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.48, // 40% faster (0.8 * 0.6 = 0.48)
        ease: "easeInOut"
      }}
    >
      <div className="w-full max-w-2xl px-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        {!currentUser && (
          <motion.div 
            className="mb-8 p-6 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <h2 className="text-xl font-bold mb-4">Login to Start Chatting</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Enter account ID"
                className="flex-1 p-2 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
              />
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="px-4 py-2 bg-[var(--theme-color)] text-white rounded hover:bg-[var(--theme-color-dark)] transition disabled:opacity-50"
              >
                {isLoggingIn ? "Logging in..." : "Login"}
              </button>
              <button
                onClick={handleDirectLogin}
                className="ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                Force Login
              </button>
            </div>
          </motion.div>
        )}
        <motion.h1 
          className="text-3xl font-bold mb-6 text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          What's on your mind?
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <ChatInput />
        </motion.div>
      </div>
    </motion.div>
  );
}
