from fastapi import FastAPI
from models import ChatRequest
from db import store_message, get_recent_messages, get_by_ids
from embeddings import get_embedding, rerank
from vectorstore import VectorStore
from summarizer import summarize_history
import uuid

app = FastAPI()
vs = VectorStore(dim=768)

@app.post("/chat")
def chat(req: ChatRequest):
    user_embed = get_embedding(req.message)
    faiss_id = int(np.random.randint(1, 2**63 - 1))

    # Add to FAISS
    vs.add(user_embed, req.message, req.conversation_id)

    # Get top FAISS matches
    similar_ids = vs.search(user_embed)
    related_messages = get_by_ids(similar_ids)
    
    # Extract content and rerank
    candidates = [msg["text"] for msg in related_messages]
    reranked = rerank(req.message, candidates)

    # Get recent messages
    recent = get_recent_messages(req.conversation_id)

    # Build prompt for LLM
    prompt = "rebuild for deepseek"

    # Response
    response = "beans"

    #summarization
    #build this here pls :)

    #title
    #build this here pls :)

    store_message(req.message, response, faiss_id, req.conversation_id, summary, title)

    return {"response": response}

@app.get("/graph")
def graph():
    return flatten_faiss_vectors()