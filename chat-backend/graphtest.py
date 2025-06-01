import numpy as np
from pymongo import MongoClient
import umap
import json

def flatten_faiss_vectors(dim=768, mongo_uri="mongodb://localhost:27017"):
    # Connect to MongoDB
    client = MongoClient(mongo_uri)
    collection = client["chat_memory"]["vectors"]

    # Get all docs with embeddings
    docs = list(collection.find({"embedding": {"$exists": True}}))

    if not docs:
        return []

    # Extract embeddings and metadata
    embeddings = []
    metadata = []

    for doc in docs:
        emb = doc.get("embedding")
        if emb and len(emb) == dim:
            embeddings.append(emb)
            metadata.append({
                "id": str(doc.get("_id")),
                "title": doc.get("title", "No Title"),
                "summary": doc.get("message", "No Summary")
            })

    embeddings = np.array(embeddings)

    # Reduce dimensions to 3D using UMAP
    reducer = umap.UMAP(n_components=3, metric="cosine", random_state=42)
    embedding_3d = reducer.fit_transform(embeddings)

    # Pack output
    result = []
    for coords, meta in zip(embedding_3d, metadata):
        result.append({
            "id": meta["id"],
            "title": meta["title"],
            "summary": meta["summary"],
            "x": float(coords[0]),
            "y": float(coords[1]),
            "z": float(coords[2]),
        })

    return result


