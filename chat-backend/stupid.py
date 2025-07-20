from llama_cpp import Llama

model = Llama(model_path="models/DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf")

token_ids = model.tokenize(b"<|im_end|>", add_bos=False)
print("hi", token_ids)
