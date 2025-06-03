import { useState, useEffect, useCallback } from 'react';
import type { Account, AccountUpdateSettings } from '../api/types';
import { getAccount, updateAccountSettings } from '../api';

interface UseAccountResult {
  account: Account | null;
  loading: boolean;
  error: string | null;
  updateSettings: (settings: AccountUpdateSettings) => Promise<void>;
  refreshAccount: () => Promise<void>;
}

export function useAccount(accountId: string): UseAccountResult {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!accountId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await getAccount(accountId);
      
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setAccount(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const updateSettings = useCallback(async (settingsUpdate: AccountUpdateSettings) => {
    if (!accountId) return;
    
    try {
      const response = await updateAccountSettings(accountId, settingsUpdate);
      
      if (response.error) {
        setError(response.error);
      } else {
        // Refresh account to get updated settings
        await fetchAccount();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  }, [accountId, fetchAccount]);

  // Initial fetch
  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  return {
    account,
    loading,
    error,
    updateSettings,
    refreshAccount: fetchAccount
  };
}
