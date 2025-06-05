from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# Account models
class AccountCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class AccountSettings(BaseModel):
    theme: str = "light"
    notifications: bool = True

class AccountStatistics(BaseModel):
    total_messages: int = 0
    total_chats: int = 0
    last_active: Optional[datetime] = None

class AccountResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime
    settings: AccountSettings
    statistics: AccountStatistics

class AccountUpdateSettings(BaseModel):
    settings: AccountSettings

class AccountUpdateStatistics(BaseModel):
    statistics: AccountStatistics

# Chat models
class ChatCreate(BaseModel):
    account_id: str
    title: str = "New Chat"

class ChatResponse(BaseModel):
    id: str
    account_id: str
    title: str
    created_at: datetime
    updated_at: datetime

class ChatUpdateTitle(BaseModel):
    title: str

# Message models
class MessageCreate(BaseModel):
    account_id: str
    chat_id: str
    text: str
    response: str
    faiss_id: Optional[int] = None
    summary: Optional[str] = None
    title: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    account_id: str
    chat_id: str
    text: str
    response: str
    faiss_id: Optional[int] = None
    summary: Optional[str] = None
    title: Optional[str] = None
    timestamp: datetime

from typing import Optional

class ChatRequest(BaseModel):
    message: str
    conversation_id: str
    account_id: str
    original_message_id: Optional[str] = None  # ID of the message if already created

class SearchQuery(BaseModel):
    account_id: str
    query: str
    limit: int = 10
