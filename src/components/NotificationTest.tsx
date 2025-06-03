import React from 'react';
import { useNotification } from '../context/NotificationContext';

const NotificationTest: React.FC = () => {
  const { sendNotification, updateTitleWithNotification, resetTitleNotifications } = useNotification();

  const testNotification = () => {
    // Force notification regardless of tab state
    console.log('Testing notification directly...');
    
    // Request permission if not granted
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          // Create notification directly without going through context
          new Notification('Test Notification', {
            body: 'This is a direct test notification',
            icon: '/chat-icon.svg',
            silent: false
          });
        } else {
          console.error('Notification permission denied');
          alert('Notification permission denied. Please enable notifications in your browser settings.');
        }
      });
    } else {
      // Create notification directly
      new Notification('Test Notification', {
        body: 'This is a direct test notification',
        icon: '/chat-icon.svg',
        silent: false
      });
    }
    
    // Also test through context
    sendNotification('Context Test', 'Testing through notification context');
    
    // Update title directly
    document.title = `(${Math.floor(Math.random() * 10)}) Chat App`;
    console.log('Updated title directly to:', document.title);
    
    // Also test through context
    updateTitleWithNotification(3);
  };
  
  const resetTitle = () => {
    resetTitleNotifications();
    document.title = 'Chat App';
    console.log('Reset title to:', document.title);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-lg font-bold">Notification Test Panel</h2>
      <div className="flex gap-2">
        <button 
          onClick={testNotification}
          className="px-4 py-2 bg-[var(--theme-color)] text-white rounded hover:bg-[var(--theme-color-dark)] transition"
        >
          Test Notification
        </button>
        <button 
          onClick={resetTitle}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
        >
          Reset Title
        </button>
      </div>
      <div className="text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded">
        <p>Browser notification support: <strong>{typeof Notification !== 'undefined' ? 'Yes' : 'No'}</strong></p>
        <p>Current permission: <strong>{Notification.permission}</strong></p>
        <p>Current document title: <strong>{document.title}</strong></p>
      </div>
    </div>
  );
};

export default NotificationTest;
