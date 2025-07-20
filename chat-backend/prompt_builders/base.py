"""
Base utilities for prompt builders.
"""
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def get_system_prompt_for_profile(model_path: str, custom_system_prompt: str = None) -> str:
    """Get the appropriate system prompt for a model profile.
    
    Args:
        model_path: Path to the model file, used to detect model profile
        custom_system_prompt: Custom system prompt from user account settings
        
    Returns:
        System prompt string to use
    """
    if custom_system_prompt and custom_system_prompt.strip():
        return custom_system_prompt.strip()
    
    # Import here to avoid circular imports
    from llm import get_model_system_prompt, MODEL_CONFIGS
    
    # Try to find matching model profile by path
    model_profile = "default"  # fallback
    for profile, config in MODEL_CONFIGS.items():
        if config["path"] == model_path:
            model_profile = profile
            break
    
    return get_model_system_prompt(model_profile)

# Token estimation ratios for different model types
TOKEN_RATIOS = {
    'default': 4,  # ~4 chars per token for most models
    'chinese': 2,  # Chinese models like Qwen may have different tokenization
}

def estimate_tokens(text: str, model_type: str = 'default') -> int:
    """Estimate token count for a given text."""
    if not text:
        return 0
    ratio = TOKEN_RATIOS.get(model_type, TOKEN_RATIOS['default'])
    return len(text) // ratio

def smart_truncate_message(content: str, max_tokens: int, model_type: str = 'default') -> str:
    """Intelligently truncate a message to fit within token limits."""
    if not content:
        return content
    
    estimated_tokens = estimate_tokens(content, model_type)
    if estimated_tokens <= max_tokens:
        return content
    
    # Calculate approximate character limit
    ratio = TOKEN_RATIOS.get(model_type, TOKEN_RATIOS['default'])
    char_limit = max_tokens * ratio
    
    # Try to find a good breakpoint (sentence, paragraph, etc.)
    if len(content) > char_limit:
        # Look for sentence endings near the limit
        truncated = content[:char_limit]
        
        # Find the last sentence ending
        for ending in ['. ', '! ', '? ', '\n\n', '\n']:
            last_ending = truncated.rfind(ending)
            if last_ending > char_limit * 0.7:  # Don't truncate too aggressively
                return truncated[:last_ending + 1].strip()
        
        # If no good breakpoint found, truncate at word boundary
        words = truncated.rsplit(' ', 1)
        if len(words) > 1:
            return words[0].strip() + ' [...]'
    
    return content[:char_limit].strip() + ' [...]'

def build_conversation_context(recent: List[Any], max_tokens: int, model_type: str = 'default') -> List[Dict[str, str]]:
    """Build conversation context with smart token management and proper message alternation."""
    if not recent:
        return []
    
    context = []
    used_tokens = 0
    
    # Process messages in reverse order (most recent first)
    for msg in reversed(recent):
        if isinstance(msg, dict):
            role = msg.get('role', 'user').lower()
            # Normalize role names
            if role not in ['user', 'assistant']:
                role = 'user'  # Default to user for unknown roles
            
            # Try different content field names
            content = None
            for field in ['content', 'text', 'response', 'message']:
                if field in msg and msg[field]:
                    content = str(msg[field]).strip()
                    break
        elif isinstance(msg, str):
            role = 'user'
            content = str(msg).strip()
        else:
            continue
        
        if not content:
            continue
        
        # Estimate tokens for this message
        msg_tokens = estimate_tokens(content, model_type) + 10  # Add overhead for formatting
        
        # If this message would exceed our limit, try to fit a truncated version
        if used_tokens + msg_tokens > max_tokens:
            remaining_tokens = max_tokens - used_tokens - 10  # Leave some buffer
            if remaining_tokens > 50:  # Only include if we have reasonable space
                content = smart_truncate_message(content, remaining_tokens, model_type)
                msg_tokens = estimate_tokens(content, model_type) + 10
            else:
                break  # Not enough space for more messages
        
        # Skip consecutive messages from the same role to prevent models from talking to themselves
        if context and context[-1]['role'] == role:
            logger.warning(f"Skipping consecutive {role} message to maintain proper alternation")
            continue
        
        context.append({'role': role, 'content': content})
        used_tokens += msg_tokens
        
        # Stop if we're getting close to the limit
        if used_tokens >= max_tokens * 0.9:
            break
    
    # Reverse to get chronological order
    context.reverse()
    return context

def build_references_context(retrieved: List[str], max_tokens: int, model_type: str = 'default') -> List[str]:
    """Build reference context with smart token management."""
    if not retrieved:
        return []
    
    references = []
    used_tokens = 0
    
    for ref in retrieved:
        if not ref or not ref.strip():
            continue
        
        ref_text = ref.strip()
        ref_tokens = estimate_tokens(ref_text, model_type) + 5  # Add overhead
        
        # If this reference would exceed our limit, try to fit a truncated version
        if used_tokens + ref_tokens > max_tokens:
            remaining_tokens = max_tokens - used_tokens - 5
            if remaining_tokens > 100:  # Only include if we have reasonable space
                ref_text = smart_truncate_message(ref_text, remaining_tokens, model_type)
                ref_tokens = estimate_tokens(ref_text, model_type) + 5
            else:
                break  # Not enough space for more references
        
        references.append(ref_text)
        used_tokens += ref_tokens
        
        # Stop if we're getting close to the limit
        if used_tokens >= max_tokens * 0.9:
            break
    
    return references

def detect_model_type(model_path: str) -> str:
    """Detect model type from model path."""
    if not model_path:
        return 'default'
    
    model_name = model_path.lower()
    
    # Check for DeepSeek first (before Qwen since DeepSeek R1 contains "qwen")
    if 'deepseek' in model_name:
        # Check if it's specifically a coder variant
        if 'coder' in model_name:
            return 'deepseek-coder'
        return 'deepseek'
    
    # Check for specific model types
    if 'qwen' in model_name or 'qianwen' in model_name:
        return 'qwen'
    elif 'phi' in model_name:
        return 'phi'
    elif 'llama' in model_name or 'llama2' in model_name or 'llama3' in model_name:
        return 'llama'
    elif 'mistral' in model_name:
        return 'mistral'
    elif 'gemma' in model_name:
        return 'gemma'
    elif 'codellama' in model_name:
        return 'llama'  # CodeLlama uses same format as Llama
    elif 'vicuna' in model_name:
        return 'llama'  # Vicuna uses Llama format
    elif 'wizardlm' in model_name:
        return 'llama'  # WizardLM uses Llama format
    elif 'openhermes' in model_name:
        return 'llama'  # OpenHermes uses Llama format
    elif 'tinyllama' in model_name:
        return 'llama'  # TinyLlama uses Llama format
    else:
        # Check file extension or other indicators
        if model_path.endswith('.gguf'):
            # GGUF files might have model type in the name
            return 'default'
        else:
            return 'default'
