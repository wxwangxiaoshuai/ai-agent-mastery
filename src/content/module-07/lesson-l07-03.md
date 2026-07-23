## 状态持久化与恢复：Checkpointing

你的 Agent 执行到第 5 步，搜索了 3 次、抓取了 2 个网页、正在生成报告——突然 LLM API 503 了。如果没有 Checkpoint，你只能从第 1 步重新开始——之前的搜索结果全部丢失。Checkpointing 让 Agent **从失败的那一步恢复，而非从头来过**。

### 为什么需要 Checkpoint

```
没有 Checkpoint：
  Step 1 ✓ → Step 2 ✓ → Step 3 ✓ → Step 4 ✓ → Step 5 ✗ (API 503)
  → 从 Step 1 重新开始（浪费 4 步的计算和成本）

有 Checkpoint：
  Step 1 ✓ → Step 2 ✓ → Step 3 ✓ → Step 4 ✓ → [保存 Checkpoint]
  → Step 5 ✗ (API 503)
  → 从 Step 5 恢复（前 4 步的结果完好）
```

### Checkpoint 的设计：保存什么

```python
import json
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class AgentCheckpoint:
    """Agent 状态快照"""
    agent_id: str                    # Agent 实例 ID
    step: int                        # 当前步数
    messages: list                   # 完整对话历史
    tool_results: list               # 已收集的工具结果
    intermediate_output: str = ""    # 中间输出（如有）
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "step": self.step,
            "messages": self.messages,
            "tool_results": self.tool_results,
            "intermediate_output": self.intermediate_output,
            "created_at": self.created_at,
        }
```

**保存什么**：
- `messages`：完整对话历史（模型需要历史来理解上下文）
- `tool_results`：工具返回的结果（避免重新调用工具）
- `step`：下一待执行步的 0-based 索引（恢复后从该步重试，用户可见步号 = step + 1）

**不保存什么**：
- LLM 的内部状态（无法保存，也不需要——每次调用是无状态的）
- 临时变量（可从 messages 和 tool_results 重建）

### Checkpoint 存储

```python
class CheckpointStore:
    """Checkpoint 存储器"""

    def __init__(self, backend: str = "file", base_dir: str = "./checkpoints"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
        self.backend = backend

    def save(self, checkpoint: AgentCheckpoint):
        """保存 Checkpoint"""
        filepath = self.base_dir / f"{checkpoint.agent_id}.json"
        filepath.write_text(json.dumps(checkpoint.to_dict(), ensure_ascii=False, indent=2))
        print(f"[Checkpoint] 已保存: step={checkpoint.step}, agent={checkpoint.agent_id}")

    def load(self, agent_id: str) -> AgentCheckpoint | None:
        """加载 Checkpoint"""
        filepath = self.base_dir / f"{agent_id}.json"
        if not filepath.exists():
            return None
        data = json.loads(filepath.read_text())
        return AgentCheckpoint(**data)

    def delete(self, agent_id: str):
        """删除 Checkpoint（任务完成后清理）"""
        filepath = self.base_dir / f"{agent_id}.json"
        if filepath.exists():
            filepath.unlink()

    def list_all(self) -> list[str]:
        """列出所有 Agent ID（用于恢复未完成的任务）"""
        return [f.stem for f in self.base_dir.glob("*.json")]
```

### 集成到 Agent Loop

```python
import uuid

class CheckpointAgent:
    """带 Checkpoint 的 Agent"""

    def __init__(self, store: CheckpointStore, max_steps: int = 10):
        self.store = store
        self.max_steps = max_steps

    def run(self, question: str, agent_id: str = None) -> str:
        """运行 Agent，支持从 Checkpoint 恢复"""
        agent_id = agent_id or str(uuid.uuid4())[:8]

        # 尝试加载 Checkpoint
        checkpoint = self.store.load(agent_id)
        if checkpoint:
            # checkpoint.step 是下一待执行步的 0-based 索引；用户可见为第 N 步（1-based）
            print(
                f"[恢复] 从第 {checkpoint.step + 1} 步恢复"
                f"（loop index={checkpoint.step}），已有 {len(checkpoint.tool_results)} 个工具结果"
            )
            messages = checkpoint.messages
            tool_results = checkpoint.tool_results
            start_step = checkpoint.step
        else:
            print(f"[新建] Agent {agent_id} 开始执行")
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": question},
            ]
            tool_results = []
            start_step = 0

        # 执行 Agent Loop
        for step in range(start_step, self.max_steps):
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    tools=TOOLS,
                    temperature=0,
                    timeout=30.0,
                )
                msg = response.choices[0].message

                if not msg.tool_calls:
                    # 任务完成，清理 Checkpoint
                    self.store.delete(agent_id)
                    return msg.content

                messages.append(msg)

                for tool_call in msg.tool_calls:
                    fn_name = tool_call.function.name
                    fn_args = json.loads(tool_call.function.arguments)
                    result = TOOL_MAP[fn_name](**fn_args)
                    tool_results.append({"tool": fn_name, "args": fn_args, "result": result})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": str(result),
                    })

                # 每步保存 Checkpoint
                checkpoint = AgentCheckpoint(
                    agent_id=agent_id,
                    step=step + 1,
                    messages=messages,
                    tool_results=tool_results,
                )
                self.store.save(checkpoint)

            except Exception as e:
                print(f"[错误] Step {step+1} 失败: {e}")
                print(f"[Checkpoint] Agent {agent_id} 的状态已保存，可恢复")
                return f"Agent 在 step {step+1} 失败: {e}。可用 agent_id={agent_id} 恢复。"

        self.store.delete(agent_id)
        return "达到最大步数限制。"

    def resume(self, agent_id: str) -> str:
        """从 Checkpoint 恢复执行"""
        checkpoint = self.store.load(agent_id)
        if not checkpoint:
            return f"未找到 agent_id={agent_id} 的 Checkpoint"
        # 用保存的 question 恢复
        question = checkpoint.messages[1]["content"]  # user message
        return self.run(question, agent_id)
```

### 使用示例

```python
store = CheckpointStore(backend="file")
agent = CheckpointAgent(store, max_steps=10)

# 第一次运行（可能中途失败）
result = agent.run("调研 ReAct 范式", agent_id="research_001")
# 输出：Agent 在 step 5 失败: API 503。可用 agent_id=research_001 恢复。

# 从 Checkpoint 恢复（API 恢复后）
result = agent.resume("research_001")
# 输出：[恢复] 从第 5 步恢复（loop index=4），已有 4 个工具结果
# ... 从失败步重试，继续执行 ...
```

> 本课采用**每步成功后**快照。若 Step 5 在工具执行中途失败，磁盘上仍是 Step 4 的 Checkpoint，恢复后会重跑整步（含 LLM）。步内细粒度恢复属于生产级增强，可在工具循环内增加中间保存。

### Checkpoint 的时机策略

```python
# 策略 1：每步保存（最安全，但 I/O 开销大）
for step in range(max_steps):
    execute_step()
    save_checkpoint()  # 每步都存

# 策略 2：每 N 步保存（平衡安全和性能）
for step in range(max_steps):
    execute_step()
    if step % 3 == 0:
        save_checkpoint()  # 每 3 步存一次

# 策略 3：关键节点保存（工具调用后存）
for step in range(max_steps):
    msg = call_llm()
    if msg.tool_calls:
        execute_tools()
        save_checkpoint()  # 工具调用后存（最值钱的状态）
```

**推荐**：策略 3——工具调用后保存。因为工具调用是最"值钱"的状态（重新调用要花钱和时间），而纯 LLM 推理可以从 messages 重建。

### 要点总结

- Checkpointing 让 Agent 从失败步骤恢复，而非从头来过
- 保存三样东西：messages（上下文）、tool_results（工具结果）、step（步数）
- 存储方案对比：内存（快、进程退出丢失）/ 文件 JSON（简单可持久）/ Redis 或 DB（多实例共享）；本课实现文件后端，`backend` 参数预留扩展
- 恢复时加载 Checkpoint → 从 `checkpoint.step`（下一待执行步，0-based）继续，重试失败步，不重复已完成工作
- 保存时机：推荐"工具调用后保存"——工具结果最值钱，纯推理可从 messages 重建
- 任务完成后删除 Checkpoint，避免存储泄漏
