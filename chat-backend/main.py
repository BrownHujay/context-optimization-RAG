# main.py - Entry point for the application
print("loading")
import uvicorn
print("loading")
import os
print("loading")
import logging
print("loading")
from api.app import create_app
print("loading again")
from preload_models import preload_models
print("I think this fails it.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("main")

# Create the FastAPI application
app = create_app()

# Application configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")

# Preload models before starting server if not in debug mode
# Debug mode with auto-reload will cause models to be loaded multiple times
if not DEBUG:
    logger.info("Preloading LLM models before server start...")
    preload_models()
    logger.info("Model preloading complete, starting server")

if __name__ == "__main__":
    print("starting")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)