export interface Model {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  context_length: number;
  model_type: string;
}

export interface ModelsResponse {
  models: Model[];
}

// API base URL - matches the client.ts configuration
const API_BASE_URL = 'http://localhost:8000';

export const modelsApi = {
  // Get available models
  getModels: async (): Promise<ModelsResponse> => {
    const response = await fetch(`${API_BASE_URL}/chat/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  // Preload a specific model
  preloadModel: async (modelId: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/chat/models/${modelId}/preload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.detail || 'Failed to preload model';
      } catch {
        errorMessage = `Failed to preload model: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    return response.json();
  },
};
