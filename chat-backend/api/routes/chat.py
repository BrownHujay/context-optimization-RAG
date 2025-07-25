print("hi")
from typing import Dict, AsyncGenerator, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, BackgroundTasks, Body
from fastapi.responses import StreamingResponse, JSONResponse
from models import ChatRequest
print("hello")
from db import (
    store_message, get_recent_messages, get_by_ids,
    get_account, get_chat, update_message  # Added update_message
)
print("beans")
#from embeddings import get_embedding, rerank, trim_relevant_rags
print("hi again")
from vectorstore import VectorStore
from summarizer import summarize_history, summarize_5_word, summarize_3_bullet
from llm import run_llm, chat_stream, get_model_path, get_model_type, MODEL_CONFIGS, get_model
from auth import verify_api_key
from prompt_builders import build_model_specific_prompt
import numpy as np
import uuid
import logging
import json
import asyncio
print("these worked")


logger = logging.getLogger("chat")
logger.setLevel(logging.INFO)

router = APIRouter(prefix="/chat", tags=["chat"])
vs = VectorStore(dim=768)


def chat_logic(req: ChatRequest):
    """Original chat logic for HTTP endpoint"""
    # Verify account and chat
    logger.info("Verifying account and chat")
    account = get_account(req.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    chat = get_chat(req.conversation_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    reranked = ""


    # Get recent messages
    logger.info("Getting recent messages")
    recent = get_recent_messages(req.conversation_id)

    # Use model from request or default
    model_profile = req.model or "default"
    
    # Build prompt
    logger.info("Building prompt")
    model_path = get_model_path(model_profile)
    model_type = get_model_type(model_profile)
    
    # Build model-specific prompt (all models now return strings)
    prompt = build_model_specific_prompt(
        message=req.message,
        recent=recent,
        retrieved=reranked,
        system_prompt=account.get("system_prompt"),
        model_path=model_path
    )

    # Generate response (non-streamed fallback)
    logger.info("Generating response")
    response = run_llm(prompt, profile=model_profile)

    # Generate summary for this message
    logger.info("Generating summary")
    from summarizer import get_tracker, check_and_summarize, summarize_5_word, summarize_3_bullet
    
    # Get recent messages including the current one for summarization
    recent_msgs = get_recent_messages(req.conversation_id, limit=50, as_dict=True)
    recent_msgs.insert(0, {"role": "user", "content": req.message})
    recent_msgs.insert(0, {"role": "assistant", "content": response})
    
    # Generate title and bullet summaries
    logger.info("Generating title and bullet summaries")
    title = summarize_5_word(recent_msgs)
    bullets = summarize_3_bullet(recent_msgs)
    
    # Store or update the message with title and bullet summaries
    if req.original_message_id:
        logger.info(f"Updating message {req.original_message_id} in chat_logic")
        update_data = {
            "response": response,
            "text": req.message, # Ensure user message is also present/updated
            "faiss_id": 0,
            "summary": bullets,
            "title": title
        }
        update_data_cleaned = {k: v for k, v in update_data.items() if v is not None}
        if update_data_cleaned:
            update_message(message_id=req.original_message_id, **update_data_cleaned)
    else:
        logger.info("Storing new message in chat_logic")
        store_message(
            req.account_id, req.conversation_id, req.message,
            response, 0, bullets, title
        )
    
    # Track token usage and check if full summary needed
    tracker = get_tracker(req.conversation_id)
    tracker.add_message(req.message, response)
    
    # Check if we need a full history summary
    if tracker.tokens_since_summary >= 4000:
        summary_data = check_and_summarize(req.conversation_id, req.account_id, recent_msgs)
        result = {"response": response, "prompt": prompt, "summary": summary_data}
    else:
        result = {
            "response": response, 
            "prompt": prompt,
            "summary": {"title": title, "bullets": bullets}
        }
        
    return result


# HTTP Routes (keep for backwards compatibility)
@router.post("", dependencies=[Depends(verify_api_key)])
def chat_route(req: ChatRequest):
    """HTTP endpoint for non-streaming chat"""
    return chat_logic(req)


@router.post("/stream")
async def stream_chat(req: ChatRequest):
    """Stream chat response using HTTP streaming"""
    try:
        # Verify account and chat
        account = get_account(req.account_id)
        if not account:
            return JSONResponse(
                content={"error": "Invalid account ID"}, 
                status_code=400
            )
            
        chat = get_chat(req.conversation_id)
        if not chat:
            return JSONResponse(
                content={"error": "Invalid chat ID"}, 
                status_code=400
            )
        # Build prompt with context
        recent = get_recent_messages(req.conversation_id, as_dict=True)
        model_profile = req.model or "default"
        model_path = get_model_path(model_profile)
        model_type = get_model_type(model_profile)
        
        prompt = build_model_specific_prompt(
            message=req.message,
            recent=recent,
            retrieved=[],
            system_prompt=account.get("system_prompt"),
            model_path=model_path
        )

        # Define the generator separately for better debugging/logging
        gen = stream_chat_response(
            req.account_id,
            req.conversation_id,
            req.message,  # Pass the user message
            req.original_message_id, # Pass the original message ID
            prompt,
            model_profile,
            0,
            ""
        )

        # Debug check: log the type to be sure it's an async generator
        import inspect
        print("✅ Is async generator:", inspect.isasyncgen(gen))  # should print True

        # Return the streaming response
        return StreamingResponse(gen, media_type="text/event-stream")
    
    except Exception as e:
        logger.exception(f"Error in stream_chat: {e}")
        return JSONResponse(
            content={"error": str(e)}, 
            status_code=500
        )


async def stream_chat_response(
    account_id: str,
    conversation_id: str,
    user_message: str, # Added user_message
    original_message_id: Optional[str], # Added original_message_id
    prompt: str,
    profile: str = "default",
    faiss_id: Optional[int] = None,
    retrieved_context: Optional[list] = None
) -> AsyncGenerator[str, None]:
    """Stream LLM response chunks using server-sent events"""
    full_response = ""
    
    try:
        # Send initial event with metadata
        event_data = json.dumps({
            "type": "start",
            "data": {
                "conversation_id": conversation_id,
                "timestamp": str(uuid.uuid4())
            }
        })
        yield f"data: {event_data}\n\n".encode("utf-8")
        
        # Stream chunks
        async for chunk in chat_stream(prompt, profile=profile):
            # Convert chunk to string
            chunk_str = str(chunk) if chunk is not None else ""
            full_response += chunk_str
            
            # Send the chunk as an event
            event_data = json.dumps({
                "type": "chunk",
                "data": {"chunk": chunk_str}
            })
            yield f"data: {event_data}\n\n".encode("utf-8")
            
            # Small delay to prevent overwhelming the client
            await asyncio.sleep(0.01)
        
        # Process summarization and storage after completion
        try:
            from summarizer import get_tracker, check_and_summarize, summarize_5_word, summarize_3_bullet
            
            # Generate summaries
            recent_msgs = get_recent_messages(conversation_id, limit=50, as_dict=True)
            recent_msgs.insert(0, {"role": "user", "content": user_message})
            recent_msgs.insert(0, {"role": "assistant", "content": full_response})
            
            title = summarize_5_word(recent_msgs)
            bullets = summarize_3_bullet(recent_msgs)
            
            # Store or update message
            if original_message_id:
                logger.info(f"Updating message {original_message_id} in stream_chat_response")
                update_data = {
                    "response": full_response,
                    "summary": bullets,
                    "title": title,
                    "faiss_id": faiss_id
                }
                # Filter out None values to avoid overwriting existing fields with None
                update_data_cleaned = {k: v for k, v in update_data.items() if v is not None}
                if update_data_cleaned:
                    try:
                        update_message(message_id=original_message_id, **update_data_cleaned)
                    except Exception as e:
                        logger.exception(f"Error updating message {original_message_id} in stream_chat_response: {e}")
            else:
                # This case should ideally not happen if client follows protocol (POST /messages first)
                logger.warning("original_message_id not provided to stream_chat_response. Storing as new message (potential duplicate).")
                store_message(
                    account_id, conversation_id, user_message,
                    full_response, faiss_id, bullets, title
                )

            logger.info("Stream finished")
            
            # Update tracker
            tracker = get_tracker(conversation_id)
            tracker.add_message(user_message, full_response)
            
            # Send summary generated event
            summary_event = json.dumps({
                "type": "summary",
                "data": {
                    "title": title,
                    "bullets": bullets
                }
            })
            yield f"data: {summary_event}\n\n".encode("utf-8")
            
            # Check if we need a full history summary
            if tracker.tokens_since_summary >= 8000:
                full_summary = check_and_summarize(conversation_id, account_id, recent_msgs)
                history_event = json.dumps({
                    "type": "history_summary",
                    "data": full_summary
                })
                yield f"data: {history_event}\n\n".encode("utf-8")
                
        except Exception as e:
            logger.exception(f"Error in summarization: {e}")
        
        # Send completion event
        complete_event = json.dumps({
            "type": "complete",
            "data": {
                "full_response": full_response
            }
        })
        yield f"data: {complete_event}\n\n".encode("utf-8")
        
    except Exception as e:
        logger.exception(f"Error in stream_chat_response: {e}")
        error_event = json.dumps({
            "type": "error",
            "data": {"message": str(e)}
        })
        yield f"data: {error_event}\n\n".encode("utf-8")


@router.get("/models")
def get_available_models():
    """Get list of available models with their metadata"""
    models = []
    for profile, config in MODEL_CONFIGS.items():
        models.append({
            "id": profile,
            "name": profile.replace("-", " ").title(),
            "description": f"{config['model_type'].title()} - {config['max_tokens']} tokens",
            "max_tokens": config["max_tokens"],
            "context_length": config["n_ctx"],
            "model_type": config["model_type"]
        })
    return {"models": models}

@router.post("/models/{model_id}/preload")
def preload_model(model_id: str):
    """Preload a specific model"""
    if model_id not in MODEL_CONFIGS:
        raise HTTPException(status_code=404, detail="Model not found")
    
    try:
        model = get_model(model_id)
        if model is None:
            raise HTTPException(status_code=500, detail="Failed to load model")
        return {"message": f"Model '{model_id}' preloaded successfully"}
    except Exception as e:
        logger.error(f"Error preloading model {model_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to preload model: {str(e)}")

@router.post("/rag/trim")
def trim_rag(query: str = Body(...), chunks: list[str] = Body(...), sim_threshold: float = Body(0.5), rag_auto_trim: bool = Body(True)):
    """Trim RAG chunks based on relevance"""
    return {"useful_chunks": chunks}

