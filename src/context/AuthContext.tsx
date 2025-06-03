import React, { createContext, useState, useEffect, useContext } from 'react';
import type { Account } from '../api/types';
import { getAccount } from '../api';

interface AuthContextType {
  currentUser: Account | null;
  loading: boolean;
  error: string | null;
  login: (accountId: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for saved user on mount
  useEffect(() => {
    const storedAccountId = localStorage.getItem('accountId');
    if (storedAccountId) {
      login(storedAccountId);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (accountId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getAccount(accountId);
      
      if (response.error) {
        setError(response.error);
        setLoading(false);
        return false;
      }
      
      if (response.data) {
        setCurrentUser(response.data);
        localStorage.setItem('accountId', accountId);
        setLoading(false);
        return true;
      }
      
      setLoading(false);
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('accountId');
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
