import numpy as np
from common import embed_client

def get_embedding(text: str) -> list[float]:
    """调用OpenAI Embedding API获取向量"""
    resp = embed_client.embeddings.create(
        model="embedding-2",
        input=text,
    )
    return resp.data[0].embedding

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦相似度"""
    a_arr,b_arr = np.array(a), np.array(b)
    return float(np.dot(a_arr,b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))

def select_examples(query: str, pool: list[dict], k: int = 3) -> list[dict]:
    """从池中选择最相似的k个样本"""
    query_embedding = get_embedding(query)
    scored = []
    for ex in pool:
        ex_embedding = get_embedding(ex["input"])
        similarity = cosine_similarity(query_embedding, ex_embedding)
        scored.append((similarity, ex))
    scored.sort(reverse=True)
    return [ex for _, ex in scored[:k]]
# 使用示例
example_pool = [
    {"input": "这个产品太棒了", "output": "正面"},
    {"input": "质量很差，退货了", "output": "负面"},
    {"input": "功能一般，价格还行", "output": "中性"},
    {"input": "客服态度极差", "output": "负面"},
]

selected = select_examples("非常好", example_pool, k=2)
print(selected)