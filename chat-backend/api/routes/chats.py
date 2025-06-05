from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from models import ChatCreate, ChatUpdateTitle
from db import (
    create_chat,
    get_chat,
    update_chat_title,
    delete_chat,
    get_account,
    get_chat_messages,
    get_recent_messages
)
from api.utils import object_id_to_str

router = APIRouter(prefix="/chats", tags=["chats"])

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
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

@router.get("/{chat_id}", response_model=dict)
def get_chat_by_id(chat_id: str):
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    return object_id_to_str(chat)

# This route has been moved to accounts.py to keep URL structure logical

@router.put("/{chat_id}/title", response_model=dict)
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

@router.delete("/{chat_id}", response_model=dict)
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

@router.get("/{chat_id}/messages", response_model=List[dict])
def get_messages_for_chat(chat_id: str, limit: Optional[int] = None, skip: Optional[int] = 0, bottom_up: bool = False):
    # Verify chat exists
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    # Use the bottom_up parameter to determine sort order
    # When bottom_up is True, we'll get newest messages first (better for UI)
    messages = get_chat_messages(chat_id, limit, skip, bottom_up=bottom_up)
    return object_id_to_str(messages)

@router.get("/{chat_id}/recent-messages", response_model=List[dict])
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
