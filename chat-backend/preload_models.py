"""
Script to preload models at server startup
"""
import logging
import os
from llm import get_model, unload_models

logger = logging.getLogger("preload")

def preload_models():
    """Skip preloading models at startup - models will be loaded on-demand"""
    logger.info("Skipping model preloading - models will be loaded on-demand")
    return True

def preload_specific_model(model_profile: str):
    """Preload a specific model on-demand"""
    logger.info(f"Preloading model: {model_profile}")
    
    # Load the specified model
    model = get_model(model_profile)
    if model is not None:
        logger.info(f"Successfully preloaded '{model_profile}' model")
        return True
    else:
        logger.error(f"Failed to preload '{model_profile}' model")
        return False

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # For standalone testing
    preload_models()
