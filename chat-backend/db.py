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
        "summary": summary,
        "faiss_id": faiss_id,
        "conversation_id": conversation_id,
        "timestamp": datetime.now()
    })

def get_recent_messages(conversation_id, limit=5):
    return list(messages_col.find({"conversation_id": conversation_id}).sort("timestamp", -1).limit(limit))

def get_by_ids(ids):
    return list(messages_col.find({"faiss_id": {"$in": ids}}))
