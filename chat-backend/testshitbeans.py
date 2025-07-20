# deepseek_format.py
from typing import List, Dict
from llama_cpp import Llama

# Load your DeepSeek-R1-0528-Qwen3-8B GGUF
llm = Llama(model_path="models/DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf", n_ctx=4096)

DEEPSEEK_USER_TAG = "＜｜User｜＞"
DEEPSEEK_ASSIST_TAG = "＜｜Assistant｜＞"
DEEPSEEK_END_TAG = "＜｜end▁of▁sentence｜＞"

def deepseek_prompt(history: list[str], new_user_input: str) -> str:
    prompt = ""
    for i in range(0, len(history), 2):
        user = history[i]
        reply = history[i+1] if i + 1 < len(history) else ""
        prompt += f"{DEEPSEEK_USER_TAG}{user}{DEEPSEEK_ASSIST_TAG}{reply}"
    prompt += f"{DEEPSEEK_USER_TAG}{new_user_input}{DEEPSEEK_ASSIST_TAG}"
    return prompt

raw_prompt = deepseek_prompt(["What is 1+1?", "1 + 1 = 2."], "Explain it. think before responding.")
res = llm.create_completion(
    prompt=raw_prompt,
    max_tokens=1024,
    stop=[DEEPSEEK_USER_TAG, DEEPSEEK_END_TAG],
    temperature=0.6,
    top_p=0.95,
    min_p=0.05,
)
print(res["choices"][0]["text"])