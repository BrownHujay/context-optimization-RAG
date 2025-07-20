from fastapi import APIRouter, HTTPException, status, Body
from typing import List, Optional, Dict, Any
from models import MessageCreate, SearchQuery
from db import (
    store_message,
    update_message,
    search_messages, 
    get_account, 
    get_chat
)
from api.utils import object_id_to_str

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_message(message: MessageCreate):
    print(f"\n🚀 POST /messages called!")
    print(f"Message data: account_id={message.account_id}, chat_id={message.chat_id}")
    print(f"Text: '{message.text}'")
    print(f"Response: '{message.response}'")
    
    # Validate that text field is present (response is optional for streaming)
    if not message.text:
        print(f"❌ Validation failed: No text provided")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text field must be provided"
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
    print(f"Text: {message.text[:50]}...")
    if message.response:
        print(f"Response: {message.response[:50]}...")
    else:
        print("Response: [None - will be updated via streaming]")
    
    # Store the message (response can be None for streaming scenarios)
    print(f"📝 Calling store_message...")
    result = store_message(
        message.account_id,
        message.chat_id,
        message.text,
        message.response or "",  # Use empty string if no response provided
        message.faiss_id,
        message.summary,
        message.title
    )
    
    if result and result.inserted_id:
        new_id = str(result.inserted_id)
        print(f"✅ Message created successfully with ID: {new_id}")
        return {"id": new_id, "message": "Message stored successfully"}
    else:
        print(f"❌ Failed to create message - result: {result}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create message"
        )

# Update an existing message
@router.put("/{message_id}", response_model=dict)
def update_existing_message(message_id: str, updates: Dict[str, Any] = Body(...)):
    """Update an existing message with new data"""
    print(f"Received update request for message {message_id} with data: {updates}")
    
    # Validate required fields - at least one update field must be provided
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update fields provided"
        )
    
    # Extract update fields
    response = updates.get("response")
    text = updates.get("text")
    summary = updates.get("summary")
    title = updates.get("title")
    
    # Update the message
    result = update_message(
        message_id,
        response=response,
        text=text,
        summary=summary,
        title=title
    )
    
    if not result or result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Message with ID {message_id} not found"
        )
    
    return {
        "id": message_id,
        "message": "Message updated successfully",
        "modified_count": result.modified_count
    }

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
