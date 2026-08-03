## Agent 代码执行全景：解释器、REPL、沙箱方案对比

M6 给 Agent 装了"手"——调用外部 API。但有一类工具特别强大也特别危险：**让 Agent 自己写代码、自己跑代码**。能执行代码的 Agent 才能做数据分析、写脚本、自动化运维——这是从"会聊天"到"会干活"的跨越。但让 AI 执行任意代码，等于把一台机器的完整控制权交给了一个可能产生幻觉的系统。这一节先把"代码执行"这件事的全景画清楚。

### 为什么 Agent 需要执行代码

先理解代码执行能解决什么——它和普通工具调用有什么本质区别。

```
普通工具调用（M6）：调用一个预定义的 API
  Agent → search("天气") → "北京 25 度"
  · 能力边界 = 你预先写好的工具集
  · 灵活但受限——遇到没预料的需求就抓瞎

代码执行：Agent 自己写代码并运行
  Agent → 写一段 pandas 代码 → 读取 CSV → 分析 → 输出图表
  · 能力边界 = 整个编程语言生态（近乎无限）
  · 极灵活但极危险——它能干任何代码能干的事
```

**关键洞察**：代码执行是"元工具"——它不是给你调用某个功能，而是**让 Agent 自己创造功能**。数据清洗、统计分析、文件批处理、调用任意第三方库……这些用预定义工具根本覆盖不完，代码执行一招通吃。

### 代码执行的典型场景

| 场景 | Agent 做什么 | 代码执行的价值 |
|------|-------------|----------------|
| 数据分析 | 读 CSV、算统计量、画图 | pandas/matplotlib 直接用，不必封装成 API |
| 自动化运维 | 批量改配置、重启服务 | 写 shell 脚本执行，灵活应对各种边缘情况 |
| 算法验证 | 写排序算法、跑测试 | 算法题、原型验证的天然场景 |
| 文件处理 | 批量重命名、格式转换 | 写循环脚本，比逐个 API 调用高效 |
| 数学计算 | 精确大数运算、符号推导 | Python 精确算 `2**100`，而 LLM 直接"想"会算错 |

> 最后一条尤其重要：**LLM 做算术天生不可靠**（它是在"预测下一个 token"而非真算）。涉及精确计算，让 Agent 写代码跑，远比让它"心算"靠谱。这是代码执行最该被使用的场景之一。

### 代码执行在 Agent 循环中的位置

把代码执行嵌入 M5 的 Agent Loop，它就是一个特殊的"工具"：

```
Agent Loop（ReAct）：
  Thought:  我需要计算这列数据的均值
  Action:   execute_code("import pandas as pd\ndf=pd.read_csv('d.csv')\nprint(df['x'].mean())")
  Observation: 42.5
  Thought: 均值是 42.5，现在我可以继续分析了...
```

**和普通工具的差异**：普通工具的"参数"是结构化数据（查询词、ID），代码执行的"参数"是**一段代码字符串**。这意味着模型不仅要决定"调不调"，还要"写出正确的代码"——这对模型的编程能力要求更高，也更容易出错（语法错、逻辑错、依赖缺失）。

### 执行方案谱系：从最危险到最安全

让 Agent 跑代码，跑在哪？安全等级从低到高（工具调用基础见 L06-01 Function Calling——代码执行本质是一种特殊工具）：

```
危险 ◀─────────────────────────────────────────▶ 安全
                                                       
  直接 eval    subprocess    Docker 沙箱    云端沙箱    无代码（受限DSL）
  ─────────┼──────────┼──────────────┼──────────┼──────────────
  零隔离      进程隔离     容器隔离        VM级隔离     只允许白名单操作
  最快最危险   中等          生产常用        最强最贵     最安全但最受限
```

**安全等级越高，隔离越强，但开销（启动时间、资源）越大**。这是贯穿全模块的核心权衡。下面逐个拆。

### 方案一：直接 eval / exec（最危险，仅限 demo）

直接在 Agent 进程里执行模型生成的代码：

```python
# 极度危险，仅用于理解原理，生产绝不可用
def dangerous_exec(code: str):
    exec(code)  # 共享 Agent 进程的文件系统、网络、权限

dangerous_exec("""
import os
os.system("echo pwned")   # 真实危害：能执行任意 shell
""")
```

有人以为「清空 builtins 就安全」：

```python
# 仍危险：空 builtins 挡不住常见沙箱逃逸，且下面的 import 示例会直接 ImportError
# 不要把「限制 builtins」当成可用沙箱
exec(code, {"__builtins__": {}})
# 逃逸手法示意（勿在生产依赖）：().__class__.__mro__[1].__subclasses__() ...
```

**为什么危险**：`exec` 跑在 Agent 自己的进程里。模型一旦"幻觉"出恶意代码（或被注入），整个宿主机沦陷。限制 `__builtins__` 也防不住——Python 的沙箱逃逸是出了名的容易。

> 结论：**直接 exec 是反面教材**。它出现在这里只是为了让你知道"底线有多低"，以及理解为什么后面所有方案都在想办法隔离。

### 方案 1.5：REPL / 交互式解释器

REPL（如 `python -i`、Jupyter kernel）适合人类探索，**不适合作为 Agent 生产执行面**：会话状态会跨请求污染、难统一超时/资源上限、安全边界模糊。Agent 通常用「一次性 subprocess / 容器」而非长生命周期 REPL；若需要多步状态，应显式管理沙箱生命周期（见 L09-03 长会话），而不是开一个裸 REPL。

### 方案二：subprocess + 受限环境

起一个子进程跑代码，比 exec 强一点——至少主进程不被直接污染：

```python
import subprocess, tempfile, os, sys, shutil

def subprocess_exec(code: str, timeout: int = 10) -> str:
    sandbox_dir = tempfile.mkdtemp(prefix="sandbox_")
    with tempfile.NamedTemporaryFile(
        "w", suffix=".py", delete=False, dir=sandbox_dir,
    ) as f:
        f.write(code)
        script = f.name
    try:
        result = subprocess.run(
            [sys.executable, script],
            capture_output=True, text=True, timeout=timeout,
            env={"PATH": "/usr/bin:/bin", "HOME": sandbox_dir},
            cwd=sandbox_dir,
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return f"[错误] 代码执行超时 ({timeout}s)"
    finally:
        os.unlink(script)
        shutil.rmtree(sandbox_dir, ignore_errors=True)
```

**比 exec 好在哪**：代码在子进程跑，主进程崩溃不影响；有 timeout；能控制工作目录和环境变量。

**仍然不够**：子进程和宿主机**共享内核、文件系统、网络**。`os.system("rm -rf ~")` 照样有效，`open("/etc/passwd")` 照样能读。隔离的是"进程"，不是"系统资源"。

### 方案三：Docker 沙箱（生产常用，L09-02 详讲）

把代码跑在一个 Docker 容器里——容器有自己的文件系统、网络栈、用户权限，和宿主机强隔离：

```
┌─────── 宿主机 ───────────────────────────┐
│  Agent 进程                                │
│    ↓ docker run                           │
│  ┌──── Docker 容器（沙箱）────────────┐    │
│  │  独立文件系统（临时，用完即弃）      │    │
│  │  独立网络栈（可断网）               │    │
│  │  受限用户（非 root）                │    │
│  │  cgroup 资源限制（CPU/内存上限）     │    │
│  │  → 跑用户代码                        │    │
│  └─────────────────────────────────────┘    │
│  宿主机文件系统/网络：容器默认看不到       │
└────────────────────────────────────────────┘
```

**为什么 Docker 够用**：容器的 namespace 隔离了进程视图（它看不到宿主机其他进程），cgroup 限制了资源（吃不掉宿主机内存），overlay 文件系统让容器改动不污染宿主机。**性价比极高**——隔离强度远超 subprocess，开销远小于完整 VM。

**局限**：容器和宿主机**共享内核**。内核漏洞（容器逃逸）理论上能让恶意代码突破到宿主机。所以仍要配合"非 root 运行 + 最小权限 + 最新内核"等多层防御。

### 方案四：云端沙箱（L09-03 详讲）

不想自己运维 Docker？把沙箱做成服务，按需调用：

```python
# E2B 示例（L09-03 详讲；需 pip install e2b-code-interpreter）
from e2b_code_interpreter import Sandbox

with Sandbox.create() as sb:
    execution = sb.run_code("import pandas as pd\nprint(pd.__version__)")
    print("".join(execution.logs.stdout))
# 代码跑在 E2B 的云端微 VM 里，和你本机完全隔离
```

**优势**：VM 级隔离（比容器更强，独立内核）、零运维、按用量付费、可水平扩展。
**代价**：依赖外部服务（延迟、可用性、数据出境合规）、成本随用量涨。

### 方案五：受限 DSL / 无代码（最安全但最受限）

不让 Agent 写任意代码，只允许它在**预定义的、安全的操作集**里组合：

```python
# 不执行任意代码，只允许调用"安全原语"
SAFE_OPS = {
    "sum": lambda data: sum(data),
    "mean": lambda data: sum(data)/len(data),
    "sort": lambda data: sorted(data),
}

def safe_execute(op_name: str, data):
    if op_name not in SAFE_OPS:
        raise ValueError(f"不允许的操作: {op_name}")
    return SAFE_OPS[op_name](data)

safe_execute("mean", [1,2,3])  # 2.0
# safe_execute("__import__('os').system('rm -rf /')", [])  # 直接拒绝
```

**最安全**——根本没"执行任意代码"这个能力，注入无从谈起。
**最受限**——Agent 的能力被锁死在白名单里，遇到白名单外的需求就无能为力。

> 什么时候选 DSL？当你的场景**足够窄且固定**（如只做表格统计），不值得承担任意代码的风险时。一旦需求"灵活多变"，DSL 就不够用，必须上真沙箱。

### 五方案对比总表

| 方案 | 隔离强度 | 启动延迟 | 成本 | 灵活性 | 适用场景 |
|------|---------|---------|------|--------|---------|
| exec/eval | 无 | 最快 | 低 | 满血 | 仅 demo，生产禁用 |
| subprocess | 进程级 | 快 | 低 | 满血 | 低风险内部场景 |
| Docker 沙箱 | 容器级 | 秒级 | 中 | 满血 | 生产主力方案 |
| 云端沙箱 | VM 级 | 秒级 | 按量付费 | 满血 | 不想运维/需强隔离 |
| 受限 DSL | 不执行代码 | 即时 | 最低 | 受限 | 窄且固定的场景 |

**没有"最好"的方案，只有"匹配场景"的方案**。多数生产级代码执行 Agent 选 Docker 沙箱（够强、可控、成本合理），辅以云端沙箱应对高峰或强隔离需求。

### 选型决策树

```
你的场景需要执行任意代码吗？
├─ 否，只需固定几类操作 → 受限 DSL（最安全）
└─ 是，需要灵活性
    │
    ├─ 能接受自己运维 Docker 吗？
    │   ├─ 能，且数据不能出境 → Docker 沙箱（L09-02）
    │   └─ 不能/不想运维 → 云端沙箱（L09-03）
    │
    └─ 内部可信环境、低风险？→ subprocess（够用即可）

无论选哪个，都必须叠加 L09-04 的安全审计：注入防护 + 输出审查 + 资源审计
```

> 关键认知：**隔离只是第一道防线**。哪怕用了 Docker，仍要做输入注入防护（防止 Agent 被诱导写恶意代码）、输出审查（防止结果里夹带敏感信息）、资源审计（监控异常调用）。安全是纵深防御，不是单点。后续三节分别落地 Docker（L09-02）、云端（L09-03）、安全审计（L09-04）。

### 动手 5 分钟

亲手体会一次"没有沙箱有多可怕"——在一次性容器里做。

1. 在一个可以随时销毁的容器里写一个 `exec()` 版执行器。
2. 让它跑三段代码：读 `~/.ssh` 目录、发一个外网请求、`while True: pass`。
3. 记录三者分别造成了什么后果。

**验收标准**：你能列出至少五个必须封堵的能力（文件系统、网络、进程、资源、时间），这份清单就是下一节配置 Docker 旋钮的依据。**务必在一次性环境里做，不要在你的主机上跑。**

### 要点总结

- 代码执行是"元工具"——让 Agent 自己创造功能，能力近无限，但风险也最大
- 最该用的场景之一：精确计算——LLM 心算不可靠，写代码跑才靠谱
- 在 Agent Loop 里它是"参数为代码字符串"的特殊工具，对模型编程能力要求更高
- 方案谱系（弱→强隔离）：exec → subprocess → Docker → 云端沙箱 → 受限 DSL
- Docker 沙箱是生产主力——namespace 隔离视图、cgroup 限资源、overlay 文件系统，性价比最高
- 云端沙箱（E2B 等）VM 级隔离、零运维，但依赖外部、有数据出境合规问题
- 受限 DSL 最安全但最受限——场景窄且固定时才选
- 隔离只是第一道防线，必须叠加 L09-04 的注入防护+输出审查+资源审计（纵深防御）
- 后续：L09-02 Docker 实战 → L09-03 云端沙箱 → L09-04 安全审计
