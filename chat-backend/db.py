#db.py
from pymongo import MongoClient
import os
from datetime import datetime
from bson import ObjectId

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

def get_chat_messages(chat_id, limit=None, skip=0):
    """Get all messages in a chat, sorted chronologically"""
    query = {"chat_id": ObjectId(chat_id)}
    cursor = messages_col.find(query).sort("timestamp", 1).skip(skip)
    
    if limit:
        cursor = cursor.limit(limit)
        
    return list(cursor)

def get_recent_messages(chat_id, limit=5):
    """Get most recent messages for a chat"""
    return list(messages_col.find({"chat_id": ObjectId(chat_id)}).sort("timestamp", -1).limit(limit))

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