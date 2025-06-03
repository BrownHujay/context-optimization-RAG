# summarizer.py
"""
Summarization utilities for chat history and context management
"""
import time
from typing import List, Dict, Tuple, Optional, Any
from llm import run_llm
from db import store_summary, get_last_summary, update_chat

# Constants for tracking summarization needs
MAX_TOKENS_SINCE_SUMMARY = 8000  # Increased threshold to reduce frequency (was 4000)
TOKEN_ESTIMATION_FACTOR = 4  # Rough estimate: 4 chars ≈ 1 token

# Control whether summaries happen after every message or only when needed
# Set this to False to improve performance
SUMMARIZE_EVERY_MESSAGE = False  # Set to True for real-time summaries, False for better performance

# Configure summarization profiles (optimization for Apple M3)
SUMMARY_PROFILE = "fast"  # Always use the fast model for summarization

# Track token usage since last summary for each conversation
summary_tracker = {}


class SummaryTracker:
    """Tracks token usage and summarization timing for a conversation"""
    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self.tokens_since_summary = 0
        self.last_summary_time = time.time()
        self.messages_since_summary = 0
        
    def add_message(self, message: str, response: str) -> bool:
        """Add message and response tokens, return True if summary needed"""
        # Estimate token count (chars / 4 is a rough approximation)
        msg_tokens = len(message) // TOKEN_ESTIMATION_FACTOR
        resp_tokens = len(response) // TOKEN_ESTIMATION_FACTOR
        
        self.tokens_since_summary += (msg_tokens + resp_tokens)
        self.messages_since_summary += 1
        
        # Check if we should summarize based on configuration
        if SUMMARIZE_EVERY_MESSAGE:
            return True  # Always summarize after each message
        
        # Otherwise only summarize when we exceed the token threshold
        return self.tokens_since_summary >= MAX_TOKENS_SINCE_SUMMARY
    
    def reset(self):
        """Reset counters after summarization"""
        self.tokens_since_summary = 0
        self.last_summary_time = time.time()
        self.messages_since_summary = 0


def get_tracker(conversation_id: str) -> SummaryTracker:
    """Get or create a summary tracker for a conversation"""
    if conversation_id not in summary_tracker:
        summary_tracker[conversation_id] = SummaryTracker(conversation_id)
    return summary_tracker[conversation_id]


def generate_message_summary(messages: List[Dict]) -> Dict:
    """Generate title and bullet summaries for a message"""
    # Generate summaries
    title = summarize_5_word(messages)
    bullets = summarize_3_bullet(messages)
    
    return {
        "title": title,
        "bullets": bullets,
        "timestamp": time.time()
    }


def check_and_summarize(conversation_id: str, account_id: str, messages: List[Dict]) -> Dict:
    """Generate summaries after each message and periodically do a full summary"""
    tracker = get_tracker(conversation_id)
    summary_data = {}
    
    # Only generate summaries if we should, based on the tracker
    if SUMMARIZE_EVERY_MESSAGE or tracker.tokens_since_summary >= MAX_TOKENS_SINCE_SUMMARY:
        # Generate per-message summary with fast model
        title = summarize_5_word(messages)
        bullets = summarize_3_bullet(messages)
        
        summary_data = {
            "title": title,
            "bullets": bullets,
            "timestamp": time.time()
        }
        
        # If we've accumulated enough tokens, also do a full history summary
        if tracker.tokens_since_summary >= MAX_TOKENS_SINCE_SUMMARY:
            history_summary = summarize_history(messages)
            summary_data["text"] = history_summary
            summary_data["messages_count"] = tracker.messages_since_summary
            summary_data["tokens_count"] = tracker.tokens_since_summary
            
            # Save full summary to database
            store_summary(account_id, conversation_id, summary_data)
            
            # Reset the tracker
            tracker.reset()
        
        # Update chat metadata with new title if it doesn't have one
        update_chat(conversation_id, {"title": title}, overwrite_empty=True)
    
    return summary_data


def summarize_history(messages: List[Dict], max_length: int = 1000) -> str:
    """Summarize the chat history into a cohesive narrative"""
    if not messages:
        return ""
    
    # Format messages into a readable format
    formatted_msgs = []
    
    for msg in messages:
        # Handle different message formats (MongoDB documents vs API objects)
        role = msg.get('role', 'user')  # Default to user if no role found
        content = None
        
        # Try different field names for content
        if 'content' in msg:
            content = msg['content']
        elif 'text' in msg:
            content = msg['text']
        elif 'message' in msg:
            content = msg['message']
        
        if content:
            formatted_msgs.append(f"{role}: {content}")
    
    if not formatted_msgs:
        return ""
        
    chat_text = "\n".join(formatted_msgs)
    
    prompt = f"""Summarize the following conversation in a concise paragraph. 
    Focus on the main topics and key information exchanged.
    
    CONVERSATION:
    {chat_text}
    
    SUMMARY:"""
    
    summary = run_llm(prompt, profile="fast")
    return summary


def summarize_5_word(messages: List[Dict]) -> str:
    """Generate a 5-word title for the conversation"""
    if not messages:
        return "New Chat"
    
    # Use first few messages to determine topic
    initial_msgs = messages[:min(5, len(messages))]
    formatted_msgs = []
    
    for msg in initial_msgs:
        # Handle different message formats (MongoDB documents vs API objects)
        role = msg.get('role', 'user')  # Default to user if no role found
        content = None
        
        # Try different field names for content
        if 'content' in msg:
            content = msg['content']
        elif 'text' in msg:
            content = msg['text']
        elif 'message' in msg:
            content = msg['message']
        
        if content:
            formatted_msgs.append(f"{role}: {content}")
    
    if not formatted_msgs:
        return "New Chat"
        
    chat_sample = "\n".join(formatted_msgs)
    
    prompt = f"""Create a 5-word title for this conversation, using active words and key topics:

{chat_sample}

Title: """
    
    try:
        # Use the configured profile for summarization
        response = run_llm(prompt, max_tokens=10, profile=SUMMARY_PROFILE)
        if response:
            # Clean up and return at most 5 words
            title = response.strip().replace('"', '').replace('\'', '')
            words = title.split()
            if len(words) > 5:
                title = ' '.join(words[:5])
            return title
    except Exception as e:
        print(f"Error generating 5-word title: {e}")
    
    # Default fallback
    return "New Chat"


def summarize_3_bullet(messages: List[Dict]) -> List[str]:
    """Summarize the conversation as 3 bullet points"""
    if not messages:
        return ["No messages yet"]
    
    # Format messages
    formatted_msgs = []
    
    for msg in messages:
        # Handle different message formats (MongoDB documents vs API objects)
        role = msg.get('role', 'user')  # Default to user if no role found
        content = None
        
        # Try different field names for content
        if 'content' in msg:
            content = msg['content']
        elif 'text' in msg:
            content = msg['text']
        elif 'message' in msg:
            content = msg['message']
        
        if content:
            formatted_msgs.append(f"{role}: {content}")
    
    if not formatted_msgs:
        return ["No messages yet"]
        
    chat_text = "\n".join(formatted_msgs)
    
    prompt = f"""Extract the 3 most important points from this conversation as short bullet points.
    Each bullet should be a single sentence or phrase.
    
    CONVERSATION:
    {chat_text}
    
    THREE KEY POINTS:"""
    
    response = run_llm(prompt, profile=SUMMARY_PROFILE)
    
    # Parse bullets - handle different formats
    bullets = []
    for line in response.split("\n"):
        line = line.strip()
        if line.startswith("- ") or line.startswith("* "):
            bullets.append(line[2:].strip())
        elif line.startswith("1.") or line.startswith("2.") or line.startswith("3."):
            # Remove the number and dot
            bullets.append(line[line.find(".")+1:].strip())
    
    # Ensure we have exactly 3 bullets
    while len(bullets) < 3:
        bullets.append("Additional information")
    
    return bullets[:3]
