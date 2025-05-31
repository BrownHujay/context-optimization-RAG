# vectorstore.py
import os
import faiss
import numpy as np
import uuid
from pymongo import MongoClient
import json

class VectorStore:
    def __init__(self, dim, mongo_uri="mongodb://localhost:27017", index_path="faiss_index.idx"):
        self.dim = dim
        self.index_path = index_path

        # Setup MongoDB
        self.client = MongoClient(mongo_uri)
        self.db = self.client["chat_memory"]
        self.collection = self.db["vectors"]

        # Setup FAISS index (with ID support)
        if os.path.exists(index_path):
            print("[FAISS] Loading existing index...")
            self.index = faiss.read_index(index_path)
        else:
            print("[FAISS] Creating new index...")
            base_index = faiss.IndexFlatIP(dim)
            self.index = faiss.IndexIDMap(base_index)

        # Sync MongoDB IDs to match FAISS 
        self._ensure_mongo_faiss_consistency()

    def _ensure_mongo_faiss_consistency(self):
        # Check to avoid drifting between FAISS and Mongo
        faiss_ids = set(self.index.id_map.ids if self.index.ntotal > 0 else [])
        mongo_ids = set(doc["faiss_id"] for doc in self.collection.find({}, {"faiss_id": 1}))
        if faiss_ids != mongo_ids:
            print("[Warning] FAISS and MongoDB index IDs are out of sync. Consider rebuilding index.")

    def add(self, vector: np.ndarray, message: str, conversation_id: str = None):
        # Generate a unique FAISS-safe integer ID
        faiss_id = np.random.randint(1, 2**63 - 1, dtype=np.int64)

        # Add vector to FAISS
        self.index.add_with_ids(np.array([vector], dtype=np.float32), np.array([faiss_id]))
        self.save()

        # Save metadata to MongoDB
        self.collection.insert_one({
            "faiss_id": int(faiss_id),
            "message": message,
            "conversation_id": conversation_id or str(uuid.uuid4())
        })

        return int(faiss_id)

    def search(self, query_vector: np.ndarray, k=5):
        # Run FAISS similarity search
        query_vector = np.array([query_vector], dtype=np.float32)
        distances, ids = self.index.search(query_vector, k)

        # Match MongoDB docs using FAISS IDs
        results = []
        for idx, score in zip(ids[0], distances[0]):
            if idx == -1:
                continue
            doc = self.collection.find_one({"faiss_id": int(idx)})
            if doc:
                doc["score"] = float(score)
                results.append(doc)

        return results

    def save(self):
        faiss.write_index(self.index, self.index_path)
        print("[FAISS] Index saved to disk.")

    def rebuild_index_from_mongo(self):
        #utility if FAISS index becomes corrupted or lost
        print("[FAISS] Rebuilding index from MongoDB...")
        base_index = faiss.IndexFlatIP(self.dim)
        self.index = faiss.IndexIDMap(base_index)

        vectors = []
        ids = []
        for doc in self.collection.find():
            vector = doc["embedding"]
            if vector:
                vectors.append(np.array(vector, dtype=np.float32))
                ids.append(doc["faiss_id"])

        if vectors:
            self.index.add_with_ids(np.array(vectors), np.array(ids, dtype=np.int64))
            self.save()

    def search_in_conversation(self, query_vector, conversation_id, k=5):
        # Step 1: Get all faiss_ids from MongoDB with this conversation_id
        faiss_ids = list(self.collection.find(
            {"conversation_id": conversation_id},
            {"faiss_id": 1}
        ))
        id_list = [doc["faiss_id"] for doc in faiss_ids]

        if not id_list:
            return []

        # Step 2: Create subindex with only those IDs
        subindex = faiss.IndexIDMap(faiss.IndexFlatIP(self.dim))
        vectors = []
        ids = []

        for fid in id_list:
            doc = self.collection.find_one({"faiss_id": fid})
            if doc and "embedding" in doc:
                vectors.append(np.array(doc["embedding"], dtype=np.float32))
            ids.append(fid)

        if not vectors:
            return []

        subindex.add_with_ids(np.array(vectors), np.array(ids, dtype=np.int64))

        # Step 3: Search the subindex
        query_vector = np.array([query_vector], dtype=np.float32)
        distances, results = subindex.search(query_vector, k)

        results = []
        for idx, score in zip(results[0], distances[0]):
            if idx == -1:
                continue
            doc = self.collection.find_one({"faiss_id": int(idx)})
            if doc:
                doc["score"] = float(score)
                results.append(doc)

        return results

