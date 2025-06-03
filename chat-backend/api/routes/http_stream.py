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

from api.routes.chat import run_llm_stream, build_prompt, get_recent_messages, get_account, get_chat, store_message

router = APIRouter(prefix="/http", tags=["HTTP Streaming"])
logger = logging.getLogger(__name__)

class StreamRequest(BaseModel):
    message: str
    account_id: str
    conversation_id: str

@router.post("/stream")
async def http_stream_chat(request: StreamRequest):
    """Stream chat response using HTTP streaming - more reliable than WebSockets"""
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
        
        # Store the user message
        store_message(
            request.account_id,
            request.conversation_id,
            request.message,
            "No response"  # Initial empty response that will be updated by streaming
        )
        
        # Build prompt with context
        recent = get_recent_messages(request.conversation_id, as_dict=True)
        prompt = build_prompt(
            message=request.message,
            recent=recent,
            retrieved=[],  # Simplified for now
            system_prompt=account.get("system_prompt")
        )
        
        # Return streaming response
        return StreamingResponse(
            stream_llm_response(
                prompt, 
                request.account_id,
                request.conversation_id,
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
        
        # Store the assistant's response
        # IMPORTANT: For assistant messages, put the content in 'response' field, not 'text'
        # The frontend Messages.tsx component expects assistant message content in msg.response
        store_message(
            account_id,
            conversation_id,
            "",  # text field should be empty for assistant messages
            full_response,  # response field contains the content for assistant messages
            None,  # faiss_id (optional)
            None,  # summary (optional)
            title  # title (optional)
        )
        
    except Exception as e:
        logger.exception(f"Error in stream_llm_response: {e}")
        # Send error event in SSE format
        error_event = json.dumps({
            'type': 'error',
            'data': {'message': str(e)}
        })
        yield f"data: {error_event}\n\n".encode('utf-8')
