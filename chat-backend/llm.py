"""
LLM interface for running local models via llama-cpp-python
with failsafes for memory and resource constraints
"""
import os
import gc
import logging
import asyncio
from typing import AsyncGenerator, Dict, List, Optional, Union
from llama_cpp import Llama
import psutil
import inspect

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm")

# Model configs for different profiles
MODEL_CONFIGS = {
    "default": {
        "path": os.environ.get("LLM_MODEL_PATH", "models/mistral-7b-instruct-v0.2.Q4_K_M.gguf"),
        "n_ctx": 4096,
        "n_gpu_layers": -1,  # Auto-detect, use all available layers
        "n_threads": max(1, os.cpu_count() // 2),  # Use half of available threads
        "max_tokens": 2048,
        "f16_kv": True,  # Use half-precision for key/value cache
        "mmap": True,  # Use memory mapping for better M3 performance
        "metal_device": 0,  # Use primary GPU on M3
    },
    "fast": {
        "path": os.environ.get("LLM_FAST_MODEL_PATH", "models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"),
        "n_ctx": 512,  # Further reduced context size for stability
        "n_gpu_layers": -1,  # Use Metal for acceleration on M3
        "n_threads": min(2, os.cpu_count()),  # More conservative thread count
        "max_tokens": 256,  # Reduced max output tokens
        "f16_kv": True,  # Use half-precision for key/value cache
        "mmap": True,  # Use memory mapping for better M3 performance
        "metal_device": 0,  # Use primary GPU on M3
        "verbose": True,  # Enable verbose logging for debugging
    },
    "quality": {
        "path": os.environ.get("LLM_QUALITY_MODEL_PATH", "models/llama3-8b-instruct.Q5_K_M.gguf"),
        "n_ctx": 8192,
        "n_gpu_layers": -1,
        "n_threads": max(1, os.cpu_count() // 2),
        "max_tokens": 4096,
        "f16_kv": True,  # Use half-precision for key/value cache
        "mmap": True,  # Use memory mapping for better M3 performance
        "metal_device": 0,  # Use primary GPU on M3
    }
}

# Memory safety settings
MAX_MEMORY_PERCENT = 90  # Maximum memory usage percentage (increased from 80%)
MIN_FREE_MEMORY_GB = 1   # Minimum free memory required in GB (reduced from 2GB)

# Model instance cache
_model_cache = {}

def check_system_resources(config: Dict) -> bool:
    """Check if system has enough resources to load the model"""
    try:
        # Check available memory
        mem = psutil.virtual_memory()
        free_memory_gb = mem.available / (1024 ** 3)
        memory_percent = mem.percent
        
        # Estimate model size based on context length
        # This is a rough estimate and varies by model architecture
        estimated_model_size_gb = config["n_ctx"] * 0.002  # Very rough estimate
        
        logger.info(f"Free memory: {free_memory_gb:.2f}GB, Usage: {memory_percent}%")
        logger.info(f"Estimated model memory: {estimated_model_size_gb:.2f}GB")
        
        if memory_percent > MAX_MEMORY_PERCENT:
            logger.warning(f"Memory usage too high: {memory_percent}% > {MAX_MEMORY_PERCENT}%")
            return False
            
        if free_memory_gb < estimated_model_size_gb + MIN_FREE_MEMORY_GB:
            logger.warning(f"Not enough free memory: {free_memory_gb:.2f}GB < {estimated_model_size_gb + MIN_FREE_MEMORY_GB:.2f}GB")
            return False
            
        return True
    except Exception as e:
        logger.error(f"Error checking system resources: {e}")
        # Default to True if we can't check
        return True

def get_model(profile: str = "default") -> Optional[Llama]:
    """Get or load a model based on profile, with resource checking"""
    profile = profile if profile in MODEL_CONFIGS else "default"
    config = MODEL_CONFIGS[profile]
    
    # Check if model exists
    if not os.path.exists(config["path"]):
        logger.error(f"Model file not found: {config['path']}")
        return None
    
    # Return cached model if available and not None
    if profile in _model_cache and _model_cache[profile] is not None:
        return _model_cache[profile]
    
    # Remove any previous failed model instance for this profile
    if profile in _model_cache:
        del _model_cache[profile]
    
    # Check system resources before loading
    if not check_system_resources(config):
        logger.warning("Insufficient system resources to load model")
        # Try to fallback to a smaller model if this isn't already the fast model
        if profile != "fast":
            logger.info("Attempting to fallback to fast model profile")
            return get_model("fast")
        return None
    
    try:
        # Force garbage collection before loading model
        gc.collect()
        
        # Load the model
        logger.info(f"Loading model: {config['path']}")
        
        # Extract all config parameters for Llama constructor
        llama_kwargs = {
            "model_path": config["path"],
            "n_ctx": config["n_ctx"],
            "n_gpu_layers": config["n_gpu_layers"],
            "n_threads": config["n_threads"],
        }
        
        # Add optional parameters if present in config
        for param in ["f16_kv", "mmap", "metal_device", "verbose"]:
            if param in config:
                llama_kwargs[param] = config[param]
        
        logger.info(f"Llama constructor parameters: {llama_kwargs}")
        model = Llama(**llama_kwargs)
        
        # Cache the model
        _model_cache[profile] = model
        return model
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return None

def run_llm(prompt: str, profile: str = "default", **kwargs) -> str:
    """
    Run the model on the prompt and return the full response
    
    Args:
        prompt: The prompt to send to the model
        profile: The model profile to use
        **kwargs: Additional parameters to pass to model.generate
        
    Returns:
        Generated text as a string
    """
    # Basic sanity checks
    if not prompt or not isinstance(prompt, str):
        logger.error(f"Invalid prompt: {type(prompt)}")
        return "Error: Invalid prompt"
        
    # Try multiple attempts to handle intermittent failures
    max_attempts = 2
    attempt = 0
    last_error = None
    
    while attempt < max_attempts:
        attempt += 1
        logger.info(f"LLM generation attempt {attempt}/{max_attempts} with profile '{profile}'")
        
        model = get_model(profile)
        if model is None:
            if profile != "fast" and attempt == 1:
                # Try fallback to fast model on first failure
                logger.info(f"Falling back to 'fast' profile after failed model load")
                profile = "fast"
                continue
            return "Error: Unable to load model. Please try again later or use a smaller model."
        
        config = MODEL_CONFIGS[profile if profile in MODEL_CONFIGS else "default"]
        
        try:
            # Set default parameters
            params = {
                "max_tokens": config["max_tokens"],
                "temperature": 0.7,
                "top_p": 0.95,
                "repeat_penalty": 1.1,
            }
            params.update(kwargs)
            
            # Generate response
            response = model(
                prompt,
                max_tokens=params["max_tokens"],
                temperature=params["temperature"],
                top_p=params["top_p"],
                repeat_penalty=params["repeat_penalty"],
                echo=False
            )
            
            # Extract generated text
            if isinstance(response, dict) and "choices" in response:
                generated_text = response["choices"][0]["text"].strip()
                if generated_text:
                    return generated_text
                logger.warning("Model returned empty response")
                return "I'm having trouble generating a response right now."
            logger.warning(f"Unexpected model response format: {type(response)}")
            return "Error: Unexpected model response format"
            
        except Exception as e:
            last_error = str(e)
            logger.error(f"Error generating response (attempt {attempt}): {e}")
            # Try again with different profile if not already using fast
            if profile != "fast" and attempt == 1:
                logger.info(f"Trying again with 'fast' profile")
                profile = "fast"
            else:
                # Give up after last attempt
                logger.error(f"Failed to generate response after {attempt} attempts")
                break
                
    return f"Error: {last_error if last_error else 'Unknown error generating response'}"

async def run_llm_stream(prompt: str, profile: str = "default", **kwargs) -> AsyncGenerator[str, None]:
    """
    Stream the model output token by token
    
    Args:
        prompt: The prompt to send to the model
        profile: The model profile to use
        **kwargs: Additional parameters to pass to model.generate
        
    Yields:
        Tokens as they are generated
    """
    # Basic sanity checks
    if not prompt or not isinstance(prompt, str):
        logger.error(f"Invalid prompt for streaming: {type(prompt)}")
        yield "Error: Invalid prompt"
        return
        
    # Try multiple attempts to handle intermittent failures
    max_attempts = 2
    attempt = 0
    last_error = None
    
    while attempt < max_attempts:
        attempt += 1
        logger.info(f"LLM streaming attempt {attempt}/{max_attempts} with profile '{profile}'")
        
        model = get_model(profile)
        if model is None:
            if profile != "fast" and attempt == 1:
                # Try fallback to fast model on first failure
                logger.info(f"Falling back to 'fast' profile after failed model load for streaming")
                profile = "fast"
                continue
            yield "Error: Unable to load model. Please try again later or use a smaller model."
            return
        
        config = MODEL_CONFIGS[profile if profile in MODEL_CONFIGS else "default"]
        
        try:
            # Set default parameters
            params = {
                "max_tokens": config["max_tokens"],
                "temperature": 0.7,
                "top_p": 0.95,
                "repeat_penalty": 1.1,
            }
            params.update(kwargs)
            
            # Stream response
            token_count = 0
            for token in model(
                prompt,
                max_tokens=params["max_tokens"],
                temperature=params["temperature"],
                top_p=params["top_p"],
                repeat_penalty=params["repeat_penalty"],
                echo=False,
                stream=True
            ):
                # Extract token text
                if isinstance(token, dict) and "choices" in token:
                    text = token["choices"][0]["text"]
                    if text:
                        yield text
                        token_count += 1
                        # Small delay to avoid overwhelming the client
                        await asyncio.sleep(0.01)
                        
            # Successful generation, return early
            if token_count > 0:
                logger.info(f"Successfully streamed {token_count} tokens")
                return
                
            # No tokens generated, try again if possible
            logger.warning("Model returned no tokens in stream mode")
            if profile != "fast" and attempt == 1:
                logger.info(f"Trying again with 'fast' profile for streaming")
                profile = "fast"
                continue
            
            # Last attempt failed with no tokens
            yield "I'm having trouble generating a response right now."
            return
                
        except Exception as e:
            last_error = str(e)
            logger.error(f"Error streaming response (attempt {attempt}): {e}")
            # Try again with different profile if not already using fast
            if profile != "fast" and attempt == 1:
                logger.info(f"Trying again with 'fast' profile for streaming after error")
                profile = "fast"
            else:
                # Give up after last attempt
                logger.error(f"Failed to generate streaming response after {attempt} attempts")
                break
    
    # All attempts failed, return error message
    yield f"Error: {last_error if last_error else 'Unknown error generating streaming response'}"

# Utility to unload models and free memory
def unload_models():
    """Unload all cached models and free memory"""
    global _model_cache
    for profile, model in _model_cache.items():
        logger.info(f"Unloading model for profile: {profile}")
        del model
    
    _model_cache = {}
    gc.collect()
    logger.info("All models unloaded and memory freed")
