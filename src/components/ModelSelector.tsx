import { useState, useEffect } from 'react';
import { modelsApi } from '../api/modelsApi';

interface Model {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  context_length: number;
  model_type: string;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onModelPreload?: (modelId: string) => Promise<void>;
}

// Fallback models in case API fails
const FALLBACK_MODELS: Model[] = [
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B',
    description: 'Fast and efficient for most tasks',
    max_tokens: 4096,
    context_length: 8192,
    model_type: 'llama'
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    description: 'Balanced performance and quality',
    max_tokens: 4096,
    context_length: 16384,
    model_type: 'mistral'
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini',
    description: 'Lightweight and fast',
    max_tokens: 2048,
    context_length: 4096,
    model_type: 'phi'
  },
  {
    id: 'qwen-2.5-7b',
    name: 'Qwen 2.5 7B',
    description: 'Advanced reasoning capabilities',
    max_tokens: 4096,
    context_length: 32768,
    model_type: 'qwen'
  }
];

export default function ModelSelector({ selectedModel, onModelChange, onModelPreload }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>(FALLBACK_MODELS);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preloadingModel, setPreloadingModel] = useState<string | null>(null);

  // Fetch available models
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await modelsApi.getModels();
      setModels(data.models);
      console.log('✅ Successfully loaded models from API:', data.models.length);
    } catch (error) {
      console.error('❌ Failed to fetch models from API, using fallback:', error);
      // Keep fallback models if API fails
    }
  };

  const handleModelSelect = async (modelId: string) => {
    if (modelId === selectedModel) {
      setIsOpen(false);
      return;
    }

    setPreloadingModel(modelId);
    setLoading(true);

    try {
      // Preload the selected model
      if (onModelPreload) {
        await onModelPreload(modelId);
      }
      
      // Change the selected model
      onModelChange(modelId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to preload model:', error);
    } finally {
      setPreloadingModel(null);
      setLoading(false);
    }
  };

  const getModelIcon = (modelType: string) => {
    const iconClass = "w-4 h-4";
    switch (modelType.toLowerCase()) {
      case 'mistral':
        return (
          <svg className={`${iconClass} text-purple-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'llama':
        return (
          <svg className={`${iconClass} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      case 'phi':
        return (
          <svg className={`${iconClass} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'qwen':
        return (
          <svg className={`${iconClass} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'deepseek':
        return (
          <svg className={`${iconClass} text-indigo-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      default:
        return (
          <svg className={`${iconClass} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
    }
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)] transition-all duration-200 min-w-[180px] disabled:opacity-50 shadow-sm"
      >
        {selectedModelData && getModelIcon(selectedModelData.model_type)}
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {selectedModelData?.name || 'Select Model'}
          </div>
          {selectedModelData && (
            <div className="text-xs text-[var(--text-tertiary)]">
              {selectedModelData.max_tokens} tokens
            </div>
          )}
        </div>
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--theme-color)] border-t-transparent" />
        ) : (
          <svg 
            className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelSelect(model.id)}
              disabled={preloadingModel === model.id}
              className="w-full px-3 py-2.5 text-left hover:bg-[var(--bg-secondary)] transition-all duration-150 flex items-center gap-3 disabled:opacity-50 first:rounded-t-lg last:rounded-b-lg"
            >
              {getModelIcon(model.model_type)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {model.name}
                  </span>
                  {selectedModel === model.id && (
                    <svg className="w-4 h-4 text-[var(--theme-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {preloadingModel === model.id && (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-[var(--theme-color)] border-t-transparent" />
                  )}
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-1">
                  {model.description}
                </div>
                <div className="flex gap-4 text-xs text-[var(--text-quaternary)] mt-1">
                  <span>Context: {model.context_length.toLocaleString()}</span>
                  <span>Max: {model.max_tokens.toLocaleString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
