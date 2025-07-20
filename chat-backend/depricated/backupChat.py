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
from embeddings import get_embedding, rerank, trim_relevant_rags
print("hi again")
from vectorstore import VectorStore
from summarizer import summarize_history, summarize_5_word, summarize_3_bullet
from llm import run_llm, run_llm_stream
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


def chat_logic(req: ChatRequest, model_profile: str = "default"):
    """Original chat logic for HTTP endpoint"""
    # Verify account and chat
    logger.info("Verifying account and chat")
    account = get_account(req.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    chat = get_chat(req.conversation_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Embed and store message
    logger.info("Embedding message")
    user_embed = get_embedding(req.message)
    faiss_id = int(np.random.randint(1, 2**63 - 1))
    vs.add(user_embed, req.message, req.conversation_id)

    # Retrieval + reranking
    logger.info("Retrieving similar messages")
    similar_ids = vs.search(user_embed)
    related_messages = get_by_ids(similar_ids)
    candidates = [msg["text"] for msg in related_messages] if related_messages else []
    
    # Apply initial reranking
    logger.info("Applying reranking")
    reranked = rerank(req.message, candidates) if candidates else []
    
    # Auto-trim RAGs if the setting is enabled in account settings
    logger.info("Auto-trimming RAGs")
    rag_auto_trim = account.get("settings", {}).get("rag_auto_trim", True)
    if rag_auto_trim and reranked:
        sim_threshold = account.get("settings", {}).get("rag_sim_threshold", 0.5)
        reranked = trim_relevant_rags(req.message, reranked, sim_threshold)

    # Get recent messages
    logger.info("Getting recent messages")
    recent = get_recent_messages(req.conversation_id)

    # Build prompt
    logger.info("Building prompt")
    prompt = build_deepseek_prompt(
        message=req.message,
        recent=recent,
        retrieved=reranked,
        system_prompt=account.get("system_prompt")
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
            "faiss_id": faiss_id,
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
            response, faiss_id, bullets, title
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
    logger.info("Chat route called")
    return chat_logic(req, model_profile="default")


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
            
        # Store the user message (initial part)
        user_embed = get_embedding(req.message)
        faiss_id = int(np.random.randint(1, 2**63 - 1))
        vs.add(user_embed, req.message, req.conversation_id)
        
        # Retrieval + reranking
        vector_search_results = vs.search(user_embed)
        candidates = []
        candidate_embeddings = []

        if isinstance(vector_search_results, list):
            for item in vector_search_results:
                if isinstance(item, dict):
                    text = item.get("message") or item.get("text") or item.get("content")
                    if text and isinstance(text, str):
                        candidates.append(text)
                        try:
                            if isinstance(item.get("embedding"), list):
                                embedding = np.array(item["embedding"])
                            else:
                                embedding = get_embedding(text)
                            candidate_embeddings.append(embedding)
                        except Exception:
                            continue

        similarity_threshold = account.get("settings", {}).get("rag_sim_threshold", 0.65)
        
        if candidates:
            if len(candidate_embeddings) == len(candidates):
                reranked = rerank(
                    req.message, candidates, candidate_embeddings,
                    top_k=5, similarity_threshold=similarity_threshold
                )
            else:
                reranked = rerank(
                    req.message, candidates,
                    top_k=5, similarity_threshold=similarity_threshold
                )
        else:
            reranked = []

        # Optional trimming
        rag_auto_trim = account.get("settings", {}).get("rag_auto_trim", True)
        if rag_auto_trim and isinstance(reranked, list) and reranked:
            try:
                sim_threshold = account.get("settings", {}).get("rag_sim_threshold", 0.5)
                reranked = trim_relevant_rags(req.message, reranked, sim_threshold)
            except Exception as e:
                logger.warning(f"Failed to trim relevant RAGs: {e}")
                pass

        # Build prompt with context
        recent = get_recent_messages(req.conversation_id, as_dict=True)
        from llm import get_model_path
        model_path = get_model_path("default")
        prompt = build_model_specific_prompt(
            message=req.message,
            recent=recent,
            retrieved=reranked,
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
            chat.get("model_profile", "default"),
            faiss_id,
            reranked
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
        async for chunk in run_llm_stream(prompt, profile=profile):
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


@router.post("/rag/trim")
def trim_rag(query: str = Body(...), chunks: list[str] = Body(...), sim_threshold: float = Body(0.5), rag_auto_trim: bool = Body(True)):
    """Trim RAG chunks based on relevance"""
    if rag_auto_trim:
        useful = trim_relevant_rags(query, chunks, sim_threshold)
        return {"useful_chunks": useful}
    else:
        return {"useful_chunks": chunks}

