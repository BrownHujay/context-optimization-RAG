#embeddings.py
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

# Rerank top results using exact cosine similarity
def rerank(query_embedding, candidates, candidate_embeddings, top_k=5):
    similarities = [
        (i, cosine_similarity(query_embedding, emb)) 
        for i, emb in enumerate(candidate_embeddings)
    ]
    similarities.sort(key=lambda x: x[1], reverse=True)
    print(similarities)
    return [candidates[i] for i, _ in similarities[:top_k]]

# Simulate embedding + search pipeline (no LLM)
def run_test(query, corpus_texts, top_k=5):
    # Step 1: Embed and store the corpus in FAISS
    dim = 768
    index = faiss.IndexFlatIP(dim)  # Use Inner Product for cosine similarity w/ normalized vectors
    embeddings = [get_embedding(text) for text in corpus_texts]
    index.add(np.array(embeddings))

    # Step 2: Embed query
    query_embedding = get_embedding(query).reshape(1, -1)

    # Step 3: Search in FAISS
    D, I = index.search(query_embedding, top_k * 2)  # Pull a few more to rerank

    # Step 4: Pull candidate texts + rerank for accuracy
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
