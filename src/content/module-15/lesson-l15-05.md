## 灰度发布、A/B 测试与回滚策略

L15-04 说故障常因变更。Agent 系统变更尤其危险——改个 prompt 可能让质量崩（L15-04 那个 Postmortem 就是）。**灰度发布**让变更安全上线：小流量先试，没问题再放量，出问题秒回滚。这一节是发布工程的核心，也是 L14-06 灰度迁移的运维落地。

### 为什么 Agent 变更要灰度

先理解 Agent 变更的特殊风险——比传统代码变更危险：

```
传统代码变更：
  · 行为确定，测试覆盖了就基本稳
  · 回归测试能抓大部分问题

Agent 变更（prompt/模型/工具）：
  · 行为不确定——改个词输出可能完全不同
  · 测试集（L13-02）覆盖有限，真实流量有评测集没有的 case
  · 质量影响延迟显现——上线时"还行"，跑半天质量暗降
  · 影响面大——一个 prompt 影响所有用户

→ 全量上线 = 赌博，一次烂变更影响所有用户
→ 灰度 = 限制爆炸半径，烂变更只影响小流量
```

**核心思想**：**把"上线"从"一次性切流"变成"渐进验证"**。每一步验证，有问题立即停。这是把风险从"全量"降到"局部"的工程手段。

### 灰度发布的阶段

标准灰度流程：

```
1. 影子流量（Shadow）：新版本跑真实流量但不返回用户
   · 对比新旧输出差异，发现回归
   · 用户无感知（用老版本结果）
   
2. 内部测试（Dogfood）：员工/测试账号先用
   · 内部先踩雷
   
3. 小流量灰度（Canary）：1-5% 真实用户
   · 监控质量/成本/错误率
   · 有问题立即回滚
   
4. 扩大灰度：10% → 25% → 50% → 80%
   · 每步观察，没异常才进下步
   
5. 全量：100% + 保留回滚能力
```

```python
# 灰度路由（L14-06 讲过，这里运维视角）
def canary_route(user_id, new_ratio=0.05):
    """按用户稳定分流到新旧版本"""
    h = hash(user_id + "salt") % 100   # salt 防猜
    return "new" if h < new_ratio * 100 else "old"

def agent_run(user_id, question):
    version = canary_route(user_id)
    config = NEW_CONFIG if version == "new" else OLD_CONFIG
    result = run_with(config, question)
    
    # 灰度时对比新旧（影子流量）
    if version == "old" and shadow_enabled:
        new_result = run_with(NEW_CONFIG, question)  # 跑新不返回
        log_diff(result, new_result, user_id)
    
    return result
```

**灰度的关键设计**：
- **稳定分流**：同一用户稳定在一版（用 hash 不用随机），否则来回切体验崩
- **按用户而非按请求**：同一用户的多次请求在同一版本，行为连贯
- **可回滚**：任何阶段发现异常，流量立即切回老版本

### 三维独立灰度

Agent 的三维版本（L14-06）要**独立灰度**——prompt、模型、工具分别灰度，而非一把全改：

```
危险做法：同时改 prompt + 换模型 + 加工具，一起灰度
  → 出问题不知道哪个的锅

正确做法：独立灰度，一次只变一维
  · prompt 灰度：模型工具不变，只 prompt 新老分流
  · 模型灰度：prompt 不变，模型新老分流
  · 工具灰度：加的新工具先小流量用
  
每维独立灰度+独立回滚，出问题能定位到哪维
```

```python
# 三维独立灰度配置
def get_config(user_id):
    return {
        # 每维独立按 user_id 分流（可用不同 salt 避免相关）
        "prompt": NEW_PROMPT if canary(user_id, "prompt_salt", 0.05) else OLD_PROMPT,
        "model": NEW_MODEL if canary(user_id, "model_salt", 0.0) else OLD_MODEL,  # 模型先不灰
        "tools": NEW_TOOLS if canary(user_id, "tool_salt", 0.0) else OLD_TOOLS,
    }
```

**独立灰度的价值**：
- **定位根因**：出问题知道是哪维的锅（配合 L15-03 监控，按维度看指标）
- **降低风险**：一次变一维，爆炸半径小
- **独立回滚**：只回滚出问题的那维，其他维的好变更保留

> 这是 L14-06 三维版本管理的运维落地——不只是"版本化了"，还要"独立灰度独立回滚"。一次全改是反模式。

### A/B 测试：不只验证"没坏"，还验证"更好"

灰度是"验证没坏"（出新版不比老版差）。A/B 测试是"验证更好"（新版比老版好多少）：

```
灰度：新版不崩就行 → 上线
A/B：新版 vs 老版，哪个质量/成本/延迟更优 → 数据驱动决策
```

```python
def ab_test(user_id, question):
    """A/B 测试：新老分流，记录指标对比"""
    variant = "B" if hash(user_id) % 2 == 0 else "A"   # 50/50 分流
    config = NEW_CONFIG if variant == "B" else OLD_CONFIG
    result = run_with(config, question)
    
    # 记录该请求的指标，按 variant 分桶统计
    record_metrics(variant, user_id, result.quality, result.cost, result.latency)
    return result
```

**A/B 测试的统计显著性**：

```
陷阱：看一两天数据就说"B 更好"
  · 可能是随机波动（样本少）
  · 要统计显著性检验

正确：
  · 跑足够样本（流量小就跑久点）
  · 看指标的置信区间/显著性
  · 显著差异才下结论"新版更好"
```

```python
def is_significant(metric_a, metric_b, confidence=0.95):
    """统计显著性检验（简化，实际用 scipy）"""
    # t 检验：A/B 两组的指标差异是否显著
    from scipy import stats
    t, p = stats.ttest_ind(metric_a, metric_b)
    return p < (1 - confidence)   # p 值小于显著性水平
```

**A/B 的 Agent 特有考量**：
- **质量指标的 A/B**：用 LLM-Judge 或用户反馈，而非"答案文本"对比
- **长期 vs 短期**：短期 token 省了但长期质量降？要跑足够久
- **不要同时多个 A/B**：互相干扰，一次测一个变量（除非正交设计）

### 一键回滚与版本快照

灰度的安全网——**秒级回滚**。出问题立即切回老版本：

```python
class VersionManager:
    """版本管理与回滚"""
    def __init__(self):
        self.versions = {}   # version_id -> config（带时间戳）
        self.current = "stable"

    def deploy(self, new_config, version_id):
        """部署新版本（先存快照再切）"""
        self.versions[version_id] = {**new_config, "time": now()}
        self.current = version_id

    def rollback(self, to_version="stable"):
        """一键回滚"""
        if to_version in self.versions:
            self.current = to_version
            log_rollback(to_version)
            return True
        return False

# 灰度中出问题
if quality_drop_detected():
    version_mgr.rollback()   # 秒级切回稳定版
```

**回滚的工程要求**：
- **快**：回滚是切配置/流量，秒级，不是重新部署（那要分钟）
- **版本快照**：每次部署存配置快照，回滚有目标版本
- **数据兼容**：回滚到老版本，老版本要能读新版本产生的数据（向后兼容，L14-06）
- **自动触发**：监控到关键指标崩（L15-03），自动回滚而非等人决策

> 回滚最怕"回不了"——新版本改了 DB schema，老版本读不了。所以 L14-06 的"向后兼容"是回滚的前提：**改 schema 要兼容老版本**，否则回滚失效。

### 灰度的自动防护

进阶——**自动灰度+自动回滚**，不靠人盯：

```python
def automated_canary(new_config, schedule):
    """自动灰度：按计划放量，指标崩自动回滚"""
    for ratio in schedule:   # [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]
        set_canary_ratio(ratio)
        wait(duration=30 * 60)   # 观察期
        
        # 检查指标
        metrics = collect_canary_metrics()
        if metrics.error_rate > THRESHOLD or metrics.quality < QUALITY_FLOOR:
            alert("灰度指标异常，自动回滚")
            rollback()
            return "rolled_back"
        
        if metrics.regression_detected():
            rollback()
            return "rolled_back"
    
    return "deployed"   # 全量完成
```

**自动防护的价值**：人盯灰度会疲劳、会慢。自动监控+自动回滚，在故障影响大前就停。**但要设好阈值和观察期**——太敏感会频繁误回滚，太迟钝失去防护。

### 灰度发布与评测、监控的协作

```
灰度不是孤立的，是质量保障体系的发布环节：
  · 上线前：评测流水线过质量门（L13-02）
  · 灰度中：监控指标对比新旧（L15-03）
  · 出问题：自动回滚 + Postmortem（L15-04）
  · 验证更好：A/B 测试统计显著（本节）

完整链路：评测→灰度→监控→（回滚/A/B）→全量
```

> 这四节（L15-01/02/03/04/05）其实是**一套质量运维体系**：基础设施(L01)→优化(L02)→监控(L03)→应急(L04)→发布(L05)。环环相扣，缺一个发布都不安全。

### 发布的反模式

```
反模式1：大爆炸发布
  · 改一堆东西一次全量 → 出问题影响所有用户，难定位
  · 对策：小步独立灰度

反模式2：无回滚能力
  · 改了 schema 老版本读不了 → 回滚失效
  · 对策：向后兼容设计（L14-06）

反模式3：灰度样本太小
  · 1% 跑 5 分钟就说没问题 → 没覆盖足够 case/时间
  · 对策：足够样本+足够时间+统计显著

反模式4：同时多个变更
  · prompt 和模型一起灰 → 出问题不知谁的锅
  · 对策：一次一维（本节三维独立）

反模式5：只看错误率不看质量
  · "都 200"但质量崩 → 灰度"通过"实则退化
  · 对策：灰度指标含质量（L15-03）
```

### 要点总结

- Agent 变更比代码危险：行为不确定、测试覆盖有限、质量延迟显现、影响面大——全量上线=赌博
- 灰度思想：把上线从一次性切流变渐进验证，烂变更只影响小流量，爆炸半径小
- 灰度阶段：影子流量→内部→1-5%→扩大→全量；稳定分流(hash非随机)+按用户+可回滚
- 三维独立灰度：prompt/模型/工具分别灰度，一次一维，出问题能定位+独立回滚——别一把全改
- A/B 测试验证"更好"而非"没坏"：50/50 分流按桶记指标；统计显著性检验防随机波动误判
- 一键回滚：秒级切配置(非重新部署)、版本快照、向后兼容(老版本读新数据)、自动触发
- 自动灰度+自动回滚：按计划放量，指标崩自动回滚，防人盯疲劳；设好阈值和观察期防误回滚
- 灰度是质量体系发布环节：评测(L13-02)→灰度→监控(L15-03)→回滚/A/B→全量，环环相扣
- 反模式：大爆炸发布、无回滚能力(schema不兼容)、样本太小、同时多变更、只看错误率不看质量
- 下一节 L15-06：运维的对面是用户——Agent 产品的 UX 设计
