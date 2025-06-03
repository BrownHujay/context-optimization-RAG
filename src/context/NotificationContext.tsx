import { createContext, useState, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';

interface NotificationContextType {
  sendNotification: (title: string, body: string) => void;
  tabActive: boolean;
  updateTitleWithNotification: (count: number) => void;
  resetTitleNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  // Initialize tab active state based on document.hidden
  const [tabActive, setTabActive] = useState(!document.hidden);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  // Store the last known proper title, not just the initial title
  const [originalTitle, setOriginalTitle] = useState(document.title);
  const [lastChatTitle, setLastChatTitle] = useState<string | null>(null);
  
  // Debug: log initial state
  console.log('NotificationProvider initialized', { 
    tabActive, 
    hidden: document.hidden,
    permission: Notification.permission,
    title: document.title
  });

  // Check if notifications are enabled in localStorage
  const areNotificationsEnabled = () => {
    const notificationsEnabled = localStorage.getItem('notifications');
    return notificationsEnabled === null || notificationsEnabled === 'true';
  };

  // Request notification permission if needed
  useEffect(() => {
    if (areNotificationsEnabled() && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(result => {
        setPermission(result);
      });
    } else {
      setPermission(Notification.permission);
    }
  }, []);

  // Set up visibility change listeners and initial tab state
  useEffect(() => {
    // Initialize tab active state based on document.hidden
    setTabActive(!document.hidden);
    console.log('Initial tab active state:', !document.hidden);
    
    const handleVisibilityChange = () => {
      const isTabActive = !document.hidden;
      console.log('Visibility changed, tab active:', isTabActive);
      setTabActive(isTabActive);
      
      // When tab becomes active again, reset title to the proper chat title
      if (isTabActive) {
        const titleToRestore = lastChatTitle || originalTitle;
        document.title = titleToRestore;
        console.log('Tab active, resetting title to:', titleToRestore);
      }
    };

    // Save original title
    setOriginalTitle(document.title);
    console.log('Original title saved:', document.title);
    
    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Remove event listener on cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Function to send a notification
  const sendNotification = (title: string, body: string) => {
    // Log notification attempt for debugging
    console.log('Attempting to send notification:', { 
      title, 
      body, 
      tabActive,
      permission,
      notificationsEnabled: areNotificationsEnabled() 
    });
    
    // Only send if notifications are enabled in settings
    if (!areNotificationsEnabled()) {
      console.log('Notifications are disabled in settings');
      return;
    }
    
    // Only send notifications if the tab is not active
    if (!tabActive && permission === 'granted') {
      try {
        // Create a macOS-style notification (silent by default)
        const notification = new Notification(title, {
          body,
          icon: '/chat-icon.svg', // Use your chat icon for brand consistency
          silent: true, // Disable sound as requested
          requireInteraction: false // Auto-dismiss after a short time like macOS notifications
        });
        
        console.log('macOS-style notification sent');
        
        // Focus the window when notification is clicked
        notification.onclick = function() {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    } else {
      console.log(
        !tabActive 
          ? 'Permission not granted for notifications' 
          : 'Tab is active, not sending notification'
      );
    }
  };

  // Function to update title with notification count
  const updateTitleWithNotification = (count: number) => {
    if (!areNotificationsEnabled()) return;
    
    // Don't update title if tab is active
    if (tabActive) return;
    
    // Get current route to determine chat title
    const pathParts = window.location.pathname.split('/');
    const isChat = pathParts.length > 1 && pathParts[1] === 'chat';
    const chatId = isChat && pathParts.length > 2 ? pathParts[2] : null;
    
    // Set a contextual title based on current page
    const contextTitle = isChat && chatId ? `Chat ${chatId}` : originalTitle;
    
    // Save the current context title for later restoration
    setLastChatTitle(contextTitle);
    
    if (count > 0) {
      document.title = `(${count}) ${contextTitle}`;
      console.log(`Updated title to: ${document.title} (saved context: ${contextTitle})`);
    } else {
      document.title = contextTitle;
      console.log(`Reset title to: ${contextTitle}`);
    }
  };

  // Function to reset title notifications
  const resetTitleNotifications = () => {
    // Use the last chat title if available, otherwise fall back to original title
    const titleToRestore = lastChatTitle || originalTitle;
    console.log('Resetting title notifications to:', titleToRestore);
    document.title = titleToRestore;
  };

  return (
    <NotificationContext.Provider value={{
      sendNotification,
      tabActive,
      updateTitleWithNotification,
      resetTitleNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Custom hook to use the notification context
export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
