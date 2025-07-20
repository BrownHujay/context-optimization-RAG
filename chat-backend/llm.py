"""
High‑level chat interface for llama‑cpp, now with hard truncation at
`<|im_end|>` in **both** blocking and streaming modes.
"""
from typing import List, Dict, Any, AsyncGenerator, Optional
import asyncio, gc, json, logging, os, re
from llama_cpp import Llama

# ─────────────────────────────────────────────────────────────────────────────
#  Logging
# ─────────────────────────────────────────────────────────────────────────────
logger = logging.getLogger("llm_chat")
logger.setLevel(logging.INFO)

# ─────────────────────────────────────────────────────────────────────────────
#  Config loading
# ─────────────────────────────────────────────────────────────────────────────
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "model_configs.json")
try:
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        MODEL_CONFIGS = json.load(fh)
except (FileNotFoundError, json.JSONDecodeError):
    logger.error("⚠️  model_configs.json missing or invalid — using empty config")
    MODEL_CONFIGS = {}

# ─────────────────────────────────────────────────────────────────────────────
#  Singleton model cache
# ─────────────────────────────────────────────────────────────────────────────
_current: Optional[Llama] = None
_profile: Optional[str] = None


def _unload() -> None:
    global _current, _profile
    if _current is not None:
        logger.info(f"Unloading model '{_profile}' and freeing memory …")
        del _current
        _current = None
        _profile = None
        gc.collect()


def _get_model(profile: str = "default") -> Optional[Llama]:
    """Return (and load if needed) a `Llama` instance for *profile*."""
    global _current, _profile

    if profile not in MODEL_CONFIGS:
        logger.error(f"Profile '{profile}' not found in model_configs.json")
        return None

    cfg: Dict[str, Any] = MODEL_CONFIGS[profile]

    if _current is not None and _profile == profile:
        return _current

    _unload()

    path = cfg.get("path")
    if not path or not os.path.exists(path):
        logger.error(f"Model file missing: {path}")
        return None

    kwargs: Dict[str, Any] = {
        "model_path": path,
        "n_ctx": cfg.get("n_ctx", 4096),
        "n_gpu_layers": cfg.get("n_gpu_layers", -1),
        "n_threads": cfg.get("n_threads", 4),
        "chat_format": "chatml"
    }
    for k in ("f16_kv", "mmap", "metal_device", "verbose"):
        if k in cfg:
            kwargs[k] = cfg[k]

    logger.info(f"Loading model '{profile}' …")
    _current = Llama(**kwargs)
    _profile = profile
    return _current

# ─────────────────────────────────────────────────────────────────────────────
#  Chat helpers
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_SYSTEM = "You are a helpful assistant."
END_TOKEN = "<|im_end|>"
STOP = [END_TOKEN]
END_RE = re.compile(re.escape(END_TOKEN))


def _truncate_at_end_token(text: str) -> str:
    """Return text before first <|im_end|> (if present)."""
    return END_RE.split(text, 1)[0].strip()


def chat(messages: List[Dict[str, str]], profile: str = "default", **gen_kwargs) -> str:
    """Blocking call – returns single reply, truncated at <|im_end|>."""
    model = _get_model(profile)
    if model is None:
        return "Error: could not load model."

    params: Dict[str, Any] = {
        "max_tokens": MODEL_CONFIGS[profile].get("max_tokens", 1024),
        "temperature": 0.7,
        "top_k": 50,
        "top_p": 0.95,
        "repeat_penalty": 1.1,
        "stop": ["<|im_end|>", "<|im_start|>"]
    }
    params.update(gen_kwargs)

    res = model.create_chat_completion(messages=messages, **params)
    raw = res["choices"][0]["message"]["content"]
    return _truncate_at_end_token(raw)


async def chat_stream(
    messages: List[Dict[str, str]],
    profile: str = "default",
    **gen_kwargs,
) -> AsyncGenerator[str, None]:
    """Async generator – streams content, stops at <|im_end|>."""
    model = _get_model(profile)
    if model is None:
        yield "Error: could not load model."
        return

    params: Dict[str, Any] = {
        "max_tokens": MODEL_CONFIGS[profile].get("max_tokens", 1024),
        "temperature": 2,
        "top_p": 0.95,
        "repeat_penalty": 1.1,
        "stop": ["<s>", "</s>", "<|im_end|>", "<|im_start|>"],
        "stream": False,
    }
    params.update(gen_kwargs)

    buffer = ""
    async for chunk in _async_stream(model.create_chat_completion, messages, params):
        delta = chunk["choices"][0]["delta"].get("content", "")
        if not delta:
            continue
        buffer += delta
        if END_TOKEN in buffer:
            # Yield only up to end token, then stop
            yield _truncate_at_end_token(buffer)
            break
        else:
            yield delta
            await asyncio.sleep(0)


async def _async_stream(fn, messages, params):
    """Run llama.cpp streaming in a thread‐friendly way."""
    loop = asyncio.get_running_loop()
    q = asyncio.Queue()

    def _run():
        for chunk in fn(messages=messages, **params):
            loop.call_soon_threadsafe(q.put_nowait, chunk)
        loop.call_soon_threadsafe(q.put_nowait, None)

    await loop.run_in_executor(None, _run)
    while True:
        item = await q.get()
        if item is None:
            break
        yield item

# ─────────────────────────────────────────────────────────────────────────────
#  Quick helper
# ─────────────────────────────────────────────────────────────────────────────

def ask(prompt: str, profile: str = "default", **kw) -> str:
    messages = [
        {"role": "system", "content": DEFAULT_SYSTEM},
        {"role": "user", "content": prompt},
    ]
    return chat(messages, profile=profile, **kw)

# ─────────────────────────────────────────────────────────────────────────────
#  Manual unload
# ─────────────────────────────────────────────────────────────────────────────

def unload() -> None:
    _unload()
