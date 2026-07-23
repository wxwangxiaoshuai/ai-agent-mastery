## 生产级 Agent 部署与运维基线

M15 六节课讲了生产架构、三角优化、监控告警、故障应急、灰度发布、产品 UX。P15 把它们组装成一套**生产级 Agent 部署与运维基线**——把你此前做的 Agent（如 P5/P7/P10/P13）部署到生产环境，搭完整的基础设施+监控+灰度+运维手册，并做一次故障注入演练。这是 Agent "能部署"到"能运维"的收尾工程。

### 项目目标

将既有 Agent 项目部署到生产环境，搭建运维基线：
- 生产部署架构（网关+队列+缓存+限流）
- 监控告警仪表盘与 SLA 定义
- 灰度发布与一键回滚流程
- 运维手册与故障应急预案
- 故障注入演练报告

### 验收标准

- [ ] Agent 服务容器化部署，多副本水平扩展（无状态化）
- [ ] API 网关前置：认证/限流/路由
- [ ] 慢任务异步队列（如研究 Agent 入队）
- [ ] 语义缓存接入，命中率可观测
- [ ] 并发限流（网关层 + LLM API 容量层）
- [ ] 监控仪表盘四类指标（性能/成本/行为/质量）+ SLA 状态
- [ ] 告警规则配置，分级通知链路
- [ ] 灰度发布流程（三维独立灰度 + 一键回滚）
- [ ] 运维手册：部署/扩容/故障应急 SOP
- [ ] 故障应急预案：各级降级预案
- [ ] 故障注入演练报告：注入故障验证韧性

### 架构总览

```
┌─────────────── 生产部署架构 ────────────────────────┐
│                                                      │
│  用户 → [API网关] 认证/限流/路由/计费                 │
│           │                                          │
│      ┌────┴─────┐                                    │
│      ▼          ▼                                    │
│  [语义缓存]  [同步Agent服务] (Deployment多副本)       │
│  命中返回    ↑ 流式秒级                               │
│      │miss  │                                        │
│      └──→    │ 慢任务                                 │
│             ▼                                        │
│        [异步队列] ←─────                              │
│             │                                        │
│        [Worker池] (按队列积压扩缩)                     │
│             │                                        │
│             ▼                                        │
│        LLM API / 工具 (限流+降级保护)                 │
│                                                      │
│  ─── 监控/发布/运维 套层 ───                          │
│  [Prometheus+Grafana] 四类指标+SLA仪表盘             │
│  [告警] 分级通知链路                                  │
│  [灰度] 三维独立灰度+一键回滚                         │
│  [运维手册] 部署/扩容/应急SOP                         │
│  [故障注入] 混沌演练                                  │
└──────────────────────────────────────────────────────┘
```

### 实施步骤

**Step 1：容器化与无状态化（L14-05 + L15-01）**

```dockerfile
# Dockerfile：Agent 服务镜像
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Agent 无状态：状态全存外部（DB/Redis/向量库），本机不留
CMD ["uvicorn", "agent_service:app", "--host", "0.0.0.0", "--port", "8000"]
```

```python
# 无状态 Agent：状态全外部（L14-05）
class StatelessAgent:
    def run(self, tenant_id, user_id, question):
        # 每次从外部加载状态，本机不存
        history = load_history_from_redis(tenant_id, user_id)
        memory = memory_store.recall(tenant_id, user_id, question)
        result = self._llm(history, memory, question)
        save_history_to_redis(tenant_id, user_id, result)  # 写回外部
        return result
```

**Step 2：API 网关（L15-01）**

```python
# gateway.py（或用 Kong/APISIX 配置）
from fastapi import FastAPI, Request, HTTPException
app = FastAPI()

@app.post("/agent/run")
async def gateway(req: Request):
    # 1. 认证
    user = auth(req)
    if not user:
        raise HTTPException(status_code=401, detail="未认证")
    # 2. 限流（令牌桶，按租户/用户）
    if not rate_limiter.allow(user.id):
        raise HTTPException(status_code=429, detail="Too Many Requests")
    body = await req.json()
    # 3. 计费/日志（同步/异步路径都要记）
    log_access(user, body)
    # 4. 路由：慢任务入队，快请求直达
    if is_long_task(body["question"]):
        task = long_task.delay(body["question"], user.id)
        return {"task_id": task.id, "status": "queued"}
    # 5. 转发 Agent 服务
    return route_to_agent_service(body, user)
```

**Step 3：异步队列（L15-01）**

```python
# queue.py（Celery + Redis）
from celery import Celery
app = Celery("agent", broker="redis://redis:6379", backend="redis://redis:6379")

@app.task(bind=True, max_retries=3)
def long_task(self, question, user_id):
    """慢任务异步执行，失败重试（M7）"""
    try:
        agent = ResearchAgent()
        result = agent.run(question)
        notify_user(user_id, result)   # 完成通知
        return result
    except Exception as e:
        raise self.retry(exc=e, countdown=60)  # 1分钟后重试
```

**Step 4：语义缓存 + 限流（L15-01）**

```python
# cache.py
class RateLimitError(Exception):
    pass

class SemanticCache:
    def __init__(self, threshold=0.95):
        self.store = redis_client  # 生产用向量库
        self.threshold = threshold
    def get(self, question, tenant_id):
        if is_time_sensitive(question) or is_personalized(question):
            return None   # 时效/个性化不缓存
        # 相似度命中
        return find_similar(question, tenant_id, self.threshold)
    def set(self, question, answer, tenant_id, ttl=3600):
        key = f"{tenant_id}:{hash_question(question)}"
        self.store.set(key, answer, ex=ttl)   # TTL 防过时

# 限流（L15-01）
from threading import Semaphore
llm_concurrency = Semaphore(50)   # 全局 LLM 并发上限

def call_llm_limited(messages):
    if not llm_concurrency.acquire(timeout=30):
        raise RateLimitError("LLM并发满")
    try:
        return llm(messages)
    finally:
        llm_concurrency.release()
```

**Step 5：监控仪表盘（L15-03）**

```python
# metrics.py：四类指标采集
import random
from prometheus_client import Counter, Histogram, Gauge

# 性能
requests_total = Counter("agent_requests_total", "请求数", ["endpoint"])
latency = Histogram("agent_latency_ms", "请求延迟", ["endpoint"])
error_rate = Counter("agent_errors_total", "错误数", ["type"])
# 成本
tokens_per_req = Histogram("agent_tokens_per_request", "每请求token")
cost_per_req = Gauge("agent_cost_per_request", "每请求成本（滚动）")
cache_hit_rate = Gauge("agent_cache_hit_rate", "缓存命中率")
model_dist = Counter("agent_model_calls_total", "模型调用", ["model"])
# 行为
avg_steps = Histogram("agent_steps", "步数")
tool_success = Counter("agent_tool_calls_total", "工具调用", ["tool", "status"])
guardrail_triggers = Counter("agent_guardrail_total", "护栏触发", ["type"])
# 质量
quality_score = Histogram("agent_quality_score", "LLM-Judge质量分")
feedback_pos = Counter("agent_feedback", "用户反馈", ["sentiment"])

def collect_metrics(trace, response, endpoint="/agent/run"):
    requests_total.labels(endpoint=endpoint).inc()
    latency.labels(endpoint=endpoint).observe(trace.duration_ms)
    tokens_per_req.observe(trace.total_tokens)
    cost_per_req.set(estimate_cost(trace))
    avg_steps.observe(trace.step_count)
    if random.random() < 0.05:
        quality_score.observe(llm_judge_sample(trace, response))
```

```text
# Grafana 仪表盘布局（L15-03）
顶层：SLA 状态（绿/黄/红）
行1：性能（QPS/p99延迟/错误率）
行2：成本（token/请求/日成本/缓存命中/模型分布）
行3：行为（平均步数/工具成功率/护栏触发）
行4：质量（反馈率/LLM-Judge分/任务完成率）
```

**Step 6：告警规则（L15-03）**

```yaml
# alerts.yml（Prometheus AlertManager）
groups:
- name: agent
  rules:
  - alert: HighLatency
    expr: histogram_quantile(0.99, sum(rate(agent_latency_ms_bucket[5m])) by (le)) > 5000
    for: 5m
    labels: {severity: warning}
    annotations: {summary: "p99延迟>5s"}
  - alert: HighErrorRate
    expr: rate(agent_errors_total[5m]) / rate(agent_requests_total[5m]) > 0.01
    for: 1m
    labels: {severity: critical}
    annotations: {summary: "错误率>1%"}
  - alert: QualityDrop
    expr: histogram_quantile(0.5, sum(rate(agent_quality_score_bucket[30m])) by (le)) < 3.5
    for: 30m
    labels: {severity: critical}
    annotations: {summary: "质量分降"}
  - alert: CostSpike
    expr: (avg_over_time(agent_cost_per_request[1h]) / avg_over_time(agent_cost_per_request[1h] offset 1h)) > 1.3
    for: 15m
    labels: {severity: warning}
    annotations: {summary: "每请求成本环比+30%"}
  - alert: StepBloat
    expr: histogram_quantile(0.5, sum(rate(agent_steps_bucket[10m])) by (le)) > 8
    for: 10m
    labels: {severity: warning}
    annotations: {summary: "步数暴涨可能发散"}
```

**Step 7：灰度发布（L15-05）**

```python
# canary.py：三维独立灰度 + 一键回滚
import hashlib

class CanaryManager:
    def __init__(self):
        self.ratios = {"prompt": 0.05, "model": 0.0, "tool": 0.0}  # 可热更新

    def get_config(self, user_id):
        cfg = {}
        for dim in ["prompt", "model", "tool"]:
            ratio = self.ratios.get(dim, 0.0)
            v = "new" if self._hash(user_id, dim) < ratio * 100 else "stable"
            cfg[dim] = NEW_CONFIG[dim] if v == "new" else OLD_CONFIG[dim]
            cfg[f"_{dim}_version"] = v  # 仅返回，不写共享可变状态
        return cfg

    def _hash(self, user_id, dim):
        return int(hashlib.md5(f"{user_id}{dim}salt".encode()).hexdigest(), 16) % 100

    def set_ratio(self, dim, ratio):
        self.ratios[dim] = ratio

    def rollback(self, dim="all"):
        """一键回滚：把 canary 比例清零，流量全部走 stable"""
        if dim == "all":
            for d in list(self.ratios):
                self.ratios[d] = 0.0
        else:
            self.ratios[dim] = 0.0
        alert(f"回滚 {dim} 到 stable（ratio=0）")

canary = CanaryManager()

# 自动防护：质量降自动回滚
def auto_rollback_on_quality_drop():
    if quality_metric < FLOOR:
        canary.rollback()
```

**Step 8：故障应急预案（L15-04）**

```python
# incident.py：分级降级预案
SEVERITY = {"P0": 0, "P1": 1, "P2": 2}  # 数值越小越严重

class IncidentResponse:
    def assess(self, metrics):
        """故障分级"""
        if metrics.error_rate > 0.1 or metrics.data_leak:
            return "P0"
        if metrics.error_rate > 0.01 or metrics.quality < 2.0:
            return "P1"
        return "P2"

    def stop_bleeding(self, level, symptom):
        """止血（先恢复后定位）"""
        if symptom == "llm_down":
            switch_to_fallback_model()   # 模型降级 M7
        elif symptom == "quality_drop":
            canary.rollback()             # 回滚最近变更
        elif symptom == "cost_spike":
            enable_hard_rate_limit()      # 限流压成本
        elif symptom == "tool_down":
            disable_failing_tool()        # 禁用故障工具

    def degrade(self, level):
        """分层降级预案（勿用字符串 >= 比较严重度）"""
        sev = SEVERITY[level]
        if sev <= SEVERITY["P1"]:
            disable_non_core_features()   # L1：P0/P1 都关非核心
        if sev <= SEVERITY["P0"]:
            switch_to_static_fallback()   # L5：仅 P0 静态兜底
```

**Step 9：故障注入演练（混沌工程）**

```python
# chaos_test.py：注入故障验证韧性
import subprocess, time

def inject_llm_failure():
    """注入：模拟 LLM API 全限流"""
    # 用 mock 让 LLM 调用全返 429
    set_llm_mock(return_429=True)
    time.sleep(60)  # 观察
    # 验证：模型降级链触发、用户收到降级回复、告警触发
    assert fallback_model_triggered
    assert alert_fired("LLMDown")
    reset_llm_mock()

def inject_tool_failure():
    """注入：杀掉某工具依赖"""
    subprocess.run(["docker", "stop", "search_service"])
    time.sleep(60)
    # 验证：工具熔断触发、Agent 降级为无该工具模式
    assert circuit_breaker_open("search")
    assert agent_runs_without_search()
    subprocess.run(["docker", "start", "search_service"])

def inject_instance_kill():
    """注入：杀 Agent 实例"""
    subprocess.run(["kubectl", "delete", "pod", "-l", "app=agent", "--grace-period=0"])
    time.sleep(30)
    # 验证：K8s 自动重启、请求不丢（无状态+队列）、SLA 未破
    assert pods_restarted
    assert no_request_lost
```

**Step 10：演练报告**

```markdown
# 故障注入演练报告

| 注入故障 | 预期韧性 | 实测 | 结果 |
|---------|---------|------|------|
| LLM全限流 | 降级链触发+用户降级回复+告警 | 触发，55s恢复 | ✅ |
| 搜索工具挂 | 熔断+无搜索模式+告警 | 触发，40s恢复 | ✅ |
| Agent实例被杀 | K8s重启+请求不丢 | 30s重启，0丢失 | ✅ |
| 质量暗降 | 监控告警+自动回滚 | 25min发现，5s回滚 | ⚠️发现偏慢 |
| 成本暴涨 | 成本告警+限流 | 10min告警，限流生效 | ✅ |

改进项：
- [ ] 质量告警阈值调严，25min太久→10min（owner:A）
- [ ] 加自动回滚（质量降自动切，非人工）（owner:B）
```

### 运维手册要点

```markdown
## 运维手册
### 部署 SOP
1. 容器镜像构建推送
2. K8s apply（Deployment+Service+Ingress）
3. 灰度从 1% 起，观察 30min 放量
4. 全量后保留回滚 24h

### 扩容 SOP
- HPA 按 CPU/队列积压自动扩
- 手动扩：kubectl scale

### 故障应急 SOP
1. 看告警分级（P0/P1/P2）
2. P0 立即止血（回滚/切备用/降级），不求根因
3. 通告值班群
4. 止血后定位根因
5. 验证恢复
6. 24h 内 Postmortem

### 各故障预案
- LLM 挂：切备用模型（M7 降级链）
- 工具挂：熔断+禁用故障工具
- 质量崩：回滚最近变更
- 成本爆：硬限流
- 全站挂：容灾切备区域
```

### 进阶挑战

1. **AaaS 平台化**：把这套基线做成多租户 AaaS（L14-05），给其他业务接入
2. **成本优化深化**：上模型路由+分级推理（L15-02），量化降本
3. **自动混沌**：定期自动跑故障注入（Netflix Chaos 思路），持续验证韧性
4. **SLA 自动化**：SLA 违反自动触发降级/回滚，不等人
5. **可观测深化**：trace + 评测联动，失败案例自动带 trace 链接（L13-03）

### 要点回顾

- 运维基线 = 部署架构(L01) + 监控(L03) + 灰度(L05) + 应急(L04) + 演练
- 部署：容器化+无状态化+K8s多副本+HPA自动扩
- 网关前置：认证/限流/路由/计费，慢任务入队异步
- 语义缓存+限流：降本+防打爆，时效/个性化不缓存
- 监控四类指标+SLA仪表盘：性能/成本/行为/质量——只盯性能会漏质量暗降
- 告警分级+持续时长+带上下文，防告警疲劳
- 灰度三维独立+一键回滚+自动防护：质量降自动回滚
- 故障分级P0-P3，先止血后定位，分层降级预案
- 故障注入演练：注入LLM/工具/实例故障验证韧性，产出报告+改进项
- 运维手册：部署/扩容/应急 SOP 文档化，故障预案预定义
- 这是 Agent 从"能部署"到"能运维"的收尾——M16 毕业设计综合全书

### 下一步

完成 P15 后，你的 Agent 已具备生产级部署与运维基线。M16「前沿范式与毕业设计」是最后一章——Computer Use、A2A 协议、模型定制化，并以一份毕业设计完成从"玩家"到"架构师"的最终跨越。
