"""
Prompt builders for different model types.
"""
from .base import detect_model_type, estimate_tokens
from .qwen import build_qwen_prompt
from .phi import build_phi_prompt
from .deepseek import build_deepseek_prompt
from .deepseek_coder import build_deepseek_coder_prompt
from .llama import build_llama_prompt
from .generic import build_generic_prompt

# Import model configs from llm.py to get context windows
try:
    from ..llm import MODEL_CONFIGS
    
    # Model-specific context window sizes - derived from llm.py MODEL_CONFIGS
    MODEL_CONTEXT_WINDOWS = {
        'qwen': MODEL_CONFIGS.get('qwen', {}).get('n_ctx', 32768),
        'phi': MODEL_CONFIGS.get('phi', {}).get('n_ctx', 2048),
        'deepseek': MODEL_CONFIGS.get('default', {}).get('n_ctx', 4096),
        'deepseek-coder': MODEL_CONFIGS.get('deepseek-coder', {}).get('n_ctx', 4096),
        'llama': MODEL_CONFIGS.get('llama-pro', {}).get('n_ctx', 8192),
        'mistral': MODEL_CONFIGS.get('mistral', {}).get('n_ctx', 32768),
        'default': MODEL_CONFIGS.get('default', {}).get('n_ctx', 4096)
    }
except ImportError:
    # Fallback if llm.py is not available
    MODEL_CONTEXT_WINDOWS = {
        'qwen': 32768,
        'phi': 2048,
        'deepseek': 4096,
        'deepseek-coder': 4096,
        'llama': 8192,
        'mistral': 32768,
        'default': 4096
    }

def build_model_specific_prompt(message: str, recent: list, retrieved: list[str], 
                               system_prompt: str = None, model_path: str = "") -> str:
    """Build a model-specific prompt based on the model path."""
    model_type = detect_model_type(model_path)
    
    try:
        if model_type == 'qwen':
            return build_qwen_prompt(message, recent, retrieved, system_prompt, model_path)
        elif model_type == 'phi':
            return build_phi_prompt(message, recent, retrieved, system_prompt, model_path)
        elif model_type == 'deepseek':
            return build_deepseek_prompt(message, recent, retrieved, system_prompt, model_path)
        elif model_type == 'deepseek-coder':
            return build_deepseek_coder_prompt(message, recent, retrieved, system_prompt, model_path)
        elif model_type == 'llama':
            return build_llama_prompt(message, recent, retrieved, system_prompt, model_path)
        else:
            return build_generic_prompt(message, recent, retrieved, system_prompt, model_path)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error building {model_type} prompt: {e}")
        # Fallback to generic prompt
        return build_generic_prompt(message, recent, retrieved, system_prompt, model_path)

# For backward compatibility - create a legacy build_prompt function
def build_prompt(message: str, recent: list, retrieved: list[str], 
                system_prompt: str = None, model_path: str = "") -> str:
    """Legacy generic prompt builder."""
    return build_generic_prompt(message, recent, retrieved, system_prompt, model_path)

# Export all main functions
__all__ = [
    'build_model_specific_prompt',
    'build_prompt',
    'build_qwen_prompt', 
    'build_phi_prompt',
    'build_deepseek_prompt',
    'build_deepseek_coder_prompt',
    'build_llama_prompt',
    'build_generic_prompt',
    'detect_model_type',
    'estimate_tokens',
    'MODEL_CONTEXT_WINDOWS'
]
