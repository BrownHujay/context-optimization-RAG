def build_prompt(message: str, recent: list, retrieved: list[str], system_prompt: str | None = None) -> str:
    prompt_parts = []
    
    # Add system prompt with reasonable length limit
    if system_prompt:
        compact_system = system_prompt.strip()
        # Use full system prompt but cap at 250 chars if it's too long
        if len(compact_system) > 250:
            compact_system = compact_system[:247] + "..."
        prompt_parts.append(f"[System]: {compact_system}")
    else:
        prompt_parts.append("[System]: You are a helpful AI assistant. Provide accurate, concise responses.")
    
    # Add recent messages with appropriate formatting
    if recent and isinstance(recent, list):
        # Limit to last 5 messages to balance context and token usage
        limited_recent = recent[-5:] if len(recent) > 5 else recent
        
        for msg in limited_recent:
            if isinstance(msg, dict):
                # Get role and content
                role = msg.get('role', 'user')
                role_label = "[User]" if role.lower() == 'user' else "[Assistant]"
                
                # Try different content field names
                content = None
                for field in ['content', 'text', 'response', 'message']:
                    if field in msg and msg[field]:
                        content = msg[field]
                        break
                
                if content:
                    # Truncate very long messages to reasonable length
                    if len(content) > 250:
                        content = content[:247] + "..."
                    prompt_parts.append(f"{role_label}: {content}")
            elif isinstance(msg, str):
                # Handle string messages
                content = msg.strip()
                if len(content) > 250:
                    content = content[:247] + "..."
                prompt_parts.append(f"[User]: {content}")
    
    # Add retrieved knowledge (up to 2 most relevant pieces)
    if retrieved and isinstance(retrieved, list) and len(retrieved) > 0:
        # Use up to 2 most relevant pieces for better context
        for i, info in enumerate(retrieved[:2]):
            if not info or not isinstance(info, str):
                continue
                
            relevant_info = info.strip()
            # Limit length for each piece of knowledge
            if len(relevant_info) > 200:
                relevant_info = relevant_info[:197] + "..."
            prompt_parts.append(f"[Reference]: {relevant_info}")
    
    # Add the user message (full message, not truncated)
    prompt_parts.append(f"[User]: {message.strip()}")
    
    # Add assistant prompt
    prompt_parts.append("[Assistant]:")
    
    # Join all parts with newlines
    return "\n".join(prompt_parts)
