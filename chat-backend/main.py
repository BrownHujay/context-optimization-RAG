from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from models import (
    AccountCreate, AccountResponse, AccountUpdateSettings, AccountUpdateStatistics,
    ChatCreate, ChatResponse, ChatUpdateTitle,
    MessageCreate, MessageResponse, ChatRequest, SearchQuery
)
from db import (
    # Account functions
    create_account, get_account, get_account_by_email, update_account_settings, update_account_statistics,
    # Chat functions
    create_chat, get_chat, get_account_chats, update_chat_title, delete_chat,
    # Message functions
    store_message, get_chat_messages, get_recent_messages, get_by_ids, search_messages
)
from embeddings import get_embedding, rerank
from vectorstore import VectorStore
from summarizer import summarize_history
import uuid
import numpy as np
from graph import flatten_faiss_vectors
from bson import ObjectId
from typing import List, Optional

# Initialize the FastAPI app
app = FastAPI(
    title="Chat Application API",
    description="API for a chat application with MongoDB backend",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the vector store
vs = VectorStore(dim=768)

# Helper functions
def object_id_to_str(obj):
    """Convert MongoDB ObjectId to string in response objects"""
    if obj is None:
        return None
    
    if isinstance(obj, list):
        return [object_id_to_str(item) for item in obj]
    
    if isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            if key == "_id":
                result["id"] = str(value)
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, (dict, list)):
                result[key] = object_id_to_str(value)
            else:
                result[key] = value
        return result
    
    return obj

# Account Routes
@app.post("/accounts", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_new_account(account: AccountCreate):
    # Check if account with email already exists
    existing = get_account_by_email(account.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )
    
    # In a real application, hash the password here
    # For now, use a placeholder
    password_hash = account.password  # TODO: Replace with proper hashing
    
    account_id = create_account(account.username, account.email, password_hash)
    return {"id": str(account_id), "message": "Account created successfully"}

@app.get("/accounts/{account_id}", response_model=dict)
def get_account_by_id(account_id: str):
    account = get_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    return object_id_to_str(account)

@app.put("/accounts/{account_id}/settings", response_model=dict)
def update_settings(account_id: str, settings_update: AccountUpdateSettings):
    account = get_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    result = update_account_settings(account_id, settings_update.settings.dict())
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settings update failed"
        )
    
    return {"message": "Settings updated successfully"}

@app.put("/accounts/{account_id}/statistics", response_model=dict)
def update_statistics(account_id: str, statistics_update: AccountUpdateStatistics):
    account = get_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    result = update_account_statistics(account_id, statistics_update.statistics.dict())
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Statistics update failed"
        )
    
    return {"message": "Statistics updated successfully"}

# Chat Routes
@app.post("/chats", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_new_chat(chat: ChatCreate):
    # Verify account exists
    account = get_account(chat.account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    chat_id = create_chat(chat.account_id, chat.title)
    return {"id": str(chat_id), "message": "Chat created successfully"}

@app.get("/chats/{chat_id}", response_model=dict)
def get_chat_by_id(chat_id: str):
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    return object_id_to_str(chat)

@app.get("/accounts/{account_id}/chats", response_model=List[dict])
def get_chats_for_account(account_id: str):
    # Verify account exists
    account = get_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    chats = get_account_chats(account_id)
    return object_id_to_str(chats)

@app.put("/chats/{chat_id}/title", response_model=dict)
def update_chat_title_route(chat_id: str, title_update: ChatUpdateTitle):
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    result = update_chat_title(chat_id, title_update.title)
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title update failed"
        )
    
    return {"message": "Chat title updated successfully"}

@app.delete("/chats/{chat_id}", response_model=dict)
def delete_chat_by_id(chat_id: str):
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    result = delete_chat(chat_id)
    if not result or result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat deletion failed"
        )
    
    return {"message": "Chat deleted successfully"}

# Message Routes
@app.post("/messages", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_message(message: MessageCreate):
    # Verify account exists
    account = get_account(message.account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Verify chat exists
    chat = get_chat(message.chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    result = store_message(
        message.account_id,
        message.chat_id,
        message.text,
        message.response,
        message.faiss_id,
        message.summary,
        message.title
    )
    
    return {"id": str(result.inserted_id), "message": "Message stored successfully"}

@app.get("/chats/{chat_id}/messages", response_model=List[dict])
def get_messages_for_chat(chat_id: str, limit: Optional[int] = None, skip: Optional[int] = 0):
    # Verify chat exists
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    messages = get_chat_messages(chat_id, limit, skip)
    return object_id_to_str(messages)

@app.get("/chats/{chat_id}/recent-messages", response_model=List[dict])
def get_recent_chat_messages(chat_id: str, limit: Optional[int] = 5):
    # Verify chat exists
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    messages = get_recent_messages(chat_id, limit)
    return object_id_to_str(messages)

@app.post("/messages/search", response_model=List[dict])
def search_account_messages(search: SearchQuery):
    # Verify account exists
    account = get_account(search.account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    results = search_messages(search.account_id, search.query, search.limit)
    return object_id_to_str(results)

@app.post("/chat")
def chat(req: ChatRequest):
    # Verify account exists
    account = get_account(req.account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Verify chat exists
    chat = get_chat(req.conversation_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    user_embed = get_embedding(req.message)
    faiss_id = int(np.random.randint(1, 2**63 - 1))

    # Add to FAISS
    vs.add(user_embed, req.message, req.conversation_id)

    # Get top FAISS matches
    similar_ids = vs.search(user_embed)
    related_messages = get_by_ids(similar_ids)
    
    # Extract content and rerank
    candidates = [msg["text"] for msg in related_messages] if related_messages else []
    reranked = rerank(req.message, candidates) if candidates else []

    # Get recent messages
    recent = get_recent_messages(req.conversation_id)

    # Build prompt for LLM
    prompt = "rebuild for deepseek"

    # Response
    response = "beans" 

    # Summarization - placeholder
    summary = None 

    # Title - placeholder
    title = None 

    # Store the message
    store_message(req.account_id, req.conversation_id, req.message, response, faiss_id, summary, title)

    return {"response": response}

@app.get("/graph")
def graph():
    return flatten_faiss_vectors()

# Development notes:
# - Setup prompt engineering for more intelligent responses
# - Implement history traversal: find messages before/after current context
# - Add deep search capability for related content
# - Enable graph-based prompt exploration
# - Expose bot's thinking process to the user

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)