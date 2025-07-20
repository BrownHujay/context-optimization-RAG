"""
Llama model prompt builder using modern format.
"""
from typing import List
from .base import (
    estimate_tokens, smart_truncate_message,
    build_conversation_context, build_references_context,
    get_system_prompt_for_profile
)

# Context window size for Llama models
LLAMA_CONTEXT_WINDOW = 8192

def build_llama_prompt(message: str, recent: list, retrieved: List[str], 
                      system_prompt: str = None, model_path: str = "") -> str:
    """Build Llama-specific prompt using modern format."""
    model_type = 'llama'
    context_window = LLAMA_CONTEXT_WINDOW
    
    # Calculate token allocation
    current_msg_tokens = estimate_tokens(message, model_type)
    reserved_tokens = current_msg_tokens + 500  # Reserve space for response
    available_tokens = context_window - reserved_tokens
    
    # Allocate tokens for different sections
    system_tokens = min(250, available_tokens // 4)
    history_tokens = min(available_tokens // 2, available_tokens - system_tokens - 100)
    reference_tokens = available_tokens - system_tokens - history_tokens
    
    # Use provided system prompt or default
    # Get model-specific system prompt
    system_msg = get_system_prompt_for_profile(model_path, system_prompt)
    if estimate_tokens(system_msg, model_type) > system_tokens:
        system_msg = smart_truncate_message(system_msg, system_tokens, model_type)
    
    # Start building the modern Llama format string
    prompt_parts = [
        "<|begin_of_text|>",
        f"<|start_header_id|>system<|end_header_id|>\n{system_msg}<|eot_id|>"
    ]
    
    # Add conversation history with proper alternation
    if recent:
        context_msgs = build_conversation_context(recent, history_tokens, model_type)
        for msg in context_msgs:
            role = msg['role']
            content = msg['content']
            prompt_parts.append(f"<|start_header_id|>{role}<|end_header_id|>\n{content}<|eot_id|>")
    
    # Prepare current user message with references if provided
    current_message = message.strip()
    if retrieved:
        references = build_references_context(retrieved, reference_tokens, model_type)
        if references:
            ref_text = "Here is some relevant context:\n" + "\n".join(references)
            current_message = f"{ref_text}\n\n{current_message}"
    
    # Add current user message and start assistant response
    prompt_parts.extend([
        f"<|start_header_id|>user<|end_header_id|>\n{current_message}<|eot_id|>",
        "<|start_header_id|>assistant<|end_header_id|>\n"
    ])
    
    return "".join(prompt_parts)
