from fastapi import APIRouter
from graph import flatten_faiss_vectors

router = APIRouter(prefix="/graph", tags=["graph"])

@router.get("")
def graph():
    return flatten_faiss_vectors()
