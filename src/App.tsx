import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "./components/LeftNavbar";
import ChatView from "./pages/Chatview";
import Homepage from "./pages/Homepage";
import AccountPage from "./pages/AccountPage";
import StatisticsPage from "./pages/StatisticsPage";
import SettingsPage from "./pages/SettingsPage";
import { motion, AnimatePresence } from "framer-motion";

// Inner component to handle routes with location-based animations
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<{ [id: string]: string[] }>({});
  const [activeId, setActiveId] = useState("");
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);

  // Update activeId based on URL when needed
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    if (pathParts[1] === 'chat' && pathParts[2]) {
      setActiveId(pathParts[2]);
    }
  }, [location]);

  // Update document title based on active chat
  useEffect(() => {
    document.title = activeId ? `Chat ${activeId}` : 'Chat App';
  }, [activeId]);

  const handleNewChat = () => {
    navigate('/');
  };

  const updateMessages = (id: string, messages: string[]) => {
    if (!id && messages.length > 0) {
      // Create new chat when sending first message from homepage
      const newId = Date.now().toString();
      setConversations(prev => ({ ...prev, [newId]: messages }));
      setActiveId(newId);
      navigate(`/chat/${newId}`);
    } else if (id) {
      // Update existing chat
      setConversations(prev => ({ ...prev, [id]: messages }));
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar
        activeId={activeId}
        setActiveId={setActiveId}
        conversations={Object.keys(conversations)}
        onNewChat={handleNewChat}
        messages={conversations}
        isNavbarVisible={isNavbarVisible}
        setIsNavbarVisible={setIsNavbarVisible}
      />
      <motion.div 
        className="flex-1 relative overflow-hidden bg-[var(--bg-primary)]"
        animate={{ 
          marginLeft: isNavbarVisible ? "264px" : "0px",
          width: isNavbarVisible ? "calc(100% - 264px)" : "100%"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          <div className="relative z-10 h-full overflow-y-auto">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <Homepage
                    updateMessages={updateMessages}
                  />
                }
              />
              <Route
                path="/chat/:id"
                element={
                  activeId && conversations[activeId] ? (
                    <ChatView
                      activeId={activeId}
                      messages={conversations[activeId] || []}
                      updateMessages={updateMessages}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Wrapper component for router
export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
