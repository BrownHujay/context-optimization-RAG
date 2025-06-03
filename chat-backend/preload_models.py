"""
Script to preload models at server startup
"""
import logging
from llm import get_model, unload_models

logger = logging.getLogger("preload")

def preload_models():
    """Preload all models into memory at server startup"""
    logger.info("Preloading LLM models...")
    
    # Load the fast model first as it's used for summarization
    fast_model = get_model("fast")
    if fast_model is not None:
        logger.info("Successfully preloaded 'fast' model")
    else:
        logger.error("Failed to preload 'fast' model")
    
    # Try to load the default model if resources allow
    default_model = get_model("default")
    if default_model is not None:
        logger.info("Successfully preloaded 'default' model")
    else:
        logger.warning("Could not preload 'default' model, will use 'fast' model as fallback")
    
    logger.info("Model preloading complete")
    return True

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # For standalone testing
    preload_models()
