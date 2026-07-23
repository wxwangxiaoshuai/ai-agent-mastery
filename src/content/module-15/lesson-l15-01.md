## 生产架构：网关、队列、缓存、限流

M14 把 Agent 设计出来了。但"设计图"到"能跑的生产服务"还隔着一整套基础设施。一个裸 Agent 跑在单进程里，扛不住并发、挡不住洪峰、慢任务阻塞快请求、重复问题烧钱。这一节搭生产架构的四大件——**网关、队列、缓存、限流**，让 Agent 真正成为高可用服务。

### 为什么裸 Agent 不够

先看裸 Agent 直接暴露的问题：

```
裸 Agent（一个进程跑 Agent Loop）：
  · 并发扛不住：一个 Agent 实例串行处理，用户多了排队
  · 洪峰打挂：突发流量直接打爆 LLM API 限流（429 雪崩）
  · 慢任务阻塞：一个深度研究 Agent 跑 2 分钟，后面所有用户干等
  · 重复烧钱：1000 个用户问同一个问题，1000 次调 LLM
  · 无前置过滤：恶意/超限请求直达 Agent，浪费算力
  · 无统一治理：认证、计费、日志各 Agent 各写一套
```

**四大件各自解决什么**：

| 组件 | 解决 |
|------|------|
| API 网关 | 统一入口：认证/限流/路由/计费/日志前置 |
| 任务队列 | 慢任务异步化，不阻塞快请求 |
| 语义缓存 | 重复/相似问题直接返回，省 LLM 调用 |
| 并发限流 | 防洪峰打爆下游（LLM API/工具） |

> 这四件不是 Agent 特有，是任何高并发服务的标配。但 Agent 有自己的特点——**LLM 调用又慢又贵又容易限流**，让缓存和队列的价值格外大。这节讲通用架构在 Agent 场景的特化。

### 生产架构全景

四件组合起来的架构：

```
┌────────── 用户 ──────────┐
│  Web/App/SDK              │
└────────────┬──────────────┘
             ▼
┌── API 网关 ────────────────────────────────────┐
│  认证 → 限流 → 路由 → 计费/日志 → 转发         │
└────────────┬───────────────────────────────────┘
             │
   ┌─────────┴──────────┐
   ▼                    ▼
```
┌─ 语义缓存 ─┐      ┌─ 同步 Agent 服务 ─┐
│ 命中？返回  │      │ 快请求直接处理     │
│ 未命中↓     │      │ （流式，秒级内）   │
└─────┬──────┘      └────────▲───────────┘
      │ miss                 │
      └──────────────────────┘  miss → 同步调 Agent/LLM
                             │
                             │ 慢任务（网关判定 is_long_task）
                             ▼
┌─ 异步队列 ──────────┐   ┌─ Agent Worker 池 ─┐
│ 深度研究/批量任务    │ ← │ 多实例水平扩展    │
│ 入队→异步处理→通知   │   │ 各自带限流降级    │
└──────────────────────┘   └────────────────────┘
```
                                     │
                              ┌──────┴──────┐
                              ▼              ▼
                          LLM API        工具/DB
                        （下游限流保护）
```

### API 网关：统一入口

网关是所有请求的第一站，把"和业务无关但每个服务都要做的事"前置：

```python
# 网关职责（伪代码示意，实际用 Kong/APISIX/自建）
from fastapi import HTTPException

def gateway(request):
    # 1. 认证：验 token，识别 tenant_id/user_id
    user = auth(request)
    if not user:
        raise HTTPException(status_code=401, detail="未认证")

    # 2. 限流：按 tenant/user 限流（防刷爆）
    if not rate_limiter.allow(user.id):
        raise HTTPException(status_code=429, detail="Too Many Requests")

    # 3. 计费/日志：先记再路由（两路径都要记）
    log_access(user, request)

    # 4. 路由：按任务类型分流
    if request.is_long_task:
        return enqueue_to_queue(request)   # 慢任务入队
    return route_to_agent_service(request)  # 快请求直达
```

**网关的价值**：
- **统一治理**：认证/限流/计费/日志写一次，所有 Agent 服务复用，不重复造轮子
- **前置过滤**：恶意/超限请求在网关就挡掉，不浪费 Agent 算力
- **路由分发**：按任务类型分到同步/异步路径

> 网关是 L14-05 "控制面" 的入口体现——租户管理、配额、路由都在这里前置。别让每个 Agent 服务自己搞认证限流，那是重复且不一致的。

### 任务队列：慢任务异步化

Agent 有些任务天然慢——深度研究（M5/P10）、批量文档处理、长视频分析（M12）。这些不能走同步（用户等 2 分钟，超时断了体验崩）。**入队异步处理**：

```
同步（快任务，<几秒）：
  用户 → 网关 → Agent → 流式返回
  · 适合：问答、简单工具调用

异步（慢任务，分钟级）：
  用户 → 网关 → 入队（返回 task_id） → 用户轮询/Webhook 拿结果
  · 适合：深度研究、批量任务、视频分析
  · 用户体验：提交后给个 task_id + 预计时间，完成后通知
```

```python
# 异步队列（用 Redis/RabbitMQ/Celery）
from celery import Celery

app = Celery("agent", broker="redis://localhost:6379")

@app.task
def long_research_task(question, user_id):
    """深度研究：入队异步执行"""
    agent = ResearchAgent()
    result = agent.run(question)   # 可能跑几分钟
    notify_user(user_id, result)   # 完成通知（Webhook/推送）
    return result

# 网关接到慢任务
def handle_long_task(request):
    task = long_research_task.delay(request.question, request.user_id)
    return {"task_id": task.id, "status": "queued",
            "estimated_time": "2-5 分钟"}
```

**队列的额外价值**：
- **削峰**：洪峰时任务排队，按 Worker 处理能力消费，不打爆下游
- **重试**：任务失败自动重试（M7 重试），比同步请求失败友好
- **优先级**：VIP 用户任务优先消费

> M7 讲的弹性（重试/降级/熔断）在队列层面也适用——任务失败重试、下游不可用降级、Worker 挂了任务不丢（持久化在队列里）。

### 语义缓存：重复问题省 LLM

传统缓存按"精确 key"命中。Agent 的问题是自然语言——"北京天气"和"今天北京天气怎么样"不是精确匹配，但答案是同一个。**语义缓存**按语义相似度命中：

```
语义缓存工作流：
  用户问题 → embedding → 在缓存库找相似问题
    ├─ 相似度 > 阈值 → 命中，直接返回缓存的答案（不调 LLM）
    └─ 不相似 → 调 LLM → 存进缓存（问题embedding+答案）
```

```python
import math

def embed(text: str) -> list[float]:
    """业务侧 embedding；示意返回单位向量"""
    ...

def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)

class SemanticCache:
    """语义缓存：按问题相似度命中"""
    def __init__(self, similarity_threshold=0.95):
        self.cache = []   # [(question_emb, question, answer)]，生产用向量库
        self.threshold = similarity_threshold

    def get(self, question: str):
        """查缓存"""
        q_emb = embed(question)
        for cached_emb, cached_q, cached_ans in self.cache:
            sim = cosine(q_emb, cached_emb)
            if sim >= self.threshold:
                return cached_ans   # 命中，直接返回
        return None   # miss

    def set(self, question: str, answer: str):
        """写缓存"""
        self.cache.append((embed(question), question, answer))

cache = SemanticCache()
agent = Agent()  # 既有 Agent

def agent_with_cache(question):
    # 先查缓存
    cached = cache.get(question)
    if cached:
        return cached   # 不调 LLM，省钱省时
    # miss 才调 LLM
    answer = agent.run(question)
    cache.set(question, answer)
    return answer
```

**语义缓存的价值**：
- **省钱**：高频重复问题（FAQ、常见查询）命中率高的能省大半 LLM 成本
- **省时**：命中是毫秒级，比调 LLM 快几十倍
- **适合场景**：FAQ 密集的客服、固定查询模式的数据分析

**语义缓存的坑与边界**：
- **阈值要调**：太高（0.99）命中率低，太低（0.85）误命中（相似但答案不同的问题返回错答案）
- **时效性问题别缓存**："今天天气"缓存了明天还返回昨天的——加 TTL 或对时效敏感问题不缓存
- **个性化不缓存**：含用户特定信息的问题（"我的订单"）不能跨用户缓存
- **事实性校验**：高价值场景命中后可做一次轻量校验，防误命中

```python
def smart_cache_get(question, user_id):
    cached = cache.get(question)
    if cached:
        # 时效/个性化检查
        if is_time_sensitive(question): return None   # 时效问题不返回缓存
        if is_personalized(question): return None     # 个性化不返回
        return cached
    return None
```

> 语义缓存是 Agent 降本的利器，但**不是所有问题都该缓存**——时效/个性化/低价值场景要豁免。无脑全缓存会返回过时或错误的答案。

### 并发限流：防下游被打爆

Agent 调 LLM API 有硬性速率限制（RPM/TPM）。洪峰时超限→429→连锁失败。**限流**在网关和 Agent 服务都要做：

```
限流两层：
  1. 网关层：按 tenant/user 限流（防某租户刷爆）
     · 令牌桶/滑动窗口
  2. Agent 服务层：按 LLM API 容量限流（防总并发超 API 限制）
     · 全局并发上限（如最多 50 个并发 LLM 调用）
     · 超了排队或返回稍后重试
```

```python
import time, threading

class RateLimitError(Exception):
    """LLM/网关限流"""

class TokenBucket:
    """令牌桶限流（可按 user_id 建多桶；此处示意全局桶）"""
    def __init__(self, rate, capacity):
        self.rate = rate           # 每秒生成令牌
        self.capacity = capacity   # 桶容量（突发上限）
        self.tokens = capacity
        self.last = time.time()
        self.lock = threading.Lock()

    def allow(self, user_id: str | None = None):
        # user_id 预留：生产按用户分桶；示意仍用全局令牌
        _ = user_id
        with self.lock:
            now = time.time()
            # 补充令牌
            self.tokens = min(self.capacity,
                              self.tokens + (now - self.last) * self.rate)
            self.last = now
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False

# 全局 LLM 并发限制（防打爆 API）
llm_semaphore = threading.Semaphore(50)   # 最多 50 并发

def call_llm_with_limit(messages):
    if not llm_semaphore.acquire(timeout=30):
        raise RateLimitError("LLM 并发已满，请稍后重试")
    try:
        return client.chat.completions.create(model="gpt-4o-mini", messages=messages)
    finally:
        llm_semaphore.release()
```

**限流与降级的配合**（M7 降级链）：超限不是直接报错，而是降级——

```
超限处理链：
  1. 令牌桶限流 → 超了排队等令牌
  2. 排队超时 → 模型降级（4o → mini，便宜快）
  3. 降级还超限 → 静态兜底（"服务繁忙稍后重试"或缓存结果）
```

### 容器化与编排

生产架构的部署形态——容器化 + 编排：

```
Docker：每个 Agent 服务/Worker 打成镜像
K8s：编排
  · Deployment：Agent 服务多副本（水平扩展，L14-05 无状态化前提）
  · Worker：队列消费者多副本（按队列积压自动扩缩）
  · HPA：按 CPU/队列长度自动扩容
  · Service + Ingress：网关入口
  · ConfigMap/Secret：配置与密钥
```

**K8s 给 Agent 的价值**：
- 自动扩缩容：洪峰自动加副本，低谷缩容省成本
- 自愈：实例挂了自动重启/迁移
- 滚动更新：配合灰度（L15-05）

### 要点总结

- 裸 Agent 扛不住生产：并发/洪峰/慢任务阻塞/重复烧钱/无前置治理
- 四大件：网关(统一入口)、队列(慢任务异步)、缓存(重复省LLM)、限流(防打爆下游)
- 网关前置治理：认证/限流/路由/计费/日志写一次复用，恶意请求挡在 Agent 外
- 队列异步化慢任务：深度研究/批量入队，返回 task_id，不阻塞快请求；削峰+重试+优先级
- 语义缓存按相似度命中：高频重复省大半成本；坑是阈值/时效/个性化——时效问题不缓存、个性化不跨用户
- 限流两层：网关按租户限流 + Agent 层按 LLM API 容量全局并发上限；超限降级(排队→模型降级→静态兜底)
- 容器化+K8s：多副本水平扩展、自动扩缩容、自愈、滚动更新配灰度
- 下一节 L15-02：成本-延迟-质量三角优化——缓存/限流之外的降本与提速
