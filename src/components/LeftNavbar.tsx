import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useChat } from "../context/ChatContext";

interface NavbarProps {
  onNewChat: () => void;
  isNavbarVisible: boolean;
  setIsNavbarVisible: (visible: boolean) => void;
}

// Search input as a separate component to prevent re-renders
const SearchInput = ({ value, onChange, onClear }: { value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, onClear: () => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when mounted
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, []);
  
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search conversations..."
        value={value}
        onChange={onChange}
        className="w-full p-2 pl-10 pr-10 border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
      />
      <div className="absolute left-3 top-2.5 text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      {value && (
        <button 
          onClick={onClear}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default function LeftNavbar({ 
  onNewChat, 
  isNavbarVisible, 
  setIsNavbarVisible 
}: NavbarProps) {
  const navigate = useNavigate();
  const { activeChat, chats, setActiveChat } = useChat();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; content: string; matches: number }[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSwitch = (id: string) => {
    const chat = chats.find(c => c.id === id);
    if (chat) {
      setActiveChat(chat);
      navigate(`/chat/${id}`);
    }
  };

  const toggleNavbar = () => {
    setIsNavbarVisible(!isNavbarVisible);
  };

  useEffect(() => {
    // Reset search when navbar is closed
    if (!isNavbarVisible) {
      setSearchTerm("");
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  }, [isNavbarVisible]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    // Set searching state to true to show loading indicator
    setIsSearching(true);
    
    // Small delay to ensure the UI updates with the "Searching..." state
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Search through all chats
      const results: { id: string; content: string; matches: number }[] = [];
      
      // For now, just add the chat title as a search result if it matches
      chats.forEach(chat => {
        if (chat.title && chat.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push({
            id: chat.id,
            content: chat.title,
            matches: (chat.title.toLowerCase().match(new RegExp(searchTerm.toLowerCase(), 'g')) || []).length
          });
        }
      });
      
      setSearchResults(results.sort((a, b) => b.matches - a.matches));
    } finally {
      // Always set isSearching to false when done, even if there's an error
      setIsSearching(false);
    }
  };

  // Handle search term changes with debounce
  useEffect(() => {
    if (!isSearchOpen) return;

    if (searchTerm.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    // Set searching to true immediately when typing
    setIsSearching(true);

    const timer = setTimeout(() => {
      handleSearch();
    }, 300); // Debounce for better performance

    return () => clearTimeout(timer);
  }, [searchTerm, isSearchOpen]);
  
  // Clear search results when closing the popup
  useEffect(() => {
    if (!isSearchOpen) {
      // Don't clear searchTerm to preserve it if popup reopens
      setSearchResults([]);
      setIsSearching(false); // Make sure to reset searching state
    }
  }, [isSearchOpen]);

  return (
    <>
      {/* Toggle Button (Hamburger/Back) */}
      <button
        className={`fixed top-4 ${isNavbarVisible ? 'left-[270px]' : 'left-4'} z-50 bg-[var(--bg-secondary)] rounded-full p-2 shadow-md transition-all duration-300 hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]`}
        onClick={toggleNavbar}
        aria-label={isNavbarVisible ? "Hide sidebar" : "Show sidebar"}
      >
        {isNavbarVisible ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--theme-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="sr-only">Back</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--theme-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="sr-only">Menu</span>
          </>
        )}
      </button>
      
      {/* Navbar */}
      <motion.div 
        className={`fixed left-0 top-0 bottom-0 z-40 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] shadow-lg`}
        initial={false}
        animate={{ 
          x: isNavbarVisible ? 0 : -320,
          boxShadow: isNavbarVisible ? "10px 0 30px rgba(0, 0, 0, 0.1)" : "none"
        }}
        transition={{ 
          type: "spring", 
          stiffness: 500, 
          damping: 35,
          mass: 0.8,
          duration: 0.2
        }}
      >
        <div className="p-4">
          <h1 className="font-bold text-lg">Chats</h1>
        </div>
        
        <div className="px-2 pb-2 space-y-2">
          <button 
            onClick={onNewChat}
            className="w-full p-2 rounded-lg transition-colors bg-[var(--theme-color)] bg-opacity-10 hover:bg-opacity-20 text-[var(--text-primary)] flex items-center"
            aria-label="New chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="ml-2 font-medium">New Chat</span>
          </button>
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="w-full p-2 rounded-lg transition-colors bg-[var(--theme-color-dark)] bg-opacity-10 text-[var(--text-primary)] flex items-center"
            aria-label="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="ml-2 font-medium">Search</span>
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto px-2 pb-16" style={{ height: 'calc(100vh - 180px - 60px)' }}>
          {chats.map(chat => (
            <motion.button
              key={chat.id}
              onClick={() => handleSwitch(chat.id)}
              className={`w-full p-3 text-left rounded-lg mb-2 transition-colors text-[var(--text-primary)] ${activeChat?.id === chat.id ? 'bg-[var(--theme-color-dark)] bg-opacity-20' : 'hover:bg-[var(--bg-tertiary)]'}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="font-medium">{chat.title || `Chat ${chat.id.slice(0, 8)}`}</span>
              <p className="text-sm text-[var(--text-secondary)] truncate">
                {new Date(chat.updated_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </motion.button>
          ))}
        </div>
        
        {/* Bottom nav buttons */}
        <div className="p-2 border-t border-[var(--border-color)] absolute bottom-0 left-0 right-0 bg-[var(--bg-secondary)] w-64">
          <div className="flex justify-around items-center py-1">
            <button 
              onClick={() => navigate('/account')}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--theme-color-dark)] hover:bg-opacity-10 hover:text-[var(--theme-color)] text-[var(--text-tertiary)]"
              aria-label="Account"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            
            <button 
              onClick={() => navigate('/statistics')}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--theme-color-dark)] hover:bg-opacity-10 hover:text-[var(--theme-color)] text-[var(--text-tertiary)]"
              aria-label="Statistics"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--theme-color-dark)] hover:bg-opacity-10 hover:text-[var(--theme-color)] text-[var(--text-tertiary)]"
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Fixed-position backdrop */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
          onClick={() => setIsSearchOpen(false)}
        >
          {/* Search popup content */}
          <div 
            className="w-full max-w-lg rounded-lg shadow-xl overflow-hidden animate-scale-in bg-[var(--bg-primary)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Search Messages</h2>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 bg-[var(--bg-primary)]">
              {/* Search input is a separate component to prevent re-renders */}
              <SearchInput 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm("")}
              />
              
              {/* Search results */}
              <div className="mt-4 max-h-80 overflow-y-auto bg-[var(--bg-primary)] rounded-lg">
                {isSearching ? (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    <div className="animate-pulse flex flex-col items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-4 text-[var(--theme-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-lg text-[var(--text-primary)]">Searching...</p>
                    </div>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Found {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
                    </p>
                    <div className="space-y-2">
                      {searchResults.map((result, index) => (
                        <button
                          key={`${result.id}-${index}`}
                          className="w-full text-left p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          onClick={() => {
                            setIsSearchOpen(false);
                            handleSwitch(result.id);
                          }}
                        >
                          <p className="font-medium text-[var(--text-primary)]">Chat {result.id}</p>
                          <p className="text-sm text-[var(--text-secondary)] truncate">{result.content}</p>
                        </button>
                      ))}
                    </div>
                  </>
                ) : searchTerm ? (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[var(--text-primary)]">No messages found</p>
                    <p className="text-sm mt-2 text-[var(--text-secondary)]">Try a different search term</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    <p className="text-[var(--text-primary)]">Start typing to search messages</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
