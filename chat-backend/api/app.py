from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
print("this worked too")
from api.routes.accounts import router as accounts_router
print("1")
from api.routes.chats import router as chats_router
print("2")
from api.routes.messages import router as messages_router
print("3")
from api.routes.chat import router as chat_router
print("4")
from api.routes.graph import router as graph_router
print("5")
from api.routes.http_stream import router as http_stream_router
print("6")

def create_app():
    # Initialize the FastAPI app
    app = FastAPI(
        title="Chat Application API",
        description="API for a chat application with MongoDB backend",
        version="1.0.0"
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",  # Vite dev server
            "http://127.0.0.1:5173",
            "http://localhost:3000",  # React dev server
            "http://127.0.0.1:3000"
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(accounts_router)
    app.include_router(chats_router)
    app.include_router(messages_router)
    app.include_router(chat_router)
    app.include_router(graph_router)
    app.include_router(http_stream_router)
    
    return app

# Note: Your existing Socket.IO event handlers are in api/routes/chat.py