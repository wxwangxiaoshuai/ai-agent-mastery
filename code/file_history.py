import json
from pathlib import Path

MEMORY_DIR = Path(__file__).resolve().parent / "memory"
HISTORY_FILE = MEMORY_DIR / "history.json"


def _ensure_memory_dir() -> None:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)


def load_history() -> list:
    _ensure_memory_dir()
    if not HISTORY_FILE.exists():
        return []
    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def save_history(messages: list) -> None:
    _ensure_memory_dir()
    HISTORY_FILE.write_text(
        json.dumps(messages, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def clear_history() -> None:
    save_history([])
