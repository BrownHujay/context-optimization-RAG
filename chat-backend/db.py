#db.py
from pymongo import MongoClient
import os
from datetime import datetime
from bson import ObjectId
from typing import Optional, List

client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client.chatbot_db

# Collections
accounts_col = db.accounts
chats_col = db.chats
messages_col = db.messages

# Account functions
def create_account(username, email, password_hash):
    """Create a new account"""
    return accounts_col.insert_one({
        "username": username,
        "email": email,
        "password_hash": password_hash,
        "created_at": datetime.now(),
        "settings": {
            "theme": "light",
            "notifications": True
        },
        "statistics": {
            "total_messages": 0,
            "total_chats": 0,
            "last_active": datetime.now()
        }
    }).inserted_id

def get_account(account_id):
    """Get account by ID"""
    return accounts_col.find_one({"_id": ObjectId(account_id)})

def get_account_by_email(email):
    """Get account by email"""
    return accounts_col.find_one({"email": email})

def update_account_settings(account_id, settings):
    """Update account settings"""
    return accounts_col.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"settings": settings}}
    )

def update_account_statistics(account_id, statistics):
    """Update account statistics"""
    return accounts_col.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"statistics": statistics}}
    )

# Chat functions
def create_chat(account_id, title="New Chat"):
    """Create a new chat for an account"""
    chat_id = chats_col.insert_one({
        "account_id": ObjectId(account_id),
        "title": title,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }).inserted_id
    
    # Update account statistics
    accounts_col.update_one(
        {"_id": ObjectId(account_id)},
        {"$inc": {"statistics.total_chats": 1}}
    )
    
    return chat_id

def get_chat(chat_id):
    """Get chat by ID"""
    return chats_col.find_one({"_id": ObjectId(chat_id)})

def get_account_chats(account_id):
    """Get all chats for an account"""
    return list(chats_col.find({"account_id": ObjectId(account_id)}).sort("updated_at", -1))

def update_chat_title(chat_id, title):
    """Update chat title"""
    return chats_col.update_one(
        {"_id": ObjectId(chat_id)},
        {"$set": {"title": title, "updated_at": datetime.now()}}
    )

def delete_chat(chat_id):
    """Delete chat and all its messages"""
    chat = get_chat(chat_id)
    if chat:
        # Delete all messages in the chat
        messages_col.delete_many({"chat_id": ObjectId(chat_id)})
        # Delete the chat
        result = chats_col.delete_one({"_id": ObjectId(chat_id)})
        
        # Update account statistics
        if result.deleted_count > 0:
            accounts_col.update_one(
                {"_id": chat["account_id"]},
                {"$inc": {"statistics.total_chats": -1}}
            )
        
        return result
    return None

# Message functions
def store_message(account_id, chat_id, text, response, faiss_id=None, summary=None, title=None):
    """Store a new message in a chat"""
    # Update the chat's updated_at timestamp
    chats_col.update_one(
        {"_id": ObjectId(chat_id)},
        {"$set": {"updated_at": datetime.now()}}
    )
    
    # Update account statistics
    accounts_col.update_one(
        {"_id": ObjectId(account_id)},
        {
            "$inc": {"statistics.total_messages": 1},
            "$set": {"statistics.last_active": datetime.now()}
        }
    )
    
    return messages_col.insert_one({
        "account_id": ObjectId(account_id),
        "chat_id": ObjectId(chat_id),
        "text": text,
        "response": response,
        "summary": summary,  # deepseek/openai llm summary for text based context
        "faiss_id": faiss_id,  # matches with mongo id
        "title": title,
        "timestamp": datetime.now()
    })

def update_message(message_id, response=None, text=None, summary=None, title=None):
    """Update an existing message
    
    Args:
        message_id: The ID of the message to update
        response: New response text (optional)
        text: New user message text (optional)
        summary: New summary (optional)
        title: New title (optional)
        
    Returns:
        The update result from MongoDB
    """
    # Check if this is a temporary ID (should be rare now that streaming endpoint creates real messages)
    if message_id.startswith('temp-'):
        print(f"⚠️ WARNING: Received temporary message ID: {message_id}")
        print(f"This suggests the streaming endpoint failed to create a real message.")
        print(f"Skipping update to avoid errors.")
        return None
    
    # Validate that this looks like a valid ObjectId
    if not message_id or len(message_id) != 24:
        print(f"Invalid message ID format: {message_id}")
        return None
    
    # Build update object with only provided fields
    update_fields = {}
    if response is not None:
        update_fields["response"] = response
    if text is not None:
        update_fields["text"] = text
    if summary is not None:
        update_fields["summary"] = summary
    if title is not None:
        update_fields["title"] = title
        
    # Only update if we have fields to update
    if update_fields:
        update_fields["updated_at"] = datetime.now()
        
        print(f"Updating message {message_id} with fields: {list(update_fields.keys())}")
        try:
            result = messages_col.update_one(
                {"_id": ObjectId(message_id)},
                {"$set": update_fields}
            )
            if result.matched_count == 0:
                print(f"No message found with ID {message_id}")
            else:
                print(f"Successfully updated message {message_id}")
            return result
        except Exception as e:
            print(f"Error updating message {message_id}: {e}")
            return None
    return None

def get_chat_messages(chat_id: str, limit: Optional[int] = None, skip: int = 0, bottom_up: bool = False) -> List[dict]:
    """Get all messages in a chat, sorted chronologically
    
    Args:
        chat_id: The chat ID to get messages for
        limit: Maximum number of messages to return
        skip: Number of messages to skip
        bottom_up: If True, returns messages in descending order (newest first)
        
    Returns:
        List of messages, sorted by timestamp
    """
    query = {"chat_id": ObjectId(chat_id)}
    # Sort order: 1 = ascending (oldest first), -1 = descending (newest first)
    sort_order = -1 if bottom_up else 1
    cursor = messages_col.find(query).sort("timestamp", sort_order).skip(skip)
    
    if limit:
        cursor = cursor.limit(limit)
        
    return list(cursor)

def get_recent_messages(chat_id, limit=5, as_dict=False):
    """Get most recent messages for a chat
    
    Args:
        chat_id: The chat ID to get messages for
        limit: Maximum number of messages to return
        as_dict: If True, return dictionaries instead of MongoDB documents
        
    Returns:
        List of messages, ordered by timestamp (newest first)
    """
    messages = list(messages_col.find({"chat_id": ObjectId(chat_id)}).sort("timestamp", -1).limit(limit))
    
    # Convert to dictionaries if requested
    if as_dict:
        result = []
        for msg in messages:
            msg_dict = {
                "role": "assistant" if "response" in msg else "user",
                "content": msg.get("response", msg.get("text", ""))
            }
            result.append(msg_dict)
        return result
    
    return messages

def get_by_ids(ids):
    """Get messages by their faiss_ids"""
    return list(messages_col.find({"faiss_id": {"$in": ids}}))

def search_messages(account_id, query, limit=10):
    """Search for messages containing the query text within an account"""
    return list(messages_col.find({
        "account_id": ObjectId(account_id),
        "$text": {"$search": query}
    }).limit(limit))

# Ensure text indexes for search functionality
messages_col.create_index([("text", "text"), ("response", "text")])

# Create summary collection
summaries_col = db.summaries

def store_summary(account_id, conversation_id, summary_data):
    """Store a new summary for a conversation"""
    return summaries_col.insert_one({
        "account_id": ObjectId(account_id),
        "conversation_id": ObjectId(conversation_id),
        "text": summary_data.get("text", ""),
        "title": summary_data.get("title", ""),
        "bullets": summary_data.get("bullets", []),
        "messages_count": summary_data.get("messages_count", 0),
        "tokens_count": summary_data.get("tokens_count", 0),
        "timestamp": datetime.now()
    }).inserted_id

def get_last_summary(conversation_id):
    """Get the most recent summary for a conversation"""
    return summaries_col.find_one(
        {"conversation_id": ObjectId(conversation_id)},
        sort=[("timestamp", -1)]
    )

def update_chat(conversation_id, data, overwrite_empty=False):
    """Update chat data with conditional overwrite"""
    update_fields = {}
    
    for key, value in data.items():
        if overwrite_empty:
            # Only update if current field is empty/None
            chat = get_chat(conversation_id)
            if not chat or not chat.get(key):
                update_fields[key] = value
        else:
            # Always update
            update_fields[key] = value
    
    if update_fields:
        return chats_col.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {**update_fields, "updated_at": datetime.now()}}
        )
    return None