import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import Navbar from "./components/LeftNavbar";
import Homepage from "./pages/Homepage";
import AccountPage from "./pages/AccountPage";
import StatisticsPage from "./pages/StatisticsPage";
import SettingsPage from "./pages/SettingsPage";
import ChatPage from "./pages/ChatPage";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationProvider } from "./context/NotificationContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ChatProvider } from "./context/ChatContext";
import { useAuth } from "./context/AuthContext";

// Separate inner component that safely uses the auth context
// This component should be defined inside the App component to ensure it always has access to context
const RoutesWithAuth = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // This will now always have access to AuthProvider
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);

  // Handle new chat creation
  const handleNewChat = () => {
    // Reset title and navigate to homepage
    document.title = 'Chat App';
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar
        onNewChat={handleNewChat}
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
                element={<Homepage />}
              />
              <Route
                path="/chat/:id"
                element={
                  currentUser ? <ChatPage /> : <Navigate to="/" replace />
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
  // Define the content component within App to ensure context is always available
  // This prevents the "useAuth must be used within an AuthProvider" error during hot reloading
  const AppContent = () => {
    return (
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <ChatProvider>
              <RoutesWithAuth />
            </ChatProvider>
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    );
  };

  return (
    <Router>
      <AppContent />
    </Router>
  );
}
