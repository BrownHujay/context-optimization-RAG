from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from models import MessageCreate, SearchQuery
from db import (
    store_message, 
    search_messages, 
    get_account, 
    get_chat
)
from api.utils import object_id_to_str

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_message(message: MessageCreate):
    # Validate that both text and response fields are present
    if not message.text or not message.response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both text and response fields must be provided"
        )
    
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
    
    # Log the message data to help with debugging
    print(f"Storing message: account_id={message.account_id}, chat_id={message.chat_id}")
    print(f"Text: {message.text[:50]}... Response: {message.response[:50]}...")
    
    # Store the message
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

# Chat-specific message routes have been moved to chats.py

@router.post("/search", response_model=List[dict])
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
