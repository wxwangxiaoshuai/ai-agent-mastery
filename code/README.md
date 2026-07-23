# P1：CLI 个人助手 v0

对应课程项目 P1。在本目录运行可交互的命令行 AI 助手。

## 环境准备

```bash
# 推荐用 uv
uv sync

# 或 pip
pip install openai python-dotenv
```

在 `code/` 下创建 `.env`（不要提交到 Git）：

```bash
# 标准 OpenAI（与课程文档一致）
OPENAI_API_KEY=sk-...

# 可选：指定模型（不设则默认 gpt-4o-mini）
MODEL_NAME=gpt-4o-mini

# 可选：兼容代理 / 中转（不设则走官方 OpenAI）
# BASE_URL=https://your-proxy.example/v1
# API_KEY=...   # 若代理不用 OPENAI_API_KEY，可用此别名
```

## 运行

```bash
cd code
python assistant.py
```

## 验收命令

| 命令 | 作用 |
|------|------|
| 普通输入 | 多轮流式对话 |
| `/role <name>` | 切换角色（default / coder / translator / teacher），并清空历史 |
| `/clear` | 清空内存与本地历史文件 |
| `/history` | 查看当前对话 |
| `quit` / `exit` | 退出 |

历史默认保存在 `code/memory/history.json`（只存 user/assistant，不含 system）。

## 文件结构

| 文件 | 说明 |
|------|------|
| `assistant.py` | 主程序（流式对话 + 角色 + 持久化 + 错误处理） |
| `common.py` | OpenAI client 初始化 |
| `file_history.py` | 历史读写 |
| `memory/` | 本地历史目录 |
