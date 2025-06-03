import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

type ThemeColor = 'purple' | 'blue' | 'green' | 'red' | 'grey';

export default function SettingsPage() {
  // Use theme context for theme mode and theme color
  const { themeMode, setThemeMode, themeColor, setThemeColor } = useTheme();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Save notification settings
  useEffect(() => {
    localStorage.setItem('notifications', notificationsEnabled.toString());
  }, [notificationsEnabled]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-screen-md">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-6">
        {/* Theme Mode */}
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg shadow-sm">
          <div>
            <h2 className="text-lg font-medium mb-2">Appearance</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Choose between light, dark, or system-based theme</p>
          
            <div className="grid grid-cols-3 gap-3 mt-3">
              <button
                onClick={() => setThemeMode('light')}
                className={`flex flex-row items-center justify-center h-8 px-2 rounded-lg border ${themeMode === 'light' ? 'border-[var(--theme-color)] bg-[var(--theme-color-dark)] bg-opacity-10' : 'border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-xs font-medium">Light</span>
              </button>
              
              <button
                onClick={() => setThemeMode('dark')}
                className={`flex flex-row items-center justify-center h-8 px-2 rounded-lg border ${themeMode === 'dark' ? 'border-[var(--theme-color)] bg-[var(--theme-color-dark)] bg-opacity-10' : 'border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className="text-xs font-medium">Dark</span>
              </button>
              
              <button
                onClick={() => setThemeMode('system')}
                className={`flex flex-row items-center justify-center h-8 px-2 rounded-lg border ${themeMode === 'system' ? 'border-[var(--theme-color)] bg-[var(--theme-color-dark)] bg-opacity-10' : 'border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium">System</span>
              </button>
            </div>
            
            <p className="text-xs text-[var(--text-tertiary)] mt-2 italic">
              {themeMode === 'system' && 'System mode follows time of day (dark from 6 PM to 6 AM)'}
            </p>
          </div>
        </div>
        
        {/* Theme Color */}
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg shadow-sm">
          <div>
            <h2 className="text-lg font-medium mb-2">Theme Color</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Choose a theme color</p>
            
            <div className="flex space-x-3">
              {['purple', 'blue', 'green', 'red', 'grey'].map((color) => (
                <button
                  key={color}
                  onClick={() => setThemeColor(color as ThemeColor)}
                  className={`w-8 h-8 rounded-full ${color === themeColor ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                  style={{ backgroundColor: `var(--color-${color}-500)` }}
                  aria-label={`${color} theme`}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Notifications */}
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg shadow-sm">
          <div>
            <h2 className="text-lg font-medium mb-2">Notifications</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Enable or disable notifications</p>
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Enable notifications</span>
              <button
                onClick={() => setNotificationsEnabled(prev => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-[var(--theme-color)]' : 'bg-gray-300'}`}
              >
                <span
                  className={`${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}