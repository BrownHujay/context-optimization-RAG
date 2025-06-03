from fastapi import APIRouter, HTTPException, status
from typing import List
from models import AccountCreate, AccountUpdateSettings, AccountUpdateStatistics
from db import (
    create_account, 
    get_account, 
    get_account_by_email, 
    update_account_settings, 
    update_account_statistics, 
    get_account_chats
)
from api.utils import object_id_to_str

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_new_account(account: AccountCreate):
    # Check if account with email already exists
    existing = get_account_by_email(account.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )
    
    # In a real application, you would hash the password here
    # For now, we'll use a placeholder
    password_hash = account.password  # TODO: Replace with proper hashing
    
    account_id = create_account(account.username, account.email, password_hash)
    return {"id": str(account_id), "message": "Account created successfully"}

@router.get("/{account_id}", response_model=dict)
def get_account_by_id(account_id: str):
    account = get_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    return object_id_to_str(account)

@router.put("/{account_id}/settings", response_model=dict)
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

@router.put("/{account_id}/statistics", response_model=dict)
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

@router.get("/{account_id}/chats", response_model=List[dict])
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
