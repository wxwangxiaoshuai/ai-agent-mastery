import os
from pathlib import Path

from dotenv import load_dotenv

# 加载 .env 文件（优先项目根目录，其次当前目录）
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH if ENV_PATH.exists() else None)


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


# 模型配置
MODEL_NAME = _env("MODEL_NAME", "gpt-4o")
OPENAI_API_KEY = _env("OPENAI_API_KEY")
BASE_URL = _env("BASE_URL", "")

# Harness 参数
MAX_RETRIES = int(_env("MAX_RETRIES", "3"))
BASE_DELAY = float(_env("BASE_DELAY", "1.0"))
TIMEOUT = float(_env("TIMEOUT", "30.0"))
CIRCUIT_BREAKER_THRESHOLD = int(_env("CIRCUIT_BREAKER_THRESHOLD", "5"))
CIRCUIT_BREAKER_COOLDOWN = float(_env("CIRCUIT_BREAKER_COOLDOWN", "30.0"))

# Agent 参数
MAX_AGENT_STEPS = int(_env("MAX_AGENT_STEPS", "10"))