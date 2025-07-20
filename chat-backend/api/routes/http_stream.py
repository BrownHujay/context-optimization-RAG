"""
HTTP-based streaming endpoint for reliable streaming without WebSockets
"""
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import logging
from typing import AsyncGenerator, Optional

from api.routes.chat import chat_stream, get_recent_messages, get_account, get_chat
from prompt_builders import build_model_specific_prompt
from llm import get_model_path
from db import update_message  # For updating the original message

router = APIRouter(prefix="/http", tags=["HTTP Streaming"])
logger = logging.getLogger(__name__)

class StreamRequest(BaseModel):
    message: str
    account_id: str
    conversation_id: str
    original_message_id: str  # ID of the message created by POST /messages

@router.post("/stream")
async def http_stream_chat(request: StreamRequest):
    """Stream chat response using HTTP streaming - more reliable than WebSockets"""
    print(f"\n🌊 POST /http/stream called!")
    print(f"Message: '{request.message}'")
    print(f"Account ID: {request.account_id}")
    print(f"Conversation ID: {request.conversation_id}")
    print(f"Original Message ID: '{request.original_message_id}'")
    
    try:
        # Verify account and chat
        account = get_account(request.account_id)
        if not account:
            return Response(
                content=json.dumps({"error": "Invalid account ID"}), 
                status_code=400, 
                media_type="application/json"
            )
            
        chat = get_chat(request.conversation_id)
        if not chat:
            return Response(
                content=json.dumps({"error": "Invalid chat ID"}), 
                status_code=400, 
                media_type="application/json"
            )
        
        # Handle message creation - if original_message_id is a temp ID, we need to create the message first
        real_message_id = request.original_message_id
        if request.original_message_id.startswith('temp-'):
            print(f"⚠️  Frontend sent temp ID, creating message in database first...")
            try:
                from db import store_message
                result = store_message(
                    request.account_id,
                    request.conversation_id,
                    request.message,
                    "",  # Empty response for now
                    None,  # faiss_id
                    None,  # summary  
                    None   # title
                )
                if result and result.inserted_id:
                    real_message_id = str(result.inserted_id)
                    print(f"✅ Created message with real ID: {real_message_id}")
                else:
                    print(f"❌ Failed to create message")
                    # Continue with temp ID, update will handle gracefully
            except Exception as e:
                print(f"❌ Error creating message: {e}")
                # Continue with temp ID, update will handle gracefully
        
        # Build prompt with context
        recent = get_recent_messages(request.conversation_id, as_dict=True)
        model_profile = chat.get("model_profile", "default")
        model_path = get_model_path(model_profile)
        
        # Build model-specific prompt (all models now return strings)
        prompt = build_model_specific_prompt(
            message=request.message,
            recent=recent,
            retrieved=[],  # Simplified for now
            system_prompt=account.get("system_prompt"),
            model_path=model_path
        )
        
        # Return streaming response with the real message ID
        return StreamingResponse(
            stream_llm_response(
                prompt, 
                request.account_id,
                request.conversation_id,
                real_message_id,  # Use real MongoDB ObjectId if we created one
                chat.get("model_profile", "default")
            ),
            media_type="text/event-stream"
        )
    
    except Exception as e:
        logger.exception(f"Error in http_stream_chat: {e}")
        return Response(
            content=json.dumps({"error": str(e)}), 
            status_code=500, 
            media_type="application/json"
        )

async def stream_llm_response(
    prompt: str, 
    account_id: str,
    conversation_id: str,
    original_message_id: str,  # ID of the message to update
    profile: str = "default"
) -> AsyncGenerator[bytes, None]:
    """Stream LLM response chunks"""
    full_response = ""
    
    try:
        # Send start event
        start_event = json.dumps({'type': 'start', 'data': {}})
        yield f"data: {start_event}\n\n".encode('utf-8')
        
        # Stream chunks
        buffer = ""
        buffer_size = 0
        max_buffer_size = 5  # Adjust this value to balance responsiveness vs performance
        chunk_counter = 0
        
        # Get chunks from the async generator
        async for chunk in run_llm_stream(prompt, profile=profile):
            buffer += chunk
            full_response += chunk
            buffer_size += 1
            
            # Only send when buffer reaches threshold or on special characters
            # This reduces HTTP overhead while maintaining responsiveness
            if (buffer_size >= max_buffer_size or 
                '.' in chunk or '\n' in chunk or '?' in chunk or '!' in chunk):
                
                # CRITICAL FIX: Always send chunks as a properly formatted JSON object
                chunk_event = json.dumps({
                    "type": "chunk",
                    "data": {
                        "text": buffer
                    }
                })
                
                yield f"data: {chunk_event}\n\n".encode('utf-8')
                buffer = ""
                buffer_size = 0
                chunk_counter += 1
        
        # Create a summary (simple implementation for now)
        title = None
        try:
            # Extract a title from the conversation if it's new
            if len(full_response) > 10:  # Only generate title if response is substantial
                title = full_response.split('\n')[0][:50]  # First line, max 50 chars
                if len(title) < 10:  # If too short, use more text
                    title = full_response[:50].replace('\n', ' ')
        except Exception as e:
            logger.exception(f"Error creating summary: {e}")
            title = None
            
        # Send summary event if we have a title
        if title:
            summary_event = json.dumps({
                'type': 'summary',
                'data': {'title': title}
            })
            yield f"data: {summary_event}\n\n".encode('utf-8')
        
        # Send complete event
        complete_event = json.dumps({
            'type': 'complete',
            'data': {'text': full_response}
        })
        yield f"data: {complete_event}\n\n".encode('utf-8')
        
        # Update the original message with the assistant's full response and title
        logger.info(f"\n=== ATTEMPTING MESSAGE UPDATE ===")
        logger.info(f"original_message_id: {original_message_id}")
        logger.info(f"full_response length: {len(full_response)}")
        logger.info(f"title: {title}")
        
        if original_message_id:
            update_data = {
                "response": full_response,
                "title": title
            }
            # Filter out None values or empty strings for title to avoid overwriting with empty data
            update_data_cleaned = {k: v for k, v in update_data.items() if v is not None and v != ""}
            
            logger.info(f"Update data to send: {list(update_data_cleaned.keys())}")
            
            if update_data_cleaned:
                try:
                    result = update_message(
                        message_id=original_message_id,
                        **update_data_cleaned
                    )
                    logger.info(f"Update message result: {result}")
                    if result:
                        logger.info(f"✅ Successfully updated message {original_message_id}")
                    else:
                        logger.error(f"❌ Update returned None/False for message {original_message_id}")
                except Exception as e:
                    logger.exception(f"❌ Error updating message {original_message_id}: {e}")
            else:
                logger.warning(f"No valid update data for message {original_message_id}")
        else:
            logger.warning("❌ original_message_id was not provided to stream_llm_response. Cannot update message.")
        
        logger.info(f"=== MESSAGE UPDATE COMPLETE ===")
        
    except Exception as e:
        logger.exception(f"Error in stream_llm_response: {e}")
        # Send error event in SSE format
        error_event = json.dumps({
            'type': 'error',
            'data': {'message': str(e)}
        })
        yield f"data: {error_event}\n\n".encode('utf-8')
