## 毕业设计：生产级 Agent 产品

全书 16 模块学完，P16 是最终大考——综合所学，设计并交付一个**可部署的生产级 Agent 产品**。这不是重做某个模块，而是证明你能把知识组织成系统、说清决策、落地生产。这是从"玩家"到"架构师"的最终跨越。

### 项目目标

综合全书所学，设计并交付一个可部署的生产级 Agent 产品：
- 选定业务场景（智能客服 / 研发助手 / 数据分析 Agent / 自选）
- 多 Agent 协作 + MCP 工具 + RAG 记忆（全栈）
- 评测流水线 + 全链路可观测 + 安全加固（质量基线）
- 生产部署架构 + 运维基线（M15）
- 架构设计文档 ADR + 前端 UI + 部署方案
- 毕业答辩与复盘报告

### 验收标准

- [ ] 完整可运行的生产级 Agent 产品（不止 demo，能真实用）
- [ ] 多 Agent 协作（至少 2 个 Agent 编排，M11）
- [ ] MCP 工具集成（自制或接入 MCP Server，M6）
- [ ] RAG 知识库 + 记忆系统（M4 + M8）
- [ ] 评测流水线 + LLM-as-Judge + CI 门禁（L13-01/02）
- [ ] 全链路 tracing + 监控仪表盘（L13-03 + L15-03）
- [ ] 安全加固：护栏 + 注入防护 + 工具沙箱 + 审计（L13-04/05/06 + M9）
- [ ] 生产部署：网关+队列+缓存+限流（L15-01）
- [ ] 运维基线：灰度发布 + 回滚 + 故障预案（L15-04/05）
- [ ] 架构设计文档含 ADR ≥ 5 条（M14）
- [ ] 前端 UI（流式 + HITL 审核 + 透明度，L10-05 + L10-03 + L15-06）
- [ ] 部署方案（Docker/K8s，L15-01）
- [ ] 毕业答辩 + 复盘报告

### 架构总览（示例：企业研发助手 Agent）

选"企业研发助手"为示例场景——帮研发团队查代码、查文档、生成代码、提 PR、查日志。

```
┌──────────────────────────────────────────────────────────────┐
│        企业研发助手 Agent（生产级）                            │
│                                                               │
│  ┌── 前端 UI ──────────────────────────────────────────┐    │
│  │  流式对话 + 步骤可见 + HITL审核 + 透明度(引用)         │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                    │
│  ┌── API 网关（L15-01）─────────────────────────────────┐    │
│  │  认证/限流/路由/计费                                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                    │
│  ┌── 多 Agent 编排（M10/M11，LangGraph）────────────────┐    │
│  │  Supervisor 调度：                                      │    │
│  │   · 代码检索 Agent → 查代码库                           │    │
│  │   · 文档 Agent → 查技术文档                             │    │
│  │   · 编码 Agent → 生成/改代码                            │    │
│  │   · 运维 Agent → 查日志/部署（HITL关键操作）            │    │
│  │  HITL：提PR/部署前人工审（L10-03）                      │    │
│  └──────────────────────────────────────────────────────┘    │
│        │              │              │                          │
│  ┌── MCP 工具 ─┐ ┌─ RAG+记忆 ─┐ ┌─ 沙箱 ──────────┐         │
│  │ Git/搜索/    │ │ 代码库索引 │ │ 代码执行沙箱     │         │
│  │ 日志/CI MCP │ │ 文档RAG    │ │ (M9)             │         │
│  │ (M6)        │ │ 用户偏好   │ │                  │         │
│  │             │ │ 记忆(M8)   │ │                  │         │
│  └─────────────┘ └────────────┘ └──────────────────┘         │
│                          │                                    │
│  ┌── 质量/安全/运维 套层 ──────────────────────────────┐    │
│  │  评测流水线+LLM-Judge+CI门禁（L13-01/02）             │    │
│  │  全链路tracing+监控仪表盘（L13-03+L15-03）            │    │
│  │  输入/输出护栏+注入防护+审计（L13-04/05/06）           │    │
│  │  网关+队列+缓存+限流（L15-01）                         │    │
│  │  灰度+回滚+故障预案（L15-04/05）                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                    │
│  ┌── 架构文档（M14）────────────────────────────────────┐   │
│  │  ADR ≥5条 + 架构图 + Trade-off + 容量成本 + 演进路线   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 实施步骤

**Step 1：场景与架构设计（M14）**

选场景、定位自主性谱系、产出 ADR 和架构图（复用 P14 的产出）：

```markdown
# ADR-001：研发助手用 LangGraph supervisor 编排
# ADR-002：代码知识用 RAG（非微调，M4/L16-03）
# ADR-003：多 Agent 分（检索/文档/编码/运维）而非单 Agent（M11）
# ADR-004：关键操作（提PR/部署）用 HITL（L10-03）
# ADR-005：代码执行必沙箱（M9，不可妥协）
（详见 P14 的 ADR 模板）
```

**Step 2：多 Agent 编排（M10/M11）**

```python
# 研发助手的 supervisor 编排（L11-02）
class DevAssistantGraph:
    """supervisor 调度多 Agent"""
    def build(self):
        g = StateGraph(DevState)
        g.add_node("supervisor", self.supervisor)   # 调度
        g.add_node("code_retriever", code_retriever_agent)  # 查代码
        g.add_node("doc_agent", doc_agent)           # 查文档
        g.add_node("coder", coder_agent)             # 生成代码
        g.add_node("ops", ops_agent)                 # 运维
        g.add_edge(START, "supervisor")
        g.add_conditional_edges("supervisor", self.route)  # 主管决定下一步
        for a in ["code_retriever","doc_agent","coder","ops"]:
            g.add_edge(a, "supervisor")  # 下属干完回主管
        # HITL：提PR/部署前 interrupt（L10-03）
        g.add_node("approve_pr", lambda s: interrupt({...}))
        return g.compile(checkpointer=SqliteSaver(...), recursion_limit=25)
```

**Step 3：MCP 工具集成（M6）**

```python
# 接入/自制 MCP Server（L06-04/05）
# 代码库 MCP Server：暴露 search_code / read_file / write_file
# CI/CD MCP Server：暴露 trigger_pipeline / get_log
mcp_tools = load_mcp_tools(["codebase_server", "cicd_server"])

# 自制 MCP Server 示例（L06-05）
@mcp_server.tool()
def search_code(query: str) -> list:
    """在代码库搜代码"""
    return codebase_index.search(query)
```

**Step 4：RAG + 记忆（M4 + M8）**

```python
# 代码库 RAG 索引（按语法分块，L14-02 Cursor 思路）
codebase_rag.index(repo, chunker=syntax_aware_chunker)
# 混合检索 + Reranking（L04-04）
def retrieve_code(query): return hybrid_search(query)  # BM25+向量+rerank

# 记忆系统（L08-03 Mem0 式）
memory = LongTermMemory()   # 跨会话记住用户偏好（常用语言/项目）
def chat(user_id, msg):
    related = memory.recall(user_id, msg)  # recall 偏好
    ...
    memory.remember(user_id, msg)  # 抽取新偏好
```

**Step 5：评测 + 可观测 + 安全（M13）**

```python
# 评测流水线（L13-02）
eval_pipeline = EvalPipeline(dataset="evals/dev_assist.yaml",
                             judge=llm_judge, gate=QUALITY_GATE)
# 全链路 tracing（L13-03）
@traced
def agent_run(...): ...
# 护栏（L13-04）
def guarded_run(input):
    if not input_guardrail(input): return "输入被拦"
    output = agent.run(input)
    clean, _ = output_guardrail(output)
    return clean
# 注入防护 + 工具沙箱 + 审计（L13-05/06 + M9）
safe_tool_exec(tool, args, require_approval=hitl_for_dangerous)
```

**Step 6：生产部署 + 运维（M15）**

```python
# 无状态 Agent + 网关 + 队列 + 缓存 + 限流（L15-01）
# 容器化（Dockerfile 见 P15）
# K8s 部署（Deployment 多副本 + HPA）
# 监控仪表盘四类指标（L15-03）
# 灰度发布三维独立 + 一键回滚（L15-05）
# 故障预案 + 演练（L15-04，复用 P15 的预案）
```

**Step 7：前端 UI（L10-05 + L15-06）**

```jsx
// 研发助手前端：流式 + 步骤 + HITL + 透明度
function DevAssistant() {
  return (
    <div>
      <Steps>  {/* L15-06 透明度：过程可见 */}
        <Step>🔍 检索代码库</Step>
        <Step>📖 查技术文档</Step>
        <Step>✍️ 生成代码</Step>
      </Steps>
      <Answer>  {/* 来源可溯 */}
        基于这段代码<Cite src="file:X.cs:42"/>建议改成...
      </Answer>
      <Approval>  {/* L10-03 HITL：提PR前审 */}
        将提交 PR，修改3个文件，确认？
        <button>批准</button><button>编辑</button><button>拒绝</button>
      </Approval>
    </div>
  )
}
```

**Step 8：毕业答辩与复盘**

```markdown
# 毕业答辩 PPT 结构
1. 场景与定位：研发助手解决什么、自主性谱系位置
2. 架构设计：架构图 + ADR 决策理由（M14）
3. 全栈实现：多Agent+MCP+RAG+记忆 各模块如何组合
4. 质量基线：评测/可观测/安全/护栏（M13）
5. 生产落地：部署/监控/灰度/运维（M15）
6. 演示：真实跑一个任务（查代码→生成→提PR）
7. Trade-off 与反思：为什么这么选、有什么不足

# 复盘报告
- 做对的决策（哪些 ADR 实践验证有效）
- 做错的决策（哪些过度工程/选错，反思）
- 若重做会怎么改
- 后续演进方向（L14-06 路线图）
- 个人成长（L16-04 专精方向）
```

### 进阶挑战

1. **A2A 互联**：让你的研发助手能委托任务给别的 Agent（如委托给"测试 Agent"），探索 L16-02
2. **Computer Use 兜底**：对没 API 的内部系统，用 Computer Use 兜底（L16-01）
3. **模型定制化**：如果量大了，评估 LoRA 微调小模型降本（L16-03）
4. **AaaS 平台化**：把研发助手做成多租户平台，给其他团队接入（L14-05）
5. **混沌演练**：做完整故障注入演练验证韧性（L15-04/P15）

### 要点回顾

- 毕业设计是全书收口——综合 16 模块组织成可部署生产级 Agent 产品
- 不是重做某模块，是证明能组织知识成系统、说清决策、落地生产
- 示例研发助手：supervisor 调度（检索/文档/编码/运维）多 Agent
- 全栈要求：多Agent(M11)+MCP(M6)+RAG(M4)+记忆(M8)+评测可观测安全(M13)+部署运维(M15)+架构ADR(M14)+前端(L10-05/L15-06)
- HITL 关键操作（提PR/部署）+ 代码执行沙箱 + 注入防护 是安全底线
- 前端 UI 体现透明度（步骤+引用）+ HITL 审核 + 流式
- ADR 说清决策理由——架构师不只实现还要会决策
- 答辩讲：场景定位+架构+全栈+质量+生产+演示+Trade-off反思
- 复盘：做对/做错的决策、若重做怎么改、演进方向、个人专精
- 毕业后：你不只是学过Agent开发，是能独立交付生产级Agent产品并说清为什么这么设计

### 毕业寄语

走完 16 模块 + 16 个项目，你已经从"调一个 API"走到了"设计交付生产级 Agent 系统"。但你真正的成长发生在**把这些知识用到真实项目里反复打磨**的时候——地图不是领土，工具箱不等于手艺。

**接下来的路**：
1. **做一个真东西**：挑一个真实业务，从 0 做一个 Agent 产品，别停在 demo
2. **深钻一个方向**：从 L16-04 的五个专精方向里选一个，成为那个领域的专家
3. **持续跟进前沿**：Agent 领域迭代快，但底层范式（ReAct/RAG/MCP/上下文工程）相对稳——深扎底层，具体 API 知道在哪查
4. **保持务实**：Agent 不是银弹，能用 API 别上 Computer Use，能单 Agent 别上多 Agent，能 Prompt 别微调。技术宗教要不得
5. **建立判断力**：架构师的底气不是记住所有 API，是知道在什么场景做什么决策、为什么

> 这套课程的终点不是"你学完了"，是"你具备了持续成长的判断力和基础"。从玩家到架构师，毕业快乐。去造真正有用的 Agent 吧。🎓
