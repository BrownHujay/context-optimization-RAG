#db.py
from pymongo import MongoClient
import os
from datetime import datetime

client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client.chatbot_db
messages_col = db.messages

def store_message(text, response, faiss_id, conversation_id, summary=None):
    return messages_col.insert_one({
        "text": text,
        "response": response,
        "summary": summary, # deepseek/openai llm summary for text based context
        "faiss_id": faiss_id, # matches with mongo id
        "conversation_id": conversation_id, # for FAISS single chat search 
        "timestamp": datetime.now()
    })

def get_recent_messages(conversation_id, limit=5):
    return list(messages_col.find({"conversation_id": conversation_id}).sort("timestamp", -1).limit(limit)) #get recent messages for 1:1 context

def get_by_ids(ids):
    return list(messages_col.find({"faiss_id": {"$in": ids}})) #get desired chat message after sorting
