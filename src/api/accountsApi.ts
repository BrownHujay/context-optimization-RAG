// Accounts API Service
import { apiRequest } from './client';
import type { 
  Account, 
  AccountCreate, 
  AccountUpdateSettings, 
  ApiResponse,
  Chat
} from './types';

/**
 * Create a new account
 */
export async function createAccount(accountData: AccountCreate): Promise<ApiResponse<{ id: string, message: string }>> {
  return apiRequest('/accounts', {
    method: 'POST',
    body: accountData,
  });
}

/**
 * Get account by ID
 */
export async function getAccount(accountId: string): Promise<ApiResponse<Account>> {
  return apiRequest(`/accounts/${accountId}`);
}

/**
 * Update account settings
 */
export async function updateAccountSettings(
  accountId: string, 
  settings: AccountUpdateSettings
): Promise<ApiResponse<{ message: string }>> {
  return apiRequest(`/accounts/${accountId}/settings`, {
    method: 'PUT',
    body: settings,
  });
}

/**
 * Get all chats for an account
 */
export async function getAccountChats(accountId: string): Promise<ApiResponse<Chat[]>> {
  return apiRequest(`/accounts/${accountId}/chats`);
}

/**
 * Update account statistics
 */
export async function updateAccountStatistics(
  accountId: string, 
  statistics: any
): Promise<ApiResponse<{ message: string }>> {
  return apiRequest(`/accounts/${accountId}/statistics`, {
    method: 'PUT',
    body: statistics,
  });
}
