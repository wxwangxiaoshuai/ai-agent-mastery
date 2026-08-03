## 安全代码沙箱服务

M9 四节课讲了代码执行全景、Docker 沙箱、云端沙箱、安全审计。P9 把它们组装成一个**独立的代码执行沙箱微服务**——任何 Agent 都能通过统一 HTTP API 调用它，获得"Docker 隔离 + 资源限制 + 注入防护 + 输出审查 + 执行审计"的全套安全能力，而不必各自重复造轮子。

### 项目目标

构建一个独立代码执行沙箱微服务：
- Docker 容器隔离（namespace + cgroup + 只读文件系统）
- CPU/内存/网络/磁盘/进程资源限制
- 代码注入防护（AST + LLM 审查）
- 输出内容审查与脱敏
- 执行审计日志与异常告警
- 统一 HTTP API + Python SDK 封装
- 配套压力测试与安全审计报告

### 验收标准

- [ ] 通过 `POST /exec` 提交代码，返回 stdout/stderr/exit_code
- [ ] Docker 沙箱断网、非 root、只读根、cap_drop 生效
- [ ] 资源限制生效：内存超限 OOM、死循环超时被杀、fork 炸弹被 pids_limit 拦
- [ ] 代码注入防护：`os.system`/`eval` 等被 AST 拦截，伪装代码被 LLM 审查拦
- [ ] 输出审查：代码 `print(os.environ)` 后返回 [REDACTED]
- [ ] 审计日志记录每次执行的 user/code_hash/资源/结果
- [ ] 异常模式（高频/OOM/被拦）触发告警
- [ ] SDK：`sandbox.exec(code)` 一行调用
- [ ] 含压力测试脚本（并发/资源攻击/注入攻击）
- [ ] 含安全审计报告（覆盖各项验证）

### 架构总览

```
┌──────────────────────────────────────────────────┐
│          代码沙箱微服务 (FastAPI)                 │
│                                                   │
│  POST /exec {user_id, code}                       │
│       │                                           │
│       ▼                                           │
│  ┌──────────────────────────────────────────┐     │
│  │  安全管道 (L09-04)                        │     │
│  │  1. AST 静态检查 → 拦危险调用             │     │
│  │  2. LLM 语义审查 → 拦伪装注入             │     │
│  │  3. Docker 沙箱执行 (L09-02)              │     │
│  │     · 断网/非root/只读/cgroup 限制        │     │
│  │  4. 输出审查 → 密钥/PII 脱敏              │     │
│  └────────────────────┬─────────────────────┘     │
│                       │                           │
│       ┌───────────────┼───────────────┐           │
│       ▼               ▼               ▼           │
│  审计日志        异常告警         压力测试        │
│  (AuditLogger)   (Alert)          (load_test)     │
└──────────────────────────────────────────────────┘
        ▲
        │ SDK 封装
   Agent / 用户
```

### 实施步骤

**Step 1：Docker 沙箱执行器（复用 L09-02）**

```python
# sandbox/executor.py
import docker, tarfile, io, time, hashlib, uuid
from datetime import datetime

client = docker.from_env()
SANDBOX_IMAGE = "python:3.12-slim"

def run_sandboxed(code: str, timeout: int = 10, mem: str = "256m") -> dict:
    """Docker 沙箱执行（L09-02 全套旋钮）"""
    container = client.containers.create(
        image=SANDBOX_IMAGE,
        command=["python", "-c", code],
        detach=True,
        network_mode="none",          # 断网
        mem_limit=mem, memswap_limit=mem,  # 禁 swap 绕过
        cpu_quota=50000,              # 50% 单核
        pids_limit=50,               # 防 fork 炸弹
        user="nobody",                # 非 root
        read_only=True,              # 根只读
        tmpfs={"/tmp": "size=10m,mode=1777"},
        security_opt=["no-new-privileges"],
        cap_drop=["ALL"],
        working_dir="/tmp",
    )
    start = time.time()
    peak_mem = 0
    try:
        container.start()
        result = container.wait(timeout=timeout)
        # 采样内存峰值（执行结束后采，cgroup v1 用 max_usage，v2 用 usage）
        try:
            stats = container.stats(stream=False)
            mem = stats["memory_stats"]
            peak_mem = (mem.get("max_usage") or mem.get("usage", 0)) // (1024 * 1024)
        except Exception:
            pass
        return {
            "exit_code": result["StatusCode"],
            "stdout": container.logs(stdout=True, stderr=False).decode(errors="replace"),
            "stderr": container.logs(stdout=False, stderr=True).decode(errors="replace"),
            "duration_ms": int((time.time()-start)*1000),
            "peak_memory_mb": peak_mem,
        }
    except Exception as e:
        try: container.kill()
        except Exception: pass
        return {"exit_code": -1, "stdout":"", "stderr":f"执行失败: {e}",
                "duration_ms": int((time.time()-start)*1000), "peak_memory_mb": 0}
    finally:
        container.remove(force=True)  # 用完即弃
```

**Step 2：安全管道（复用 L09-04）**

```python
# sandbox/security.py
import ast, re, json, hashlib
from openai import OpenAI
client = OpenAI()

DANGEROUS = {"os.system","os.popen","os.exec","subprocess.run","subprocess.call",
             "subprocess.Popen","eval","exec","compile","__import__","os.spawn"}

def check_ast(code: str) -> tuple[bool, str]:
    """AST 静态检查"""
    try: tree = ast.parse(code)
    except SyntaxError as e: return False, f"语法错误: {e}"
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            fn = node.func
            if isinstance(fn, ast.Attribute) and isinstance(fn.value, ast.Name):
                if f"{fn.value.id}.{fn.attr}" in DANGEROUS:
                    return False, f"禁止调用: {fn.value.id}.{fn.attr}"
            if isinstance(fn, ast.Name) and fn.id in DANGEROUS:
                return False, f"禁止调用: {fn.id}"
    return True, "通过"

def llm_review(code: str) -> tuple[bool, str]:
    """LLM 语义审查（独立调用，防上下文污染）"""
    prompt = ("你是代码安全审查员。判断代码是否可安全执行。检测：网络外连、"
              "敏感文件读写、动态执行(eval/exec/getattr拼接)、进程派生、"
              "密钥读取、与任务无关的可疑代码。\n"
              '输出JSON: {"safe":bool,"reason":"...","risk":"low|medium|high"}\n代码:\n' + code)
    r = client.chat.completions.create(
        model="gpt-4.1-mini", messages=[{"role":"user","content":prompt}],
        temperature=0, response_format={"type":"json_object"})
    d = json.loads(r.choices[0].message.content)
    return (d["risk"] != "high" and d["safe"]), d["reason"]

SENSITIVE = [
    (r"AKIA[0-9A-Z]{16}", "AWS密钥"),
    (r"sk-[a-zA-Z0-9]{48}", "OpenAI密钥"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub Token"),
    (r"(?:\d{1,3}\.){3}\d{1,3}", "IP地址"),
]
def review_output(stdout: str, stderr: str) -> tuple[str, str, list]:
    """输出审查脱敏（stdout/stderr 都要处理，防密钥从 stderr 绕过）"""
    findings = []
    out = stdout + stderr
    for pat, name in SENSITIVE:
        if re.search(pat, out):
            findings.append(f"输出含疑似{name}")
    clean_out, clean_err = stdout, stderr
    for pat, _ in SENSITIVE:
        clean_out = re.sub(pat, "[REDACTED]", clean_out)
        clean_err = re.sub(pat, "[REDACTED]", clean_err)
    return clean_out, clean_err, findings
```

**Step 3：审计与告警**

```python
# sandbox/audit.py
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict

@dataclass
class AuditRecord:
    exec_id: str; user_id: str; code_hash: str
    code_preview: str; started_at: str
    duration_ms: int = 0; exit_code: int = 0
    peak_memory_mb: int = 0
    output_blocked: bool = False
    block_reasons: list = field(default_factory=list)

class AuditLogger:
    def __init__(self):
        self.logs = []
        self._hourly = defaultdict(int)   # user_id -> 计数
    def record(self, r: AuditRecord):
        self.logs.append(r.__dict__)
        self._detect(r)
    def _detect(self, r: AuditRecord):
        hour = r.started_at[:13]   # 到小时
        key = (r.user_id, hour)
        self._hourly[key] += 1
        if r.output_blocked:
            self._alert(f"执行{r.exec_id} 输出被拦: {r.block_reasons}")
        if r.exit_code == 137:
            self._alert(f"执行{r.exec_id} OOM，疑似资源攻击")
        if r.exit_code == -1:
            self._alert(f"执行{r.exec_id} 超时")
        if self._hourly[key] > 50:
            self._alert(f"用户{r.user_id} 高频执行: {self._hourly[key]}次/小时")
    def _alert(self, msg): print(f"[ALERT] {msg}")
```

**Step 4：组装微服务（FastAPI）**

```python
# sandbox/service.py
from fastapi import FastAPI
from pydantic import BaseModel
import hashlib, uuid
from datetime import datetime
from .executor import run_sandboxed
from .security import check_ast, llm_review, review_output
from .audit import AuditRecord, AuditLogger

app = FastAPI(title="代码沙箱服务")
audit_log = AuditLogger()

class ExecRequest(BaseModel):
    user_id: str
    code: str
    timeout: int = 10

@app.post("/exec")
def exec_code(req: ExecRequest):
    eid = str(uuid.uuid4())[:8]
    record = AuditRecord(
        exec_id=eid, user_id=req.user_id,
        code_hash=hashlib.sha256(req.code.encode()).hexdigest()[:16],
        code_preview=req.code[:200], started_at=datetime.now().isoformat())

    # 第一层：AST 检查
    ok, msg = check_ast(req.code)
    if not ok:
        record.exit_code = -2; record.output_blocked = True
        record.block_reasons = [msg]; audit_log.record(record)
        return {"error": f"代码被拦截: {msg}"}

    # 第二层：LLM 审查
    ok, msg = llm_review(req.code)
    if not ok:
        record.exit_code = -2; record.output_blocked = True
        record.block_reasons = [msg]; audit_log.record(record)
        return {"error": f"审查未通过: {msg}"}

    # 第三层：沙箱执行
    r = run_sandboxed(req.code, timeout=req.timeout)
    record.duration_ms = r["duration_ms"]
    record.exit_code = r["exit_code"]
    record.peak_memory_mb = r["peak_memory_mb"]

    # 第四层：输出审查
    clean_out, clean_err, findings = review_output(r["stdout"], r["stderr"])
    if findings:
        record.output_blocked = True; record.block_reasons = findings

    audit_log.record(record)
    return {"exec_id": eid, "exit_code": r["exit_code"],
            "stdout": clean_out, "stderr": clean_err,
            "duration_ms": r["duration_ms"], "findings": findings}

@app.get("/health")
def health(): return {"status": "ok"}
```

**Step 5：Python SDK 封装**

```python
# sandbox/sdk.py
import requests

class SandboxClient:
    """统一 SDK：屏蔽底层是 Docker 还是云端"""
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base = base_url
    def exec(self, code: str, user_id: str = "default", timeout: int = 10) -> dict:
        r = requests.post(f"{self.base}/exec", json={
            "user_id": user_id, "code": code, "timeout": timeout}, timeout=timeout+5)
        return r.json()

# 用法
sb = SandboxClient()
print(sb.exec("print(sum(range(101)))"))
# {'exit_code':0, 'stdout':'5050\n', ...}
```

**Step 6：压力测试与安全验证脚本**

```python
# tests/test_sandbox.py
import pytest
from sandbox.sdk import SandboxClient
sb = SandboxClient()

class TestSafety:
    def test_normal_exec(self):
        r = sb.exec("print(1+1)")
        assert r["exit_code"] == 0 and "2" in r["stdout"]

    def test_os_system_blocked(self):
        r = sb.exec("import os\nos.system('echo hacked')")
        assert "拦截" in r.get("error", "") or r["exit_code"] != 0

    def test_eval_blocked(self):
        r = sb.exec("eval('__import__(\"os\").system(\"id\")')")
        assert "拦截" in r.get("error", "")

    def test_memory_bomb_oom(self):
        r = sb.exec("x='A'*(10**9)")
        assert r["exit_code"] == 137   # OOM Killed

    def test_timeout_killed(self):
        r = sb.exec("while True: pass", timeout=2)
        assert r["exit_code"] in (-1, 137)

    def test_fork_bomb_limited(self):
        r = sb.exec("import os\nwhile True: os.fork()", timeout=3)
        assert r["exit_code"] != 0   # 被 pids_limit 限制

    def test_no_network(self):
        r = sb.exec("import urllib.request\nurllib.request.urlopen('http://example.com')")
        assert r["exit_code"] != 0   # 断网

    def test_output_redaction(self):
        r = sb.exec("print('AWS key: AKIAIOSFODNN7EXAMPLE')")
        assert "AKIA" not in r["stdout"]
        assert "REDACTED" in r["stdout"]
```

```python
# scripts/load_test.py —— 并发压力
import concurrent.futures
from sandbox.sdk import SandboxClient
sb = SandboxClient()
def one(_): return sb.exec("print(sum(range(1000)))")["exit_code"]
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as p:
    results = list(p.map(one, range(100)))
print(f"并发100次，成功{sum(1 for r in results if r==0)}次")
```

**Step 7：安全审计报告（产出物）**

```
安全审计报告 (sandbox_audit_report.md)

| 验证项 | 攻击向量 | 预期 | 实测 | 结果 |
|--------|---------|------|------|------|
| AST拦截 | os.system | 拒绝 | 拦截 | ✅ |
| AST拦截 | eval/exec | 拒绝 | 拦截 | ✅ |
| LLM审查 | getattr(os,'sys'+'tem') | 拦截 | 拦截 | ✅ |
| 内存限制 | 分配1GB | OOM | exit=137 | ✅ |
| CPU限制 | 死循环 | 超时 | exit≠0 | ✅ |
| 进程限制 | fork炸弹 | 限制 | exit≠0 | ✅ |
| 网络隔离 | 外连 | 失败 | exit≠0 | ✅ |
| 输出脱敏 | 打印密钥 | 脱敏 | [REDACTED] | ✅ |
| 审计日志 | 全量记录 | 有 | 有 | ✅ |
| 异常告警 | 高频调用 | 告警 | 触发 | ✅ |

结论：上表为**报告模板**（需自行跑测填写 ✅/❌），勿直接当作实测结果。
```

### 进阶挑战

1. **云端沙箱后端**：给 `run_sandboxed` 加 E2B 后端，用配置切换 Docker/云端（统一 API 已铺好路）
2. **预热池**：预起 N 个就绪容器，`docker exec` 复用，把延迟从秒级降到百毫秒
3. **多语言支持**：支持 Python/Node/Go，按 `language` 字段选镜像
4. **流式输出**：长任务用 SSE 流式返回 stdout，而非等结束一次性给
5. **持久会话**：一个 Agent 会话复用同一沙箱（带状态），配超时回收
6. **配额与计费**：按 user_id 限频、限额，对接计费系统

### 要点回顾

- 沙箱服务 = 执行器(L09-02) + 安全管道(L09-04) + 审计 + 统一 API
- 纵深防御管道：AST 检查 → LLM 审查 → Docker 沙箱 → 输出审查 → 审计告警
- 每层独立兜底：任一单点被突破不致沦陷，AST 快筛省 LLM 成本
- Docker 旋钮全套：断网/非root/只读/cap_drop/mem+memswap/cpu/pids，缺一有风险
- 输出审查不可少：执行"成功"不代表输出安全，密钥/PII 要返回前脱敏
- 审计监控攻击模式：高频试探、频繁 OOM、被拦多次——行为本身比单次更该告警
- 统一 API + SDK 屏蔽底层：Docker 或云端可切换，Agent 只管调 `exec(code)`
- 安全审计报告：9 项验证全绿才敢称生产级，本服务的基线证明

### 下一步

完成 P9 后，你的 Agent 有了"安全动手执行代码"的能力。M10「Agent 框架与编排」进入框架时代——LangGraph、CrewAI 用状态机和角色分工表达复杂控制流，让 Agent 从"手写循环"升级到"可维护的编排"。
