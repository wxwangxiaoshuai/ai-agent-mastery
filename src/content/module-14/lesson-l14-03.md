## 参考架构案例拆解 II：Devin 与 Claude Code 的自主编程系统

L14-02 拆了编程"助手"——人主导，Agent 辅助。这一节拆更激进的——**自主编程 Agent**：Devin、Claude Code。它们不只是补全或按指令改代码，而是**接到任务后自主规划、执行、验证、修复**。自主性上来了，架构的挑战也变了：怎么让 Agent 自主又不失控。

### 自主编程 Agent vs 编程助手

先划清这一节拆的对象和 L14-02 的区别：

```
编程助手（Copilot/Cursor 辅助模式）：
  · 人主导：人写，Agent 补全/按明确指令改
  · 单步或浅多步：补全/一次编辑
  · 人全程审：每个改动人看
  · 失败边界：人发现错了就停

自主编程 Agent（Devin/Claude Code）：
  · Agent 主导：接到任务自己拆解执行
  · 深多步：规划→多轮编辑→测试→修复，可能几十步
  · 人部分介入：关键点审，不每步审
  · 失败边界：Agent 自己要能发现错并修，否则跑偏
```

**架构挑战的转变**：自主性越强，**可靠性工程**越关键。Agent 自主跑几十步，任何一步错都可能累积成大错——架构要保证"能发现错、能修、能停、能回滚"。这是 L14-02 的助手架构不用太担心的（人盯着），而这节的核心。

### Devin：规划→执行→验证→修复循环

Devin 是最早爆火的"AI 软件工程师"——给个需求，它自主完成。架构核心是一个**闭环**：

::interactive{type="devinArch"}

**架构关键点**：

**1. 规划层**：Devin 不是"上来就写代码"，而是先规划。这对应 M5 的 Plan-and-Execute——长任务先拆解，避免 ReAct 式的逐步发散。规划让它**有全局视野**，而非走一步看一步。

**2. 执行的工具链**：自主编程要操作整个开发环境——

```
Devin 的工具集（推测）：
  · 文件操作：读/写/改文件
  · 终端：执行 shell 命令（装依赖/跑构建/git）
  · 浏览器：查文档/搜索解决方案
  · 代码搜索：在仓库里找相关代码
```

这些工具都是 M6 讲过的——但 Devin 把它们组合成**一个完整开发环境**，Agent 在里面像人在用 IDE 一样工作。

**3. 验证-修复循环**：这是自主可靠性的核心。Agent 写完代码**自己跑测试**，失败就**自己看报错→改→再跑**。这个循环让 Agent **自我纠错**，而非靠人发现错。

**4. 长时程管理**：几十步的任务，要 checkpoint（M7）、要状态持久化、要能从中断恢复。Devin 的"会话"概念——任务可以跨时间延续，就是状态持久化的体现。

### Claude Code：工具链与沙箱策略

Claude Code 是 Anthropic 的命令行编程 Agent。架构上和 Devin 类似（自主编程），但有自己特点——**工具链设计精炼 + 沙箱策略明确**：

```
Claude Code 架构特点：
  1. 工具链精炼而非臃肿
     · 少而强的工具：文件读写、bash、搜索
     · 每个工具描述清晰（M6 工具设计原则）
     · 工具粒度适中（不像"改代码"那么粗，也不像"插入字符"那么细）

  2. 沙箱策略：分层信任
     · 读操作：相对宽松（读代码风险低）
     · 写操作：要确认/可见 diff（HITL，L10-03）
     · 执行命令：沙箱 + 用户可见 + 可中断（M9）

  3. 权限模型：最小权限
     · 默认只读 + 局部写
     · 危险操作（rm/git push）显式授权
     · 这是 L13-06 的最小权限在编程 Agent 的落地

  4. 上下文：codebase 感知
     · 类似 Cursor 的索引/检索（M4 RAG）
     · 但更强调"按需读"而非全量塞
```

**Claude Code 的架构决策亮点**：

| 决策 | 选择 | 理由 |
|------|------|------|
| 工具数量 | 少而精 | 工具多→模型选择难、决策噪声大（L06-02） |
| 写操作 | 要确认/diff 可见 | 自主写代码风险高，HITL 把关（L10-03） |
| 命令执行 | 沙箱+可见+可中断 | 命令执行不可逆风险，沙箱+可控（M9/L13-06） |
| 权限模型 | 默认最小，危险显式授权 | 最小权限原则（L13-06） |
| 长任务 | 会话状态持久化 | 长程任务要可恢复（M7 checkpoint） |

### 自主 Agent 的可靠性保障

自主编程 Agent 最难的不是"能写代码"，是"几十步里不跑偏、能纠错"。可靠性架构：

```
1. 自我验证（最重要）
   · 每步产出要能验证：写的代码跑测试、改的配置能加载
   · 不靠"我觉得写对了"，靠客观验证（测试/编译/类型检查）
   · 失败→进修复循环

2. 状态可恢复
   · checkpoint 每步状态（M7）
   · 失败/中断后从断点恢复，不从头
   · 长任务必备

3. 可回滚
   · 改动用 git 分支，错了能回滚
   · 不直接改主分支，改 feature 分支后合并

4. 步数上限与发散保护
   · recursion_limit（L10-02）防死循环
   · 修复循环 N 次还失败 → 放弃并报告，不无限重试

5. 人介入点
   · 关键操作（合并主分支、部署、删数据）暂停等人审（L10-03）
   · 不是每步审，是关键边界审
```

> 自主 ≠ 失控。自主 Agent 的架构核心是**给它自由度的同时埋好刹车**：自我验证发现错、状态恢复续跑、可回滚纠错、步数上限防发散、关键点人介入。没有这些刹车，自主 Agent 会变成"自信地跑偏"。

### 自主 Agent 的安全边界

自主编程 Agent 能跑命令、改文件——安全边界比助手严得多：

```
安全红线：
  · 不能碰生产环境：限制能访问的目录/仓库，不碰生产数据库
  · 不能乱发外部请求：网络白名单（只允许查文档/包管理）
  · 不能执行危险命令：rm -rf / git push --force 等要授权
  · 敏感数据不外泄：代码可能含密钥，执行输出要审查（L13-06 脱敏）
  · 提交要审：git commit 内容人审，防止注入诱导提交恶意代码
```

**和 L13-05 注入攻防的关系**：自主 Agent 读外部内容（查文档、装包）多，间接注入风险大。**不可信内容隔离**（L13-05）在自主 Agent 里更要严——查到的文档不能直接进能影响执行的上下文。

### Devin / Claude Code vs Copilot/Cursor：自主性谱系

把四个产品放自主性谱系上看，架构差异一目了然：

```
自主性谱系：
  Copilot补全 ◀────────────────────────────▶ Devin/Claude Code
  （人主导，被动辅助）                        （Agent主导，自主完成）

  Copilot  ←  Cursor辅助  ←  Cursor Agent  ←  Claude Code  ←  Devin
  补全       按指令改       多步编辑          自主+工具链     完全自主

架构重点随自主性变化：
  低自主性：延迟/上下文/补全准确率（L14-02 Copilot）
  高自主性：可靠性/安全/可恢复/自我验证（本节 Devin/Claude Code）
```

**关键洞察**：自主性越高，架构重点从"性能/质量"转向"可靠性/安全"。Copilot 担心的是"补全慢不慢、准不准"，Devin 担心的是"会不会自主跑偏、能不能纠错、安不安全"。**架构师的注意力要随产品定位的自主性调整**。

### 拆解启示：你要做的 Agent 在谱系哪端

回到你的实际——做 Agent 时先定位自主性：

```
你要做的 Agent 是？
├─ 辅助型（人主导，Agent补全/按指令）
│   → 架构重点：延迟、上下文、补全质量
│   → 像 Copilot/Cursor 辅助模式
│
├─ 半自主型（Agent多步执行，人审关键点）
│   → 架构重点：工具链、HITL、可回滚
│   → 像 Cursor Agent / Claude Code
│
└─ 高自主型（Agent自主规划执行，少人介入）
    → 架构重点：自我验证、状态恢复、安全边界、发散保护
    → 像 Devin
```

> 这就是 L14-01 决策框架的应用——先定产品在自主性谱系哪端，再决定架构重点。盲目上"最高自主"既贵又险，辅助型 Agent 用 Devin 的全套可靠性架构是过度工程；高自主 Agent 用 Copilot 的补全架构会失控。**匹配定位**。

### 实战：实现一个带自我验证的自主编程 Agent 骨架

理论讲完了，写一个最小可跑的自主编程 Agent。核心是**自我验证循环**——写完代码自己跑测试，失败就自己修：

```python
# autonomous_dev_agent.py —— 带自我验证的自主编程 Agent 骨架
import subprocess, json
from dataclasses import dataclass
from pathlib import Path

@dataclass
class DevStep:
    action: str
    path: str = ""
    content: str = ""
    result: str = ""
    success: bool = True

class AutonomousDevAgent:
    """自主编程 Agent——规划→执行→验证→修复循环。"""

    def __init__(self, work_dir: str = "./workspace",
                 max_steps: int = 20, max_retries: int = 3):
        self.work_dir = Path(work_dir)
        self.work_dir.mkdir(exist_ok=True)
        self.max_steps = max_steps
        self.max_retries = max_retries
        self.steps: list[DevStep] = []
        self.allowed_dir = self.work_dir.resolve()

    def execute(self, task: str) -> str:
        """执行编程任务，含自验证循环。"""
        plan = self._plan(task)
        print(f"规划：{len(plan)} 个步骤")

        for idx, action in enumerate(plan):
            if len(self.steps) >= self.max_steps:
                return self._summary("达到最大步数限制")

            step = self._execute(action)
            self.steps.append(step)

            if action.get("verify"):
                verified = False
                for retry in range(self.max_retries):
                    test_result = self._run_tests()
                    if test_result["passed"]:
                        verified = True
                        print(f"  步骤 {idx + 1} 验证通过")
                        break
                    print(f"  步骤 {idx + 1} 验证失败 ({retry + 1}/{self.max_retries})")
                    if retry < self.max_retries - 1:
                        fix = self._generate_fix(action, test_result)
                        self._execute(fix)

                if not verified:
                    return self._summary(f"验证失败，{self.max_retries} 次自动修复后仍不通过")

        return self._summary("任务完成")

    def _plan(self, task: str) -> list[dict]:
        """拆解任务（实际实现调用 LLM）。"""
        name = "".join(c if c.isalnum() else "_" for c in task[:30])
        return [
            {"action": "write_file", "path": f"src/{name}.py",
             "description": "核心实现", "verify": True},
            {"action": "write_file", "path": f"tests/test_{name}.py",
             "description": "测试文件", "verify": True},
        ]

    def _execute(self, action: dict) -> DevStep:
        """执行动作，带路径安全校验。"""
        path = action.get("path", "")
        if path:
            full = (self.work_dir / path).resolve()
            if not str(full).startswith(str(self.allowed_dir)):
                return DevStep(action=action.get("action", "unknown"),
                               path=path, result=f"安全阻断: {path}",
                               success=False)
            if action["action"] == "write_file":
                full.parent.mkdir(parents=True, exist_ok=True)
                full.write_text(action.get("content", "# TODO\n"))
                return DevStep(action="write_file", path=path,
                               result=f"已写入 {path}")
        return DevStep(action=action.get("action", "execute"),
                       result=f"执行: {action.get('action', '')}")

    def _run_tests(self) -> dict:
        """跑测试，返回结果。"""
        test_dir = self.work_dir / "tests"
        if not test_dir.exists() or not list(test_dir.glob("test_*.py")):
            return {"passed": True, "message": "无测试"}
        result = subprocess.run(
            ["python3", "-m", "pytest", str(test_dir), "-q"],
            capture_output=True, text=True, timeout=30,
            cwd=str(self.work_dir))
        return {"passed": result.returncode == 0,
                "message": result.stdout[-200:] if result.stdout else result.stderr[:200]}

    def _generate_fix(self, action: dict, test_result: dict) -> dict:
        """基于测试失败生成修复（实际由 LLM 生成）。"""
        return {"action": "write_file", "path": action.get("path", ""),
                "content": f"# 自动修复\n# 失败原因: {test_result['message'][:100]}\n"}

    def _summary(self, conclusion: str) -> str:
        lines = [f"\n{'='*50}", f"执行总结: {conclusion}",
                 f"总步数: {len(self.steps)}"]
        for i, s in enumerate(self.steps, 1):
            tag = "✓" if s.success else "✗"
            lines.append(f"  [{i}] {tag} {s.action}: {s.result[:60]}")
        return "\n".join(lines)


# ═══════════════════════════════════════════════════
# 安全边界——对应的就是本节讲的安全红线
# ═══════════════════════════════════════════════════

DANGEROUS_COMMANDS = ["rm -rf", "git push --force", "DROP TABLE",
                      "shutdown", "chmod 777"]

def safety_check_command(cmd: str) -> tuple[bool, str]:
    """检查命令是否危险。"""
    for d in DANGEROUS_COMMANDS:
        if d.lower() in cmd.lower():
            return False, f"危险命令被拦截: {d}"
    return True, ""

def safety_check_path(path: str, allowed: Path) -> tuple[bool, str]:
    """检查路径是否在允许范围内。"""
    resolved = Path(path).resolve()
    if not str(resolved).startswith(str(allowed.resolve())):
        return False, f"路径越界: {path}"
    return True, ""


if __name__ == "__main__":
    agent = AutonomousDevAgent(max_steps=10, max_retries=2)
    print(agent.execute("实现一个简单的计算器函数，支持加减乘除"))
```

**关键设计点与本节概念的对应**：

| 代码 | 对应概念 |
|------|---------|
| `_run_tests()` → `_generate_fix()` → 再跑测试 | **自我验证循环**——Devin 闭环的核心 |
| `safety_check_path()` + `allowed_dir` | **路径限制**——不能碰工作目录外的文件 |
| `DANGEROUS_COMMANDS` 黑名单 | **危险命令拦截**——`rm -rf` / `git push --force` 要授权 |
| `max_steps` + `max_retries` | **步数上限 + 发散保护**——防止无限循环 |

这个骨架加上 LLM 的 Function Calling，就是一个完整的自主编程 Agent 原型。


### 动手 5 分钟

给你的 Agent 在自主性谱系上定位，并画出它的安全边界。

1. 在"补全 → 按指令改 → 自主规划执行"这条谱系上标出你的 Agent 现在的位置和目标位置。
2. 每往右移一格，列出必须补齐的保障（验证闭环、回滚能力、审批节点、资源上限）。
3. 把上面的 `AutonomousDevAgent` 复制到你的项目中，跑一次看 self-verification 循环怎么工作。改一行代码故意让测试失败，看修复循环是否触发。
4. 挑其中一项保障现在就实现。

**验收标准**：你能说出你的 Agent 目前缺哪一项保障，以及在缺它的情况下不该把自主性再往右推。

### 要点总结

- 自主编程 Agent（Devin/Claude Code）vs 编程助手：Agent 主导深多步，架构重点从性能转向可靠性/安全
- Devin 闭环：规划→执行→验证→修复循环——自我验证纠错是自主可靠性核心
- Devin 工具链：文件/终端/浏览器/代码搜索组合成完整开发环境，Agent 像 IDE 里的人
- Claude Code：工具链精炼(少而强)、写操作要确认(HITL)、命令沙箱可见可中断、最小权限模型
- 可靠性五刹车：自我验证、状态可恢复(checkpoint)、可回滚(git)、步数上限防发散、关键点人介入
- 自主 ≠ 失控：架构核心是给自由度同时埋刹车——没有这些，自主 Agent 是"自信地跑偏"
- 安全边界：限目录/网络白名单/危险命令授权/输出审查/提交人审——间接注入风险大要隔离
- 自主性谱系：Copilot补全←Cursor←Claude Code←Devin；自主越高架构重点越偏向可靠性/安全
- 架构师注意力随自主性调整：低自主重性能质量，高自主重可靠安全——盲目上最高自主既贵又险
- 下一节 L14-04：搜索型 vs 对话型 Agent（Perplexity/ChatGPT）的架构对比
