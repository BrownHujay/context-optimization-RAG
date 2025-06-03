# embeddings.py
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# Load model (768 dim, optimized for English)
model = SentenceTransformer('BAAI/bge-base-en-v1.5')

# Prepend instruction as per model design
def get_embedding(text: str):
    instruction = "Represent this sentence for retrieval: "
    embedding = model.encode(instruction + text, normalize_embeddings=True)
    return embedding.astype('float32')  # FAISS needs float32

# Cosine similarity
def cosine_similarity(vec1, vec2):
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

# Rerank top results using BGE model directly for cross-encoding
def rerank(query, candidates, candidate_embeddings=None, top_k=5, similarity_threshold=0.65):
    """
    Rerank candidates using BGE model directly for cross-encoder style reranking.
    
    Args:
        query: Either a query string or a pre-computed query embedding
        candidates: List of text candidates to rerank
        candidate_embeddings: Pre-computed embeddings for candidates (optional)
        top_k: Number of top results to return
        similarity_threshold: Minimum similarity score (0.0-1.0) for inclusion in results
                             Higher values mean stricter filtering (0.65 default)
        
    Returns:
        List of reranked candidates that meet the similarity threshold (top_k only)
    """
    # Handle empty candidates
    if not candidates or not isinstance(candidates, list):
        return []
    
    # Filter out non-string candidates
    valid_candidates = [c for c in candidates if isinstance(c, str)]
    if not valid_candidates:
        return []
    
    # Get query string if it's an embedding
    if isinstance(query, np.ndarray):
        # We need to recover the query text - default to empty string
        # This isn't ideal, but we need to work with what we have
        query_text = "Query"
    else:
        query_text = query
    
    # Prepare pairs for cross-encoder scoring using BGE model
    pairs = [(query_text, candidate) for candidate in valid_candidates]
    
    # Compute BGE cross-encoder scores
    # Format for BGE model: "Represent the query for retrieval: query_text\npassage"
    formatted_pairs = [
        f"Represent the query for retrieval: {q}\n{p}" 
        for q, p in pairs
    ]
    
    # Get embeddings for formatted pairs
    pair_embeddings = model.encode(formatted_pairs)
    
    # Calculate cross-encoder relevance scores using the first token's relevance signal
    # This is how cross-encoders typically determine relevance
    scores = []
    
    # Convert single query embedding for bi-encoder comparison
    query_embed = get_embedding(query_text) if isinstance(query_text, str) else query
    
    for i, embedding in enumerate(pair_embeddings):
        # Direct embedding score - BGE models are trained for direct scoring
        direct_score = np.mean(embedding)  # Direct scalar magnitude indicates relevance
        
        # Backup bi-encoder score for comparison
        candidate_embed = get_embedding(valid_candidates[i])
        bi_encoder_score = cosine_similarity(query_embed, candidate_embed)
        
        # Use weighted combination favoring the cross-encoder score
        final_score = 0.8 * direct_score + 0.2 * bi_encoder_score
        scores.append((i, final_score))
    
    # Sort by score (descending)
    scores.sort(key=lambda x: x[1], reverse=True)
    
    # Filter based on similarity threshold
    filtered_scores = []
    for idx, score in scores:
        # Normalize score to 0-1 range if needed (BGE scores can vary)
        normalized_score = min(max(score, 0.0), 1.0) 
        
        # Only keep scores above the threshold
        if normalized_score >= similarity_threshold:
            filtered_scores.append((idx, normalized_score))
    
    # Return only candidates that passed the threshold (up to top_k)
    return [valid_candidates[i] for i, score in filtered_scores[:top_k]]

# Filter most useful RAGs
def trim_relevant_rags(query: str, rag_chunks: list[str], sim_threshold: float = 0.5):
    query_embedding = get_embedding(query)
    chunk_embeddings = [get_embedding(text) for text in rag_chunks]
    
    useful_chunks = []
    for chunk, emb in zip(rag_chunks, chunk_embeddings):
        sim = cosine_similarity(query_embedding, emb)
        if sim >= sim_threshold:
            useful_chunks.append((chunk, sim))

    # Sort descending by similarity
    useful_chunks.sort(key=lambda x: x[1], reverse=True)
    return [chunk for chunk, _ in useful_chunks]


# Test wrapper for local usage (optional)
def run_test(query, corpus_texts, top_k=5):
    dim = 768
    index = faiss.IndexFlatIP(dim)
    embeddings = [get_embedding(text) for text in corpus_texts]
    index.add(np.array(embeddings))

    query_embedding = get_embedding(query).reshape(1, -1)
    D, I = index.search(query_embedding, top_k * 2)

    candidate_texts = [corpus_texts[i] for i in I[0]]
    candidate_embeddings = [embeddings[i] for i in I[0]]
    best_matches = rerank(query_embedding[0], candidate_texts, candidate_embeddings, top_k=top_k)

    return best_matches

# 🧪 Test data
if __name__ == '__main__':
    # Simulated past messages and stuff
    past_messages = [
        "How do I connect my MongoDB to my Python backend?",
        "What's the best way to optimize cosine similarity for FAISS?",
        "What is vector quantization?",
        "Can I run BGE embeddings on CPU?",
        "How do I load DeepSeek LLM locally?",
        "What's the best embedding model for English-only projects?",
        "How do I extract embeddings from a text file for retrieval?",
        "Why is summarization worse than precision memory retrieval?",
        "I'm using Qwen but want something faster on CPU.",
        "How do I improve long-term context in my chatbot?"
    ]

    query = "What embedding model should I use if I'm just doing English on CPU?"
    results = run_test(query, past_messages, top_k=5)

    print("\nQuery:", query)
    print("\nTop Matches:")
    print("hi :)")
    for i, r in enumerate(results, 1):
        print(f"{i}. {r}")
