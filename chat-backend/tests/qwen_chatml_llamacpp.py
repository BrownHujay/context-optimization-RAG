#!/usr/bin/env python3
# qwen_chatml_llamacpp.py
# Quick test harness for Qwen-GGUF in llama-cpp using ChatML.

from pathlib import Path
from llama_cpp import Llama

# ---------- USER CONFIG ------------------------------------------------------
GGUF_PATH = Path("chat-backend/models/DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf")  # <-- edit
N_CTX      = 8192        # or whatever n_ctx your build supports
MAX_TOKENS = 512         # tokens to generate
N_GPU_LAYERS = 60        # set to 0 for pure CPU, tweak for your VRAM
TOP_P = 0.9
TEMP  = 0.7
# -----------------------------------------------------------------------------

def chatml(system: str, history: list[tuple[str, str]], user: str) -> str:
    """
    Build a ChatML prompt string for llama.cpp.
    history = list of (role, content) where role is 'user' or 'assistant'.
    """
    parts: list[str] = []
    # System
    parts.append("<|im_start|>system\n" + system.strip() + "<|im_end|>")
    # History
    for role, content in history:
        role = role.lower()
        if role not in ("user", "assistant"):
            role = "user"
        parts.append(f"<|im_start|>{role}\n{content.strip()}<|im_end|>")
    # Current user turn + assistant stub
    parts.append("<|im_start|>user\n" + user.strip() + "<|im_end|>")
    parts.append("<|im_start|>assistant\n")           # llama.cpp keeps generating from here
    return "\n".join(parts)

def main():
    # ---- 1. Build prompt -----------------------------------------------------
    system_prompt = "You are a concise, knowledgeable assistant. think before responding."
    chat_history  = [
        ("user",      "What is 2 + 2"),
        ("assistant", "4"),
    ]
    user_msg      = "What is 2 / 2?"

    prompt = chatml(system_prompt, chat_history, user_msg)

    # ---- 2. Load model -------------------------------------------------------
    llama = Llama(
        model_path=str(GGUF_PATH),
        n_ctx=N_CTX,
        n_gpu_layers=N_GPU_LAYERS,
        verbose=False,
    )

    # ---- 3. Run inference ----------------------------------------------------
    output = llama(
        prompt,
        max_tokens=MAX_TOKENS,
        top_p=TOP_P,
        temperature=TEMP,
        stop=["<|im_end|>"],        # stop at the end-tag so we don’t babble
    )

    reply = output["choices"][0]["text"].rstrip()
    print("\n🗨️ Assistant:\n", reply)

    # Optional stats
    usage = output["usage"]
    print(f"\nToken usage: prompt {usage['prompt_tokens']}, "
          f"completion {usage['completion_tokens']}")

if __name__ == "__main__":
    main()
