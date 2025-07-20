import { useEffect } from "react";
import ChatInput from "../components/ChatInput";
import { motion } from "framer-motion";

export default function Homepage() {
  console.log("🏠 Homepage component rendered");
  
  // Update document title
  useEffect(() => {
    document.title = "Chat App - Home";
  }, []);
  

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
