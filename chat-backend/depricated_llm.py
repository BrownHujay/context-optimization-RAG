"""
LLM interface for running local models via llama-cpp-python
with failsafes for memory and resource constraints
"""
import os
import gc
import logging
import json
import asyncio
from typing import AsyncGenerator, Dict, List, Optional, Union
from llama_cpp import Llama
import psutil
import inspect

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm")

# Load model configurations from JSON file
def load_model_configs():
    """Load model configurations from JSON file."""
    config_path = os.path.join(os.path.dirname(__file__), 'model_configs.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error(f"Model config file not found: {config_path}")
        return {}
    except json.JSONDecodeError as e:
        logging.error(f"Error parsing model config JSON: {e}")
        return {}

# Load configurations at module level
MODEL_CONFIGS = load_model_configs()


# Single model instance (only one model loaded at a time)
_current_model = None
_current_profile = None

def get_model_path(profile: str = "default") -> str:
    """Get the model path for a given profile."""
    profile = profile if profile in MODEL_CONFIGS else "default"
    return MODEL_CONFIGS[profile]["path"]

def get_model_type(profile: str = "default") -> str:
    """Get the model type for a given profile.
    
    This is used for prompt formatting in prompt_builder.py.
    
    Args:
        profile: The model profile to use
        
    Returns:
        Model type string (e.g., 'llama', 'mistral', 'qwen', etc.)
    """
    profile = profile if profile in MODEL_CONFIGS else "default"
    return MODEL_CONFIGS[profile].get("model_type", "default")


def get_model_system_prompt(profile: str) -> str:
    """Get the system prompt for a specific model profile."""
    if profile in MODEL_CONFIGS and 'system_prompt' in MODEL_CONFIGS[profile]:
        prompt = MODEL_CONFIGS[profile]['system_prompt']
        # Handle both string and array formats
        if isinstance(prompt, list):
            return '\n'.join(prompt)
        return prompt
    # Fallback to default profile system prompt
    if 'default' in MODEL_CONFIGS and 'system_prompt' in MODEL_CONFIGS['default']:
        prompt = MODEL_CONFIGS['default']['system_prompt']
        if isinstance(prompt, list):
            return '\n'.join(prompt)
        return prompt
    # Final fallback
    return "You are a helpful AI assistant."


def unload_current_model():
    """Unload the currently loaded model and free memory"""
    global _current_model, _current_profile
    if _current_model is not None:
        logger.info(f"Unloading current model: {_current_profile}")
        del _current_model
        _current_model = None
        _current_profile = None
        gc.collect()
        logger.info("Model unloaded and memory freed")

def get_model(profile: str = "default") -> Optional[Llama]:
    """Get or load a model based on profile, ejecting any previously loaded model"""
    global _current_model, _current_profile
    
    profile = profile if profile in MODEL_CONFIGS else "default"
    config = MODEL_CONFIGS[profile]
    
    # Check if model exists
    if not os.path.exists(config["path"]):
        logger.error(f"Model file not found: {config['path']}")
        return None
    
    # Return current model if it's already the one we want
    if _current_profile == profile and _current_model is not None:
        logger.info(f"Returning already loaded model: {profile}")
        return _current_model
    
    # Unload current model if a different one is requested
    if _current_model is not None and _current_profile != profile:
        unload_current_model()
    
    try:
        # Force garbage collection before loading new model
        gc.collect()
        
        # Load the new model
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
        # Add Qwen chat formatting if needed
        if config.get("model_type") == "qwen":
            llama_kwargs["chat_format"] = "qwen"
        
        logger.info(f"Llama constructor parameters: {llama_kwargs}")
        model = Llama(**llama_kwargs, verbose=False)
        
        # Set as current model
        _current_model = model
        _current_profile = profile
        logger.info(f"Successfully loaded model: {profile}")
        return model
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return None

def run_llm(prompt: str, profile: str = "default", **kwargs) -> str:
    """
    Run the model on the prompt and return the full response
    
    Args:
        prompt: The prompt string to send to the model
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
    max_attempts = 1
    attempt = 0
    last_error = None
    
    while attempt < max_attempts:
        attempt += 1
        logger.info(f"LLM generation attempt {attempt}/{max_attempts} with profile '{profile}'")
        
        model = get_model(profile)
        if model is None:
            return "Error: Unable to load model. Please check the model path and try again."
        
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
            
            # All models now use string prompts with model(prompt_str) interface
            model_type = get_model_type(profile)
            prompt_str = prompt
            
            
            logger.info(f"Using completion for {model_type} model")
            response = model(
                prompt_str,
                max_tokens=params["max_tokens"],
                temperature=params["temperature"],
                top_p=params["top_p"],
                repeat_penalty=params["repeat_penalty"],
                echo=False
            )
            
            # Extract generated text from completion format only
            if isinstance(response, dict) and "choices" in response:
                choice = response["choices"][0]
                
                if "text" in choice:  # Standard completion format
                    generated_text = choice["text"].strip()
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
        prompt: The prompt string to send to the model
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
            yield "Error: Unable to load model. Please check the model path and try again."
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
            thinking_started = False
            
            # All models now use string prompts with streaming
            model_type = get_model_type(profile)
            prompt_str = prompt
            
            logger.info(f"Using streaming completion for {model_type} model")
            stream_response = model(
                prompt_str,
                max_tokens=params["max_tokens"],
                temperature=params["temperature"],
                top_p=params["top_p"],
                repeat_penalty=params["repeat_penalty"],
                echo=False,
                stream=True
            )
            
            for token in stream_response:
                # Extract token text from completion format only
                text = None
                if isinstance(token, dict) and "choices" in token:
                    choice = token["choices"][0]
                    if "text" in choice:  # Standard completion format
                        text = choice["text"]
                
                if text:
                    yield text
                    token_count += 1
                    # Small delay to avoid overwhelming the client
                    await asyncio.sleep(0.01)
                        
            # Successful generation, return early
            if token_count > 0:
                logger.info(f"Successfully streamed {token_count} tokens")
                return
                
            # No tokens generated
            logger.warning("Model returned no tokens in stream mode")
            yield "I'm having trouble generating a response right now."
            return
                
        except Exception as e:
            last_error = str(e)
            logger.error(f"Error streaming response (attempt {attempt}): {e}")
            # Give up after last attempt
            logger.error(f"Failed to generate streaming response after {attempt} attempts")
            break
    
    # All attempts failed, return error message
    yield f"Error: {last_error if last_error else 'Unknown error generating streaming response'}"

# Utility to unload models and free memory
def unload_models():
    """Unload the current model and free memory"""
    unload_current_model()
    logger.info("Current model unloaded and memory freed")
