import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# 优先使用 OPENAI_API_KEY（与课程文档一致）；API_KEY 作为兼容别名
# BASE_URL 可选：走官方 OpenAI 时可不设；走兼容代理时填写代理地址
_kwargs = {
    "api_key": os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY"),
    "timeout": 30.0,
}
if os.getenv("BASE_URL"):
    _kwargs["base_url"] = os.getenv("BASE_URL")

client = OpenAI(**_kwargs)

_embed_kwargs = {
    "api_key": os.getenv("OPENAI_API_KEY") or os.getenv("EMBED_API_KEY"),
    "timeout": 30.0,
}
if os.getenv("EMBED_BASE_URL"):
    _embed_kwargs["base_url"] = os.getenv("EMBED_BASE_URL")

embed_client = OpenAI(**_embed_kwargs)
