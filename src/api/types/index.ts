// API Types for Chat Application

// Account Types
export interface Account {
  id: string;
  username: string;
  email: string;
  settings: AccountSettings;
  statistics: AccountStatistics;
  created_at: string;
  updated_at: string;
}

export interface AccountSettings {
  theme: string;
  dark_mode: boolean;
  rag_auto_trim: boolean;
  rag_sim_threshold: number;
  model_profile: string;
}

export interface AccountStatistics {
  total_messages: number;
  total_chats: number;
  total_tokens: number;
}

export interface AccountCreate {
  username: string;
  email: string;
  password: string;
}

export interface AccountUpdateSettings {
  settings: Partial<AccountSettings>;
}

// Chat Types
export interface Chat {
  id: string;
  account_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatCreate {
  account_id: string;
  title: string;
}

export interface ChatUpdateTitle {
  title: string;
}

// Message Types
export interface Message {
  id: string;
  account_id: string;
  chat_id: string;
  text: string;
  response?: string;
  faiss_id?: number;
  summary?: string;
  title?: string;
  role: 'user' | 'assistant';
  created_at: string;
}

export interface MessageCreate {
  account_id: string;
  chat_id: string;
  text: string; // For user messages, text contains content. For assistant, use response field
  response?: string; // Contains the assistant's response
  faiss_id?: number;
  summary?: string;
  title?: string;
  // Note: role is stored in the frontend only, not sent to backend
  _role?: 'user' | 'assistant'; // Prefixed with underscore to indicate it's not sent to API
}

export interface SearchQuery {
  account_id: string;
  query: string;
}

// Chat Request Types
export interface ChatRequest {
  account_id: string;
  conversation_id: string;
  message: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
  // Enhanced error handling fields
  rawResponse?: string; // Raw response text for debugging
  details?: {
    message: string;
    url: string;
    method: string;
    stack?: string;
  }; // Detailed error information
}
