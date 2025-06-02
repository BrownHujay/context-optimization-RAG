import { createContext, useState, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';

type ThemeColor = 'purple' | 'blue' | 'green' | 'red';
type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDarkMode: boolean;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize theme mode from localStorage or default to system
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('themeMode') as ThemeMode) || 'system';
  });

  // Track whether dark mode is active (derived from themeMode)
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Initialize theme color from localStorage
  const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
    return (localStorage.getItem('themeColor') as ThemeColor) || 'purple';
  });

  // Function to check if dark mode should be active based on time of day
  const isDarkByTime = () => {
    const hours = new Date().getHours();
    return hours < 6 || hours >= 18; // Dark from 6 PM to 6 AM
  };

  // Function to determine if dark mode should be active based on system preference
  const isDarkBySystemPreference = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // Effect to update dark mode based on theme mode and time
  useEffect(() => {
    let newIsDark = false;
    
    if (themeMode === 'dark') {
      newIsDark = true;
    } else if (themeMode === 'light') {
      newIsDark = false;
    } else if (themeMode === 'system') {
      // For system mode, check time of day
      newIsDark = isDarkByTime();
    }
    
    setIsDarkMode(newIsDark);
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Apply dark mode class based on isDarkMode state
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  // Set up interval to check time-based theme when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return;
    
    // Check time every minute
    const intervalId = setInterval(() => {
      setIsDarkMode(isDarkByTime());
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, [themeMode]);
  
  // Apply theme color effect
  useEffect(() => {
    localStorage.setItem('themeColor', themeColor);
    
    // Remove any previous theme classes
    document.documentElement.classList.remove(
      'theme-purple',
      'theme-blue',
      'theme-green',
      'theme-red'
    );
    
    // Add the new theme class
    document.documentElement.classList.add(`theme-${themeColor}`);
  }, [themeColor]);

  return (
    <ThemeContext.Provider value={{ 
      themeMode,
      setThemeMode,
      isDarkMode,
      themeColor,
      setThemeColor
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to use the theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
