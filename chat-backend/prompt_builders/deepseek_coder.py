"""
DeepSeek Coder model prompt builder using <|user|> and <|assistant|> format.
"""
from typing import List
from .base import (
    estimate_tokens, smart_truncate_message,
    build_conversation_context, build_references_context,
    get_system_prompt_for_profile
)

# Context window size for DeepSeek Coder models
DEEPSEEK_CODER_CONTEXT_WINDOW = 4096

def build_deepseek_coder_prompt(message: str, recent: list, retrieved: List[str], 
                               system_prompt: str = None, model_path: str = "") -> str:
    """Build DeepSeek Coder-specific prompt using <|user|> and <|assistant|> format."""
    model_type = 'deepseek-coder'
    context_window = DEEPSEEK_CODER_CONTEXT_WINDOW
    
    # Reserve tokens for the response
    reserved_tokens = 512
    available_tokens = context_window - reserved_tokens
    
    # Allocate tokens between system, history, and references
    system_tokens = min(1024, available_tokens // 4)  # Up to 1024 tokens for system
    history_tokens = min(available_tokens // 2, available_tokens - system_tokens - 100)
    reference_tokens = available_tokens - system_tokens - history_tokens
    
    # Get model-specific system prompt
    system_msg = get_system_prompt_for_profile(model_path, system_prompt)
    if estimate_tokens(system_msg, model_type) > system_tokens:
        system_msg = smart_truncate_message(system_msg, system_tokens, model_type)
    
    # Start building the DeepSeek Coder format string
    prompt_parts = []
    
    # Add system prompt as initial user-assistant exchange
    if system_msg.strip():
        prompt_parts.append(f"<|user|>\nSystem instructions: {system_msg}<|assistant|>\nUnderstood. I'll follow these instructions.")
    
    # Add conversation history with proper alternation
    if recent:
        context_msgs = build_conversation_context(recent, history_tokens, model_type)
        for msg in context_msgs:
            role = msg['role']
            content = msg['content']
            if role == 'user':
                prompt_parts.append(f"<|user|>\n{content}")
            elif role == 'assistant':
                prompt_parts.append(f"<|assistant|>\n{content}")
    
    # after your refs calculation
    if retrieved:
        refs_list = build_references_context(retrieved, reference_tokens, model_type)
        if refs_list:
            refs_text = "\n".join(f"- {r}" for r in refs_list)
            prompt_parts.append(f"<|user|>\nRelevant context:\n{refs_text}")
            prompt_parts.append("<|assistant|>\nI'll use this context to help.")
    
    # Prepare current user message
    if message.strip():
        prompt_parts.append(f"<|user|>\n{message.strip()}")
    
    # End with assistant tag to prompt response
    prompt_parts.append("\n<|assistant|>")
    
    return "\n".join(prompt_parts)
