"""
Benchmark script to compare model loading and inference across different configurations
"""
import time
import logging
from llama_cpp import Llama
from llm import get_model, run_llm, MODEL_CONFIGS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("benchmark")

def benchmark_direct_load():
    """Benchmark direct model loading without our wrapper"""
    start_time = time.time()
    
    # Use the same config as our fast model
    config = MODEL_CONFIGS["fast"]
    model_path = config["path"]
    
    logger.info(f"Direct loading model: {model_path}")
    model = Llama(
        model_path=model_path,
        n_ctx=512,
        n_gpu_layers=-1,
        n_threads=2,
        f16_kv=True,
        mmap=True,
        metal_device=0,
        verbose=False  # Set to True for debugging
    )
    
    load_time = time.time() - start_time
    logger.info(f"Direct load time: {load_time:.2f} seconds")
    
    # Test inference
    prompt = "Hello, I'm testing TinyLlama on Apple M3. How are you?"
    
    inference_start = time.time()
    output = model(prompt, max_tokens=32)
    inference_time = time.time() - inference_start
    
    if isinstance(output, dict) and "choices" in output:
        response = output["choices"][0]["text"].strip()
    else:
        response = str(output)
    
    logger.info(f"Direct inference time: {inference_time:.2f} seconds")
    logger.info(f"Speed: {32/inference_time:.2f} tokens/second")
    logger.info(f"Response: {response[:50]}...")
    
    return load_time, inference_time

def benchmark_wrapper_load():
    """Benchmark model loading through our wrapper"""
    start_time = time.time()
    
    model = get_model("fast")
    if model is None:
        logger.error("Failed to load model through wrapper")
        return None, None
    
    load_time = time.time() - start_time
    logger.info(f"Wrapper load time: {load_time:.2f} seconds")
    
    # Test inference
    prompt = "Hello, I'm testing TinyLlama on Apple M3. How are you?"
    
    inference_start = time.time()
    response = run_llm(prompt, profile="fast", max_tokens=32)
    inference_time = time.time() - inference_start
    
    logger.info(f"Wrapper inference time: {inference_time:.2f} seconds")
    logger.info(f"Speed: {32/inference_time:.2f} tokens/second")
    logger.info(f"Response: {response[:50]}...")
    
    return load_time, inference_time

def benchmark_cached_inference():
    """Benchmark inference with already cached model"""
    # Ensure model is loaded first
    model = get_model("fast")
    if model is None:
        logger.error("Failed to load model for cached inference test")
        return None
    
    # Test inference
    prompt = "Hello, I'm testing TinyLlama on Apple M3 cached inference. How are you?"
    
    inference_start = time.time()
    response = run_llm(prompt, profile="fast", max_tokens=32)
    inference_time = time.time() - inference_start
    
    logger.info(f"Cached inference time: {inference_time:.2f} seconds")
    logger.info(f"Speed: {32/inference_time:.2f} tokens/second")
    logger.info(f"Response: {response[:50]}...")
    
    return inference_time

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("BENCHMARK: DIRECT MODEL LOADING")
    logger.info("=" * 50)
    direct_load_time, direct_inference_time = benchmark_direct_load()
    
    logger.info("\n" + "=" * 50)
    logger.info("BENCHMARK: WRAPPER MODEL LOADING")
    logger.info("=" * 50)
    wrapper_load_time, wrapper_inference_time = benchmark_wrapper_load()
    
    logger.info("\n" + "=" * 50)
    logger.info("BENCHMARK: CACHED INFERENCE")
    logger.info("=" * 50)
    cached_inference_time = benchmark_cached_inference()
    
    # Summary
    logger.info("\n" + "=" * 50)
    logger.info("BENCHMARK SUMMARY")
    logger.info("=" * 50)
    logger.info(f"Direct load time: {direct_load_time:.2f}s, Inference: {direct_inference_time:.2f}s")
    if wrapper_load_time:
        logger.info(f"Wrapper load time: {wrapper_load_time:.2f}s, Inference: {wrapper_inference_time:.2f}s")
    logger.info(f"Cached inference time: {cached_inference_time:.2f}s")
    
    if direct_load_time and wrapper_load_time:
        load_diff = wrapper_load_time - direct_load_time
        load_percent = (load_diff / direct_load_time) * 100
        logger.info(f"Load time difference: {load_diff:.2f}s ({load_percent:.1f}%)")
        
    if direct_inference_time and wrapper_inference_time and cached_inference_time:
        logger.info(f"Direct inference speed: {32/direct_inference_time:.2f} tokens/sec")
        logger.info(f"Wrapper inference speed: {32/wrapper_inference_time:.2f} tokens/sec")
        logger.info(f"Cached inference speed: {32/cached_inference_time:.2f} tokens/sec")
