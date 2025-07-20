import json
from typing import List, Dict, Optional, Tuple, Any
import logging
import os

# Import model configs from llm.py
from llm import MODEL_CONFIGS

# Configure logging
logger = logging.getLogger(__name__)

# Token estimation for different model types
TOKEN_RATIOS = {
    'default': 4,  # ~4 chars per token for most models
    'chinese': 2,  # Chinese models like Qwen may have different tokenization
}

# Model-specific context window sizes - derived from llm.py MODEL_CONFIGS
MODEL_CONTEXT_WINDOWS = {
    'qwen': MODEL_CONFIGS.get('qwen', {}).get('n_ctx', 32768),
    'phi': MODEL_CONFIGS.get('phi', {}).get('n_ctx', 2048),
    'deepseek': MODEL_CONFIGS.get('deepseek-coder', {}).get('n_ctx', 4096),
    'llama': MODEL_CONFIGS.get('llama-pro', {}).get('n_ctx', 8192),
    'mistral': MODEL_CONFIGS.get('mistral', {}).get('n_ctx', 32768),
    'default': MODEL_CONFIGS.get('default', {}).get('n_ctx', 4096)
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
                context.append({'role': role, 'content': content})
            break
        
        context.append({'role': role, 'content': content})
        used_tokens += msg_tokens
    
    # Reverse to get chronological order and validate alternation
    context = list(reversed(context))
    
    # Ensure proper user/assistant alternation
    validated_context = []
    last_role = None
    
    for msg in context:
        current_role = msg['role']
        # Skip consecutive messages from the same role to prevent "talking to itself"
        if last_role == current_role:
            logger.warning(f"Skipping consecutive {current_role} message to maintain alternation")
            continue
        validated_context.append(msg)
        last_role = current_role
    
    return validated_context

def build_references_context(retrieved: List[str], max_tokens: int, model_type: str = 'default') -> List[str]:
    """Build reference context with smart token management."""
    if not retrieved:
        return []
    
    references = []
    used_tokens = 0
    
    for ref in retrieved:
        if not ref or not isinstance(ref, str):
            continue
        
        ref = ref.strip()
        ref_tokens = estimate_tokens(ref, model_type) + 5  # Add overhead
        
        if used_tokens + ref_tokens > max_tokens:
            # Try to fit a truncated version
            remaining_tokens = max_tokens - used_tokens - 5
            if remaining_tokens > 30:  # Only include if we have reasonable space
                ref = smart_truncate_message(ref, remaining_tokens, model_type)
                references.append(ref)
            break
        
        references.append(ref)
        used_tokens += ref_tokens
    
    return references

def detect_model_type(model_path: str) -> str:
    """Detect model type from model path."""
    if not model_path:
        return 'default'
    
    model_path = model_path.lower()
    
    # Check for model types based on filename patterns
    if 'qwen' in model_path:
        return 'qwen'
    elif 'phi-3' in model_path or 'phi3' in model_path:
        return 'phi'
    elif 'phi' in model_path:
        return 'phi'
    elif 'deepseek' in model_path:
        return 'deepseek'
    elif 'llama' in model_path:
        return 'llama'
    elif 'mistral' in model_path:
        return 'mistral'
    
    # Try to match with MODEL_CONFIGS keys
    for profile in MODEL_CONFIGS:
        config_path = MODEL_CONFIGS[profile].get('path', '')
        if config_path and os.path.basename(config_path).lower() in model_path:
            if 'qwen' in config_path.lower():
                return 'qwen'
            elif 'phi-3' in config_path.lower() or 'phi3' in config_path.lower():
                return 'phi'
            elif 'phi' in config_path.lower():
                return 'phi'
            elif 'deepseek' in config_path.lower():
                return 'deepseek'
            elif 'llama' in config_path.lower():
                return 'llama'
            elif 'mistral' in config_path.lower():
                return 'mistral'
    
    # Default to generic format
    return 'default'

def build_prompt(message: str, recent: list, retrieved: list[str], 
                system_prompt: str | None = None, model_path: str = "") -> str:
    """Build a generic prompt with smart context window management."""
    model_type = detect_model_type(model_path)
    context_window = MODEL_CONTEXT_WINDOWS.get(model_type, MODEL_CONTEXT_WINDOWS['default'])
    
    # Reserve tokens for the current message and response
    current_msg_tokens = estimate_tokens(message, model_type)
    reserved_tokens = current_msg_tokens + 500  # Reserve for response
    available_tokens = context_window - reserved_tokens
    
    # Allocate tokens
    system_tokens = min(200, available_tokens // 4)  # 25% for system
    history_tokens = min(available_tokens // 2, available_tokens - system_tokens - 100)  # 50% for history
    reference_tokens = available_tokens - system_tokens - history_tokens  # Remainder for references
    
    prompt_parts = []
    
    # Add system prompt with consistent thinking instructions
    default_system = """You are a helpful, accurate, and thoughtful AI assistant. When you need to think through a problem, analyze complex information, or reason step-by-step, wrap your internal reasoning in <think>...</think> tags. 

Your thinking process inside these tags will not be shown to the user, so you can:
- Break down complex problems
- Analyze information thoroughly 
- Consider multiple approaches
- Work through your reasoning

After your thinking, provide your clear, helpful response outside the think tags."""
    
    if system_prompt:
        system_prompt = system_prompt.strip()
        if estimate_tokens(system_prompt, model_type) > system_tokens:
            system_prompt = smart_truncate_message(system_prompt, system_tokens, model_type)
        prompt_parts.append(f"[System]: {system_prompt}")
    else:
        prompt_parts.append(f"[System]: {default_system}")
    
    # Add conversation history
    if recent:
        context_msgs = build_conversation_context(recent, history_tokens, model_type)
        for msg in context_msgs:
            role_label = "[User]" if msg['role'].lower() == 'user' else "[Assistant]"
            prompt_parts.append(f"{role_label}: {msg['content']}")
    
    # Add references as context (not as separate messages)
    if retrieved:
        references = build_references_context(retrieved, reference_tokens, model_type)
        if references:
            ref_context = "\n".join(f"- {ref}" for ref in references)
            prompt_parts.append(f"[Context]: The following information may be relevant:\n{ref_context}")
    
    # Add current message
    prompt_parts.append(f"[User]: {message.strip()}")
    prompt_parts.append("[Assistant]:")
    print(f"\n🌊 Generic prompt: {prompt_parts}")
    return "\n".join(prompt_parts)

def build_qwen_prompt(message: str, recent: list, retrieved: list[str], 
    system_prompt: str | None = None, model_path: str = "") -> list[dict]:
    """Build Qwen-specific messages using the messages format with proper context management."""
    model_type = 'qwen'
    context_window = MODEL_CONTEXT_WINDOWS[model_type]
    
    current_msg_tokens = estimate_tokens(message, model_type)
    reserved_tokens = current_msg_tokens + 500
    available_tokens = context_window - reserved_tokens
    
    system_tokens = min(300, available_tokens // 4)
    history_tokens = min(available_tokens // 2, available_tokens - system_tokens - 100)
    reference_tokens = available_tokens - system_tokens - history_tokens
    
    # System message with consistent thinking instructions
    default_system = """
    You are a kind, helpful and thoughtful assistant. Always think through your answers step by step and throughly.
    """
    
    system_msg = system_prompt.strip() if system_prompt else default_system
    if estimate_tokens(system_msg, model_type) > system_tokens:
        system_msg = smart_truncate_message(system_msg, system_tokens, model_type)
    
    messages = [{"role": "system", "content": system_msg}]
    
    # Add conversation history with proper alternation
    if recent:
        context_msgs = build_conversation_context(recent, history_tokens, model_type)
        for msg in context_msgs:
            messages.append({
                "role": msg['role'],
                "content": msg['content']
            })
    
    # Add references to the current user message if provided
    current_message = message.strip()
    if retrieved:
        references = build_references_context(retrieved, reference_tokens, model_type)
        if references:
            ref_text = "Here is some relevant context:\n" + "\n".join(references)
            current_message = f"{ref_text}\n\n{current_message}"
    
    messages.append({"role": "user", "content": current_message})
    print(f"\n🌊 Qwen messages: {messages}")
    return messages


def build_phi_prompt(message: str, recent: list, retrieved: list[str], 
                    system_prompt: str | None = None, model_path: str = "") -> str:
    """Build Phi-specific prompt using the Phi chat format."""
    model_type = 'phi'
    context_window = MODEL_CONTEXT_WINDOWS[model_type]
    
    current_msg_tokens = estimate_tokens(message, model_type)
    reserved_tokens = current_msg_tokens + 300  # Phi has smaller context, reserve less
    available_tokens = context_window - reserved_tokens
    
    system_tokens = min(150, available_tokens // 4)
    history_tokens = min(available_tokens // 2, available_tokens - system_tokens - 50)
    reference_tokens = available_tokens - system_tokens - history_tokens
    
    prompt_parts = []
    
    # System prompt with consistent thinking instructions
    default_system = """You are a helpful, accurate, and thoughtful AI assistant. When you need to think through a problem, analyze complex information, or reason step-by-step, wrap your internal reasoning in <think>...</think> tags. 

Your thinking process inside these tags will not be shown to the user, so you can:
- Break down complex problems
- Analyze information thoroughly 
- Consider multiple approaches
- Work through your reasoning

After your thinking, provide your clear, helpful response outside the think tags."""
    
    system_msg = system_prompt.strip() if system_prompt else default_system
    if estimate_tokens(system_msg, model_type) > system_tokens:
        system_msg = smart_truncate_message(system_msg, system_tokens, model_type)
    prompt_parts.append(f"System: {system_msg}")
    
    # Add conversation history (properly validated)
    if recent:
        context_msgs = build_conversation_context(recent, history_tokens, model_type)
        for msg in context_msgs:
            role = "Human" if msg['role'].lower() == 'user' else "Assistant"
            prompt_parts.append(f"{role}: {msg['content']}")
    
    # Prepare current message with references
    current_content = message.strip()
    if retrieved:
        references = build_references_context(retrieved, reference_tokens, model_type)
        if references:
            ref_context = "\n".join(f"- {ref}" for ref in references)
            current_content = f"Here is some relevant context:\n{ref_context}\n\nUser question: {current_content}"
    
    # Add current message
    prompt_parts.append(f"Human: {current_content}")
    prompt_parts.append("Assistant:")
    
    return "\n".join(prompt_parts)

def build_deepseek_prompt(message: str, recent: list, retrieved: list[str], 
                         system_prompt: str | None = None, model_path: str = "") -> str:
    """Build DeepSeek-specific prompt using the DeepSeek chat format."""
    model_type = 'deepseek'
    context_window = MODEL_CONTEXT_WINDOWS[model_type]
    
    current_msg_tokens = estimate_tokens(message, model_type)
    reserved_tokens = current_msg_tokens + 500
    available_tokens = context_window - reserved_tokens
    
    system_tokens = min(250, available_tokens // 4)
    history_tokens = min(available_tokens // 2, available_tokens - system_tokens - 100)
    reference_tokens = available_tokens - system_tokens - history_tokens
    
    prompt_parts = []
    
    # System message with consistent thinking instructions
    default_system = """You are a helpful, accurate, and thoughtful AI assistant. When you need to think through a problem, analyze complex information, or reason step-by-step, wrap your internal reasoning in <think>...</think> tags. 

Your thinking process inside these tags will not be shown to the user, so you can:
- Break down complex problems
- Analyze information thoroughly 
- Consider multiple approaches
- Work through your reasoning

After your thinking, provide your clear, helpful response outside the think tags."""
    
    system_msg = system_prompt.strip() if system_prompt else default_system
    if estimate_tokens(system_msg, model_type) > system_tokens:
        system_msg = smart_truncate_message(system_msg, system_tokens, model_type)
    prompt_parts.append(f"<|im_start|>system\n{system_msg}<|im_end|>")
    
    # Add conversation history (properly validated)
    if recent:
        context_msgs = build_conversation_context(recent, history_tokens, model_type)
        for msg in context_msgs:
            role = msg['role'].lower()
            if role not in ['user', 'assistant']:
                role = 'user'
            prompt_parts.append(f"<|im_start|>{role}\n{msg['content']}<|im_end|>")
    
    # Prepare current message with references
    current_content = message.strip()
    if retrieved:
        references = build_references_context(retrieved, reference_tokens, model_type)
        if references:
            ref_context = "\n".join(f"- {ref}" for ref in references)
            current_content = f"Here is some relevant context:\n{ref_context}\n\nUser question: {current_content}"
    
    # Add current message (avoiding double user messages)
    prompt_parts.append(f"<|im_start|>user\n{current_content}<|im_end|>")
    prompt_parts.append("<|im_start|>assistant\n")
    
    return "\n".join(prompt_parts)

def build_llama_prompt(message: str, recent: list, retrieved: list[str], 
                      system_prompt: str | None = None, model_path: str = "") -> str:
    """Build Llama-specific prompt using the Llama chat format."""
    model_type = 'llama'
    context_window = MODEL_CONTEXT_WINDOWS[model_type]
    
    current_msg_tokens = estimate_tokens(message, model_type)
    reserved_tokens = current_msg_tokens + 500
    available_tokens = context_window - reserved_tokens
    
    system_tokens = min(250, available_tokens // 4)
    history_tokens = min(available_tokens // 2, available_tokens - system_tokens - 100)
    reference_tokens = available_tokens - system_tokens - history_tokens
    
    prompt_parts = []
    
    # System message with consistent thinking instructions
    default_system = """You are a helpful, accurate, and thoughtful AI assistant. When you need to think through a problem, analyze complex information, or reason step-by-step, wrap your internal reasoning in <think>...</think> tags. 

Your thinking process inside these tags will not be shown to the user, so you can:
- Break down complex problems
- Analyze information thoroughly 
- Consider multiple approaches
- Work through your reasoning

After your thinking, provide your clear, helpful response outside the think tags."""
    
    system_msg = system_prompt.strip() if system_prompt else default_system
    if estimate_tokens(system_msg, model_type) > system_tokens:
        system_msg = smart_truncate_message(system_msg, system_tokens, model_type)
    prompt_parts.append(f"<s>[INST] <<SYS>>\n{system_msg}\n<</SYS>>\n")
    
    # Build conversation
    conversation_parts = []
    
    # Add references first
    if retrieved:
        references = build_references_context(retrieved, reference_tokens, model_type)
        if references:
            ref_text = "Here is some relevant context:\n" + "\n".join(references)
            conversation_parts.append(ref_text)
    
    # Add conversation history
    if recent:
        context_msgs = build_conversation_context(recent, history_tokens, model_type)
        for i, msg in enumerate(context_msgs):
            if msg['role'].lower() == 'user':
                if i == 0 and not conversation_parts:  # First message
                    conversation_parts.append(msg['content'])
                else:
                    conversation_parts.append(f"User: {msg['content']}")
            else:
                conversation_parts.append(f"Assistant: {msg['content']}")
    
    # Add current message
    if conversation_parts and recent:  # If we have history, format as continuation
        conversation_parts.append(f"User: {message.strip()}")
    else:
        conversation_parts.append(message.strip())
    
    # Join conversation and close the instruction
    conversation = "\n\n".join(conversation_parts)
    prompt_parts.append(f"{conversation} [/INST]")
    
    return "".join(prompt_parts)

def build_model_specific_prompt(message: str, recent: list, retrieved: list[str], 
                               system_prompt: str | None = None, model_path: str = "") -> str:
    """Build a model-specific prompt based on the model path."""
    model_type = detect_model_type(model_path)
    
    try:
        if model_type == 'qwen':
            return build_qwen_prompt(message, recent, retrieved, system_prompt, model_path)
        elif model_type == 'phi':
            return build_phi_prompt(message, recent, retrieved, system_prompt, model_path)
        elif model_type == 'deepseek':
            return build_deepseek_prompt(message, recent, retrieved, system_prompt, model_path)
        elif model_type == 'llama':
            return build_llama_prompt(message, recent, retrieved, system_prompt, model_path)
        else:
            return build_prompt(message, recent, retrieved, system_prompt, model_path)
    except Exception as e:
        logger.error(f"Error building {model_type} prompt: {e}")
        # Fallback to generic prompt
        return build_prompt(message, recent, retrieved, system_prompt, model_path)

