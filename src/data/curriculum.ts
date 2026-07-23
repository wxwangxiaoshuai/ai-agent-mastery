import type { Curriculum } from './types'

/**
 * AI Agent 大师之路 —— 完整课程大纲
 *
 * 设计哲学：
 *  - 自底向上：从 LLM 基础到 Agent 架构再到多智能体系统
 *  - 理论 + 实战交替：每个模块都有可运行的实战项目
 *  - 拥抱真实工具链：LangChain / LangGraph / MCP / Claude API
 *  - 贯穿工程素养：上下文工程、RAG、Harness、评估、护栏、安全、部署
 *  - 架构师视角：新增架构设计、案例拆解、运维 SRE、平台架构
 *
 * 共 7 大阶段 / 16 个模块 / 91 节课 / 16 个实战项目
 */
export const curriculum: Curriculum = {
  title: 'AI Agent 大师之路',
  tagline: '从零到架构师 · 从 Prompt 到多智能体系统到生产级 Agent 平台',
  description:
    '这是一套为开发者设计的、从零基础到架构师专家的 AI Agent 开发课程。' +
    '从大语言模型基础出发，经过 Prompt 工程、上下文工程、RAG 知识库、' +
    'Agent 核心架构、工具使用、Harness 工程化、记忆系统、多智能体与多模态，' +
    '再到架构设计、评估测试、安全护栏与生产运维，' +
    '最终构建可评估、可观测、可生产部署的 Agent 应用。' +
    '每一阶段都配有实战项目，学完即能交付真实 Agent 产品。',
  modules: [
    // ================================================================
    // 阶段一：筑基篇（M1-M2）
    // ================================================================

    // ---------- M1：LLM 基础与开发环境 ----------
    {
      id: 1,
      title: 'LLM 基础与开发环境',
      subtitle: '理解大模型的本质，搭建你的第一个 AI 应用',
      description:
        '不讲玄学，只讲原理与工程。这一章建立你对大语言模型的工作机制的工程化认知：' +
        'Token、上下文窗口、概率采样、温度参数。并用 Python/TS 调用真实 LLM API，迈出 Agent 开发的第一步。',
      difficulty: '入门',
      hours: 8,
      icon: '🧱',
      accent: 'brand',
      lessons: [
        {
          id: 'L01-01',
          title: '什么是大语言模型：从 Token 到涌现能力',
          summary: '拆解 LLM 的输入输出，理解 Tokenization、上下文窗口、生成式本质。',
          duration: 35,
          type: '理论',
          objectives: [
            '理解 Token 与上下文窗口对开发的约束',
            '区分训练、微调、推理三个阶段',
            '解释为什么 LLM 会"幻觉"',
            '建立对"概率采样"的工程直觉',
          ],
          tags: ['Tokenization', 'Context Window', 'LLM 原理'],
          competency: 'LLM 基础认知',
        },
        {
          id: 'L01-02',
          title: '生成参数全解：温度、Top-p、Top-k 与采样策略',
          summary: 'temperature 不是玄学。掌握每个采样参数对输出的真实影响。',
          duration: 30,
          type: '理论',
          objectives: [
            '解释 temperature / top_p / top_k 的数学含义',
            '在不同业务场景选择合适的参数组合',
            '理解 greedy vs sampling 对确定性的影响',
          ],
          tags: ['Sampling', 'Temperature', 'Decoding'],
          prerequisites: ['L01-01'],
          competency: 'LLM 基础认知',
        },
        {
          id: 'L01-03',
          title: '动手调用 LLM API（Python & TypeScript 双语言）',
          summary: '用 OpenAI / Anthropic SDK 跑通你的第一次模型调用，打通开发环境。',
          duration: 50,
          type: '实战',
          objectives: [
            '配置 API Key 与环境变量管理',
            '理解同步、流式（streaming）两种调用模式',
            '处理速率限制、重试与超时',
            '实现一个最小的命令行聊天程序',
          ],
          tags: ['OpenAI SDK', 'Anthropic SDK', 'Streaming', 'Python', 'TypeScript'],
          prerequisites: ['L01-01', 'L01-02'],
          competency: 'API 调用能力',
        },
        {
          id: 'L01-04',
          title: '模型选型与成本控制',
          summary: 'GPT、Claude、Gemini、开源模型如何选？Token 计费与成本估算实战。',
          duration: 30,
          type: '理论',
          objectives: [
            '从能力、成本、延迟、隐私四个维度选型',
            '估算一个 Agent 的 Token 消耗与月度成本',
            '建立模型路由（model routing）的初步认知',
          ],
          tags: ['Model Routing', 'Cost', 'GPT', 'Claude', 'Gemini'],
          prerequisites: ['L01-01', 'L01-03'],
          competency: '模型选型决策',
        },
      ],
      project: {
        id: 'P1',
        title: 'CLI 个人助手 v0',
        summary: '打造你的第一个命令行 AI 助手，支持多轮对话、流式输出、系统提示词定制与历史记录持久化。',
        module: 1,
        difficulty: '入门',
        deliverables: [
          '可交互的命令行聊天程序',
          '可切换 system prompt 的角色系统',
          '对话历史本地存储',
          '流式打字效果',
        ],
        stack: ['Python/TS', 'OpenAI SDK', 'JSON 存储'],
      },
    },

    // ---------- M2：Prompt 工程实战 ----------
    {
      id: 2,
      title: 'Prompt 工程实战',
      subtitle: '与模型高效协作的语言艺术',
      description:
        'Prompt 不是魔法咒语，而是结构化的工程产物。本章把模糊的"调 prompt"变成可复现、可迭代、可测试的工程实践：' +
        'Few-shot、Chain-of-Thought、角色设定、输出格式约束，以及让 Agent 稳定输出结构化数据的可靠技巧。',
      difficulty: '入门',
      hours: 10,
      icon: '✍️',
      accent: 'brand',
      lessons: [
        {
          id: 'L02-01',
          title: 'Prompt 的解剖学：指令、上下文、示例、输出格式',
          summary: '拆解一个高质量 Prompt 的四要素，建立可复用的 Prompt 模板思维。',
          duration: 35,
          type: '理论',
          objectives: [
            '识别 Prompt 的四个结构化组成部分',
            '编写带占位符的可复用模板',
            '理解指令清晰度对输出质量的杠杆作用',
          ],
          tags: ['Prompt 结构', 'Template', 'CRISPE'],
          prerequisites: ['L01-01'],
          competency: 'Prompt 工程',
        },
        {
          id: 'L02-02',
          title: 'Few-shot 与 In-Context Learning',
          summary: '用示例教模型做事，而不是用梯度。掌握示例的选择与排序。',
          duration: 30,
          type: '理论',
          objectives: [
            '区分 Zero-shot / One-shot / Few-shot',
            '选择最具代表性的示例',
            '规避示例带来的偏差',
          ],
          tags: ['Few-shot', 'ICL', 'In-Context Learning'],
          prerequisites: ['L02-01'],
          competency: 'Prompt 工程',
        },
        {
          id: 'L02-03',
          title: '思维链（CoT）与推理增强',
          summary: '让模型"想清楚再答"。CoT、Self-Consistency、ReAct 推理模式入门。',
          duration: 40,
          type: '理论',
          objectives: [
            '掌握 Chain-of-Thought 的触发技巧',
            '用 Self-Consistency 提升复杂推理稳定性',
            '理解 ReAct（Reason + Act）如何为 Agent 铺路',
          ],
          tags: ['CoT', 'Self-Consistency', 'ReAct', 'Reasoning'],
          prerequisites: ['L02-01'],
          competency: 'Prompt 工程',
        },
        {
          id: 'L02-04',
          title: '结构化输出：让模型吐 JSON',
          summary: 'Agent 的基石。用 JSON Schema、函数调用、instructor 等手段保证输出可解析。',
          duration: 50,
          type: '实战',
          objectives: [
            '用 Function Calling 约束输出结构',
            '用 JSON Schema 做输出校验与重试',
            '对比 prompt 约束 vs function calling 的可靠性',
          ],
          tags: ['Function Calling', 'JSON Schema', 'Structured Output'],
          prerequisites: ['L02-01', 'L01-03'],
          competency: '结构化输出',
        },
        {
          id: 'L02-05',
          title: 'Prompt 测试与版本管理',
          summary: '把 Prompt 当代码。用测试集回归、用 Git 管理版本、用评测量化改进。',
          duration: 35,
          type: '实战',
          objectives: [
            '为 Prompt 建立测试用例集',
            '量化对比两个 Prompt 版本的好坏',
            '引入 Prompt 版本管理与 A/B 思路',
          ],
          tags: ['Prompt Testing', 'Versioning', 'Eval'],
          prerequisites: ['L02-01'],
          competency: 'Prompt 工程化',
        },
      ],
      project: {
        id: 'P2',
        title: '智能文档摘要 & 信息抽取器',
        summary:
          '构建一个能把任意长文档结构化的 Agent：自动摘要、关键实体抽取、按 JSON Schema 输出，' +
          '并配有可回归的测试集，验证 Prompt 改动没有引入回归。',
        module: 2,
        difficulty: '入门',
        deliverables: [
          '支持长文档的摘要与实体抽取',
          '稳定输出符合 Schema 的 JSON',
          '可回归的 Prompt 测试集',
          'Prompt 版本对比报告',
        ],
        stack: ['Python', 'JSON Schema', 'pytest', 'Function Calling'],
      },
    },

    // ================================================================
    // 阶段二：上下文与知识篇（M3-M4）
    // ================================================================

    // ---------- M3：上下文工程 ----------
    {
      id: 3,
      title: '上下文工程',
      subtitle: 'System Prompt 架构、Context 组装与 Token 预算——Agent 的"操作系统"',
      description:
        '如果说 Prompt 是"指令"，那上下文工程就是 Agent 的"操作系统"。本章系统讲解 System Prompt 的层次化设计、' +
        '动态 Context 组装策略、Token 预算的精确管理、上下文压缩技术以及 Prompt Caching 的实战应用。' +
        '这是区分"demo 级 Agent"和"生产级 Agent"的分水岭。',
      difficulty: '进阶',
      hours: 10,
      icon: '⚙️',
      accent: 'brand',
      lessons: [
        {
          id: 'L03-01',
          title: 'System Prompt 架构设计：角色、规则与格式的层次化',
          summary: 'System Prompt 不是"写一段话"，而是分层定义的"Agent 操作系统"。',
          duration: 35,
          type: '理论',
          objectives: [
            '设计三层 System Prompt 架构（角色→规则→格式）',
            '理解指令优先级与冲突解决',
            '编写可组合、可复用的 System Prompt 模块',
          ],
          tags: ['System Prompt', 'Architecture', 'Role Definition'],
          prerequisites: ['L02-01'],
          competency: '上下文工程',
        },
        {
          id: 'L03-02',
          title: 'Context 组装策略：动态注入与优先级排序',
          summary: '不同场景需要不同的上下文。如何动态组装、按优先级裁剪。',
          duration: 40,
          type: '实战',
          objectives: [
            '实现"静态底座 + 动态注入"的 Context 架构',
            '设计 Context 优先级排序算法',
            '处理上下文冲突（如用户指令 vs System 规则）',
          ],
          tags: ['Context Assembly', 'Dynamic Injection', 'Priority'],
          prerequisites: ['L03-01'],
          competency: '上下文工程',
        },
        {
          id: 'L03-03',
          title: 'Token 预算管理：分配、计量与超限处理',
          summary: 'Token 就是钱。精确的预算分配、实时计量与超限降级策略。',
          duration: 35,
          type: '理论',
          objectives: [
            '设计 Token 预算分配模型（系统/历史/工具/输出）',
            '实现实时 Token 计数与预警',
            '处理超限场景的降级策略',
          ],
          tags: ['Token Budget', 'Counting', 'Overflow'],
          prerequisites: ['L01-04', 'L03-01'],
          competency: '成本工程',
        },
        {
          id: 'L03-04',
          title: '上下文压缩：LLMLingua、选择性压缩与摘要',
          summary: '长上下文太贵且慢。用压缩技术在不丢失关键信息的前提下缩减 Token。',
          duration: 40,
          type: '实战',
          objectives: [
            '对比 LLMLingua / Selective Context / 摘要压缩',
            '实现"保留关键信息"的选择性压缩',
            '在信息保真度与 Token 成本间做平衡',
          ],
          tags: ['Compression', 'LLMLingua', 'Selective Context'],
          prerequisites: ['L03-03'],
          competency: '上下文工程',
        },
        {
          id: 'L03-05',
          title: 'Prompt Caching 深度解析',
          summary: 'Claude/OpenAI 的 Prompt Caching 机制、命中规则与成本优化。',
          duration: 35,
          type: '理论',
          objectives: [
            '理解 Prompt Caching 的底层机制',
            '设计"缓存友好"的 Prompt 结构',
            '量化缓存命中率对成本的改善',
          ],
          tags: ['Prompt Caching', 'Cost Optimization', 'Cache Hit'],
          prerequisites: ['L03-01', 'L03-02'],
          competency: '成本工程',
        },
        {
          id: 'L03-06',
          title: '上下文工程的测试与调试',
          summary: '如何验证你的上下文设计是否有效？上下文可视化与调试工具。',
          duration: 35,
          type: '实战',
          objectives: [
            '建立 Context 的单元测试与回归测试',
            '用可视化工具查看实际发送的 Context',
            '调试"Context 污染"导致的输出异常',
          ],
          tags: ['Testing', 'Debugging', 'Visualization'],
          prerequisites: ['L03-02', 'L03-03'],
          competency: '上下文工程',
        },
      ],
      project: {
        id: 'P3',
        title: 'Context 预算管理器',
        summary:
          '构建一个 Agent 上下文管理系统：实现 Token 预算分配、实时计量、动态 Context 组装、' +
          '上下文压缩与 Prompt Caching 优化，并配套可视化调试面板，' +
          '让任何 Agent Loop 都能即插即用地获得上下文工程能力。',
        module: 3,
        difficulty: '进阶',
        deliverables: [
          'Token 预算分配与实时计量引擎',
          '动态 Context 组装与优先级裁剪',
          '上下文压缩管道（摘要；LLMLingua 可选）',
          'Prompt Caching 命中率优化',
          'Context 可视化调试面板',
        ],
        stack: ['Python', 'tiktoken', 'OpenAI/Anthropic SDK', 'Prompt Caching'],
      },
    },

    // ---------- M4：RAG 深度实战 ----------
    {
      id: 4,
      title: 'RAG 深度实战',
      subtitle: '从分块到检索再到生成——企业级 RAG 系统的完整工程链路',
      description:
        'RAG（检索增强生成）是当前 #1 的企业级 AI 落地模式。本章不是浅尝辄止的"调个向量库"，' +
        '而是从分块策略、Embedding 选型、混合检索、Reranking 到 RAG 评估与高级范式（Graph RAG / Agentic RAG）的完整工程链路。' +
        '学完你能独立设计并交付一个生产级 RAG 系统。',
      difficulty: '进阶',
      hours: 12,
      icon: '📚',
      accent: 'brand',
      lessons: [
        {
          id: 'L04-01',
          title: 'RAG 全景与架构范式：Naive → Advanced → Modular',
          summary: '从最简单的"检索+生成"到模块化 RAG 架构，理解 RAG 的演进脉络。',
          duration: 40,
          type: '理论',
          objectives: [
            '理解 RAG 的三层架构：Naive / Advanced / Modular',
            '画出 RAG 的数据流图（索引→检索→生成）',
            '识别 RAG 的典型失败模式（检索不准、生成幻觉）',
          ],
          tags: ['RAG', 'Architecture', 'Data Flow'],
          prerequisites: ['L01-01'],
          competency: 'RAG 架构',
        },
        {
          id: 'L04-02',
          title: '分块策略全解：固定/语义/层级/Agentic 分块',
          summary: '分块是 RAG 的基石。不同分块策略对检索质量的影响及实战对比。',
          duration: 45,
          type: '实战',
          objectives: [
            '实现固定大小、语义分块、递归分块三种策略',
            '对比不同分块策略的检索召回率',
            '选择适合文档类型的分块策略',
          ],
          tags: ['Chunking', 'Semantic Splitting', 'Recursive'],
          prerequisites: ['L04-01'],
          competency: 'RAG 工程',
        },
        {
          id: 'L04-03',
          title: 'Embedding 与向量检索深度：选型、索引优化、大规模检索',
          summary: 'Embedding 模型选型、向量数据库对比、HNSW 索引原理与优化。',
          duration: 45,
          type: '实战',
          objectives: [
            '对比主流 Embedding 模型（OpenAI/Cohere/BGE）的性能与成本',
            '选型向量数据库（Chroma/Qdrant/Milvus/pgvector）',
            '理解 HNSW 索引参数对检索速度与精度的 trade-off',
          ],
          tags: ['Embedding', 'Vector DB', 'HNSW', 'Chroma', 'Qdrant'],
          prerequisites: ['L04-01'],
          competency: 'RAG 工程',
        },
        {
          id: 'L04-04',
          title: '混合检索与 Reranking：BM25 + 向量 + Cross-encoder',
          summary: '单一检索不够。混合检索 + Reranking 是提升召回率的关键。',
          duration: 45,
          type: '实战',
          objectives: [
            '实现 BM25 + 向量检索的混合检索',
            '用 Cross-encoder 做 Reranking',
            '对比混合检索 vs 纯向量检索的召回率',
          ],
          tags: ['Hybrid Search', 'BM25', 'Reranking', 'Cross-encoder'],
          prerequisites: ['L04-03'],
          competency: 'RAG 工程',
        },
        {
          id: 'L04-05',
          title: 'RAG 评估体系：RAGAS、忠实度、上下文精度',
          summary: 'RAG 系统好不好，不能靠感觉。RAGAS 评估框架与自动化评测。',
          duration: 35,
          type: '理论',
          objectives: [
            '理解 RAGAS 的核心指标（faithfulness / context precision / answer relevancy）',
            '搭建 RAG 自动化评估流水线',
            '用评估结果驱动分块策略和检索参数的优化',
          ],
          tags: ['RAGAS', 'Evaluation', 'Faithfulness', 'Context Precision'],
          prerequisites: ['L04-01', 'L04-04'],
          competency: 'RAG 评估',
        },
        {
          id: 'L04-06',
          title: '高级 RAG 范式：Self-RAG / CRAG / Graph RAG / Agentic RAG',
          summary: '前沿 RAG 范式速览。从 Self-RAG 的自我反思到 Graph RAG 的知识图谱融合。',
          duration: 40,
          type: '理论',
          objectives: [
            '区分 Self-RAG / CRAG / Graph RAG / Agentic RAG 的核心思想',
            '理解 Graph RAG 的实体关系建模与社区摘要',
            '评估高级 RAG 范式的适用场景与成本',
          ],
          tags: ['Self-RAG', 'CRAG', 'Graph RAG', 'Agentic RAG'],
          prerequisites: ['L04-01', 'L04-05'],
          competency: 'RAG 架构',
        },
      ],
      project: {
        id: 'P4',
        title: '企业级 RAG 知识库系统',
        summary:
          '从零构建一个生产级 RAG 系统：支持多种分块策略的 AB 对比、BM25+向量混合检索、' +
          'Cross-encoder Reranking、RAGAS 自动化评估，以及引用溯源。' +
          '最终输出一份包含性能对比数据和优化建议的 RAG 系统报告。',
        module: 4,
        difficulty: '进阶',
        deliverables: [
          '多分块策略 AB 对比实验',
          '混合检索 + Reranking 管道',
          'RAGAS 自动化评估流水线',
          '引用溯源与可视化',
          'RAG 系统性能报告',
        ],
        stack: ['Python', 'Chroma/Qdrant', 'BM25', 'Cross-encoder', 'RAGAS'],
      },
    },

    // ================================================================
    // 阶段三：Agent 核心篇（M5-M7）
    // ================================================================

    // ---------- M5：Agent 核心架构 ----------
    {
      id: 5,
      title: 'Agent 核心架构',
      subtitle: '从"对话"到"行动"——ReAct、Plan-and-Execute 与 Agent Loop',
      description:
        '本章是整套课程的分水岭。你将理解什么是"真正的 Agent"：一个能在循环中感知、推理、行动、反思的自主系统。' +
        '我们手写一个最小 Agent Loop，再拆解 ReAct、Plan-and-Execute、Reflection 三大范式，' +
        '看清 Agent 不是"多包一层 prompt"那么简单。',
      difficulty: '进阶',
      hours: 12,
      icon: '🔁',
      accent: 'brand',
      lessons: [
        {
          id: 'L05-01',
          title: '什么是 Agent：从 Chatbot 到 Autonomous Agent',
          summary: '厘清 LLM、Chatbot、Workflow、Agent 的边界，定义"自主性"的工程含义。',
          duration: 35,
          type: '理论',
          objectives: [
            '区分 Workflow 与 Agent 的本质差异',
            '理解 Agent 的"感知-推理-行动"循环',
            '定义自主性的层级（L1-L5）',
          ],
          tags: ['Agent 定义', 'Autonomy', 'Workflow vs Agent'],
          prerequisites: ['L02-03'],
          competency: 'Agent 核心认知',
        },
        {
          id: 'L05-02',
          title: '手写一个最小 Agent Loop（不依赖框架）',
          summary: '用 100 行代码实现 Thought→Action→Observation 循环，真正理解 Agent 内核。',
          duration: 60,
          type: '实战',
          objectives: [
            '从零实现 ReAct 循环',
            '理解 stop condition 与最大步数保护',
            '体会"模型决定下一步"的自主性来源',
          ],
          tags: ['Agent Loop', 'ReAct', '从零实现'],
          prerequisites: ['L05-01', 'L02-04'],
          competency: 'Agent 内核实现',
        },
        {
          id: 'L05-03',
          title: 'ReAct 范式深度解析',
          summary: 'Reason + Act 的经典论文思路，以及它在现代框架中的落地。',
          duration: 40,
          type: '理论',
          objectives: [
            '复述 ReAct 论文的核心循环',
            '识别 ReAct 的失败模式（循环、发散）',
            '对比 ReAct 与 Plan-and-Execute',
          ],
          tags: ['ReAct', 'Reasoning', 'Acting'],
          prerequisites: ['L05-02'],
          competency: 'Agent 范式',
        },
        {
          id: 'L05-04',
          title: 'Plan-and-Execute 与任务分解',
          summary: '先规划再执行。让 Agent 处理需要多步骤、长时程的复杂任务。',
          duration: 45,
          type: '理论',
          objectives: [
            '掌握 Plan-then-Execute 的拆解策略',
            '处理计划失败后的重规划',
            '理解 ReAct 与 Plan-Execute 的适用场景',
          ],
          tags: ['Plan-and-Execute', 'Task Decomposition', 'Replanning'],
          prerequisites: ['L05-03'],
          competency: 'Agent 范式',
        },
        {
          id: 'L05-05',
          title: 'Reflection 与自我反思',
          summary: '让 Agent 批评自己的输出并改进。Self-Refine、Reflexion 的工程实现。',
          duration: 40,
          type: '理论',
          objectives: [
            '实现 Self-Refine 的批评-修订循环',
            '引入 Reflexion 的 episodic memory',
            '权衡反思带来的成本与质量提升',
          ],
          tags: ['Reflection', 'Self-Refine', 'Reflexion'],
          prerequisites: ['L05-03'],
          competency: 'Agent 范式',
        },
        {
          id: 'L05-06',
          title: '何时该用 Agent，何时不该用',
          summary: 'Agent 不是银弹。工程上判断"该用 Workflow 还是 Agent"的决策框架。',
          duration: 30,
          type: '复盘',
          objectives: [
            '建立"该不该上 Agent"的决策树',
            '识别过度工程化的反模式',
            '量化 Agent 引入的延迟与成本代价',
          ],
          tags: ['工程决策', 'Anti-patterns', 'Decision Framework'],
          prerequisites: ['L05-04'],
          competency: '架构决策',
        },
      ],
      project: {
        id: 'P5',
        title: '自主研究 Agent：ReAct 研究助手',
        summary:
          '不使用任何 Agent 框架，从零用 ReAct 范式实现一个能自主搜索、阅读、总结的研究 Agent。' +
          '它会把"调研 X 技术"这类开放任务，分解为搜索-阅读-整合的循环，最终输出结构化研究报告。',
        module: 5,
        difficulty: '进阶',
        deliverables: [
          '从零实现的 ReAct Agent 内核',
          '可插拔的 Tool 接口（搜索、抓取、总结）',
          '步数上限与发散保护',
          '结构化研究报告输出',
        ],
        stack: ['Python', '原生 ReAct', 'Web 搜索 API', 'HTML 解析'],
      },
    },

    // ---------- M6：工具使用与 Function Calling ----------
    {
      id: 6,
      title: '工具使用与 Function Calling',
      subtitle: '给 Agent 装上"手"——让它调用真实世界的能力',
      description:
        '没有工具的 Agent 只会说话。本章系统讲解 Tool Use 的工程化：如何定义工具、如何让模型选择工具、' +
        '如何处理工具的并行调用与错误恢复，并深入 MCP（Model Context Protocol）这一连接 Agent 与海量工具/数据源的统一标准。',
      difficulty: '进阶',
      hours: 11,
      icon: '🔧',
      accent: 'brand',
      lessons: [
        {
          id: 'L06-01',
          title: 'Function Calling 机制详解',
          summary: '从 schema 定义到模型决策，完整拆解工具调用的数据流。',
          duration: 40,
          type: '理论',
          objectives: [
            '编写规范的工具 JSON Schema',
            '理解模型如何"选择"调用哪个工具',
            '处理工具调用的参数校验',
          ],
          tags: ['Function Calling', 'Tool Schema', 'Tool Use'],
          prerequisites: ['L02-04'],
          competency: '工具工程',
        },
        {
          id: 'L06-02',
          title: '工具设计原则：粒度、命名、错误信息',
          summary: '好工具让 Agent 聪明，坏工具让 Agent 抓狂。工具设计的工程原则。',
          duration: 35,
          type: '理论',
          objectives: [
            '设计粒度合适的工具（不过粗不过细）',
            '为工具写"模型能理解"的描述',
            '设计可恢复的工具错误反馈',
          ],
          tags: ['Tool Design', 'API Design', 'Error Handling'],
          prerequisites: ['L06-01'],
          competency: '工具工程',
        },
        {
          id: 'L06-03',
          title: '并行工具调用与组合',
          summary: '让 Agent 一次调用多个工具，提升复杂任务的吞吐。',
          duration: 40,
          type: '实战',
          objectives: [
            '实现并行工具调用与结果聚合',
            '处理工具间的依赖与串行约束',
            '设计组合工具（composite tool）',
          ],
          tags: ['Parallel Tools', 'Tool Composition', 'Aggregation'],
          prerequisites: ['L06-01'],
          competency: '工具工程',
        },
        {
          id: 'L06-04',
          title: 'MCP（Model Context Protocol）入门',
          summary: 'Anthropic 提出的连接 LLM 与外部世界的统一协议。架构、价值与生态。',
          duration: 45,
          type: '理论',
          objectives: [
            '理解 MCP 的 Client-Server 架构',
            '区分 Tools / Resources / Prompts 三类原语',
            '评估 MCP 对 Agent 可扩展性的意义',
          ],
          tags: ['MCP', 'Model Context Protocol', 'Interoperability'],
          prerequisites: ['L06-01'],
          competency: 'MCP 协议',
        },
        {
          id: 'L06-05',
          title: '构建并发布你自己的 MCP Server',
          summary: '实战：把一个内部 API 封装成 MCP Server，供任意 MCP 客户端调用。',
          duration: 55,
          type: '实战',
          objectives: [
            '用 SDK 实现 MCP Server',
            '暴露 tools / resources / prompts',
            '在 Claude Desktop / IDE 中接入测试',
          ],
          tags: ['MCP Server', 'SDK', 'Claude Desktop'],
          prerequisites: ['L06-04'],
          competency: 'MCP 工程',
        },
        {
          id: 'L06-06',
          title: '工具调用的可观测性与调试',
          summary: 'Agent 调错了工具怎么办？调用链追踪、重放与根因定位。',
          duration: 35,
          type: '实战',
          objectives: [
            '记录每次工具调用的输入输出',
            '实现调用链的重放与调试',
            '定位"选错工具"的根因',
          ],
          tags: ['Tracing', 'Debugging', 'Observability'],
          prerequisites: ['L06-03'],
          competency: '工具可观测性',
        },
      ],
      project: {
        id: 'P6',
        title: '全能工具箱 Agent + 自制 MCP Server',
        summary:
          '构建一个能调用搜索、代码执行、数据库查询、文件操作等多种工具的 Agent，' +
          '并把其中一组能力封装成一个独立的 MCP Server 发布，让 Claude Desktop 等客户端直接接入。',
        module: 6,
        difficulty: '进阶',
        deliverables: [
          '多工具 Agent（搜索/代码/DB/文件）',
          '独立的 MCP Server（含 tools+resources）',
          'MCP 客户端接入演示',
          '工具调用链追踪面板',
        ],
        stack: ['Python/TS', 'Function Calling', 'MCP SDK', 'SQLite', 'Sandbox'],
      },
    },

    // ---------- M7：Agent Harness 工程化 ----------
    {
      id: 7,
      title: 'Agent Harness 工程化',
      subtitle: '让 Agent 不只"能跑"，还要"可靠"——健壮性、弹性与降级',
      description:
        '"能跑通"的 Agent 和"生产可用的"Agent 之间，隔着一整套 Harness 工程。' +
        '本章系统讲解 Agent 的健壮性模式：重试与退避策略、超时控制、状态持久化与断点恢复、' +
        'Circuit Breaker 故障隔离、并发控制与限流，以及优雅降级策略。' +
        '这是 Agent 从"demo"走向"服务"的必经之路。',
      difficulty: '高级',
      hours: 10,
      icon: '🛡️',
      accent: 'brand',
      lessons: [
        {
          id: 'L07-01',
          title: 'Agent 健壮性全景：为什么"能跑"≠"可靠"',
          summary: 'Agent 的故障模式分类：模型故障、工具故障、超时、幻觉。可靠性工程框架。',
          duration: 30,
          type: '理论',
          objectives: [
            '分类 Agent 故障模式（模型/工具/网络/逻辑）',
            '理解 MTBF / MTTR 在 Agent 系统中的含义',
            '建立 Agent 健壮性工程的整体框架',
          ],
          tags: ['Reliability', 'Fault Modes', 'MTBF', 'MTTR'],
          prerequisites: ['L05-02'],
          competency: '可靠性工程',
        },
        {
          id: 'L07-02',
          title: '重试、退避与超时：指数退避、jitter、deadline propagation',
          summary: '看似简单的重试，做对却不容易。指数退避、随机抖动、超时传导。',
          duration: 40,
          type: '实战',
          objectives: [
            '实现指数退避 + 随机 jitter 的重试策略',
            '区分可重试错误与不可重试错误',
            '实现超时在工具调用链中的正确传导',
          ],
          tags: ['Retry', 'Exponential Backoff', 'Jitter', 'Deadline'],
          prerequisites: ['L07-01'],
          competency: '弹性工程',
        },
        {
          id: 'L07-03',
          title: '状态持久化与恢复：Checkpointing、从失败步骤恢复',
          summary: 'Agent 执行到第 5 步失败了，不能从头开始。状态快照与断点恢复。',
          duration: 45,
          type: '实战',
          objectives: [
            '实现 Agent 状态的 Checkpointing',
            '从失败步骤恢复执行（而非重跑所有步骤）',
            '设计状态持久化的存储方案（内存/DB/文件）',
          ],
          tags: ['Checkpointing', 'State Recovery', 'Persistence'],
          prerequisites: ['L07-01'],
          competency: '状态管理',
        },
        {
          id: 'L07-04',
          title: 'Circuit Breaker 与并发控制：故障隔离、限流、队列',
          summary: '当外部 API 不可用时，Circuit Breaker 防止级联故障。限流与队列管理。',
          duration: 40,
          type: '实战',
          objectives: [
            '实现 Circuit Breaker 的三态转换（Closed→Open→Half-Open）',
            '用令牌桶或滑动窗口实现并发限流',
            '设计任务队列处理峰值负载',
          ],
          tags: ['Circuit Breaker', 'Rate Limiting', 'Queue'],
          prerequisites: ['L07-02'],
          competency: '弹性工程',
        },
        {
          id: 'L07-05',
          title: '优雅降级与 Fallback 链：模型降级、工具降级、静态兜底',
          summary: '最好的故障处理是不让用户感知到故障。多层降级链的设计。',
          duration: 35,
          type: '实战',
          objectives: [
            '设计模型降级链（Opus→Sonnet→Haiku→本地模型）',
            '实现工具降级（主工具→备用工具→静态答案）',
            '构建"静态兜底"作为最后的安全网',
          ],
          tags: ['Graceful Degradation', 'Fallback', 'Model Routing'],
          prerequisites: ['L07-04'],
          competency: '弹性工程',
        },
      ],
      project: {
        id: 'P7',
        title: 'Agent 弹性框架',
        summary:
          '封装一套 Agent 健壮性中间件：指数退避重试、Circuit Breaker 故障隔离、' +
          '状态 Checkpointing 与断点恢复、多级降级链，' +
          '让任何 Agent Loop 都能即插即用地获得生产级可靠性。',
        module: 7,
        difficulty: '高级',
        deliverables: [
          '重试/退避/超时中间件',
          'Circuit Breaker 故障隔离',
          '状态持久化与断点恢复',
          '多级降级链（模型→工具→静态兜底）',
          '压力测试与故障注入报告',
        ],
        stack: ['Python', 'Circuit Breaker', 'Checkpointing', 'Fault Injection'],
      },
    },

    // ================================================================
    // 阶段四：记忆执行与编排篇（M8-M10）
    // ================================================================

    // ---------- M8：记忆系统与状态管理 ----------
    {
      id: 8,
      title: '记忆系统与状态管理',
      subtitle: '让 Agent 拥有"长期记忆"和"持续身份"',
      description:
        '没有记忆的 Agent 是金鱼。本章系统讲解 Agent 的记忆架构：短期对话记忆、长期向量记忆、' +
        '程序记忆与技能库。你将掌握对话窗口管理、Mem0/MemGPT 的长期记忆思路，' +
        '以及记忆冲突解决与遗忘机制的设计。',
      difficulty: '进阶',
      hours: 10,
      icon: '🧠',
      accent: 'brand',
      lessons: [
        {
          id: 'L08-01',
          title: 'Agent 记忆的分类学',
          summary: '短期 / 长期 / 情景 / 语义 / 程序记忆——从认知科学到工程映射。',
          duration: 35,
          type: '理论',
          objectives: [
            '区分五类记忆及其在 Agent 中的对应',
            '理解记忆的写入、检索、遗忘',
            '为不同场景选择记忆策略',
          ],
          tags: ['Memory', 'Episodic', 'Semantic', 'Procedural'],
          prerequisites: ['L03-01'],
          competency: '记忆架构',
        },
        {
          id: 'L08-02',
          title: '对话窗口管理：压缩、摘要与滑动窗口',
          summary: '上下文窗口是有限的。如何在长对话中不丢失关键信息。',
          duration: 40,
          type: '实战',
          objectives: [
            '实现滑动窗口 + 摘要压缩',
            '处理"中段遗忘"问题',
            '权衡 Token 成本与记忆完整度',
          ],
          tags: ['Context Window', 'Summarization', 'Sliding Window'],
          prerequisites: ['L08-01', 'L03-03'],
          competency: '记忆工程',
        },
        {
          id: 'L08-03',
          title: '长期记忆架构：Mem0 / MemGPT 思路与工程实现',
          summary: '让 Agent 跨会话记住用户偏好与历史。业界记忆框架的设计思想。',
          duration: 40,
          type: '理论',
          objectives: [
            '理解 Mem0 的记忆抽取与存储',
            '分析 MemGPT 的虚拟内存分层',
            '设计可演进的长期记忆架构',
          ],
          tags: ['Mem0', 'MemGPT', 'Long-term Memory'],
          prerequisites: ['L08-01'],
          competency: '记忆架构',
        },
        {
          id: 'L08-04',
          title: '程序记忆与技能库：让 Agent 记住"怎么做"',
          summary: '不只是"记住事实"，而是"记住流程"。程序记忆与可复用技能库的设计。',
          duration: 40,
          type: '实战',
          objectives: [
            '设计程序记忆的存储结构（步骤、前置条件、结果）',
            '实现技能的检索与复用',
            '构建可演进的 Agent 技能库',
          ],
          tags: ['Procedural Memory', 'Skill Library', 'Reuse'],
          prerequisites: ['L08-03'],
          competency: '记忆工程',
        },
        {
          id: 'L08-05',
          title: '记忆冲突与遗忘：更新策略、冲突解决、遗忘机制',
          summary: '记忆不是越多越好。新旧知识冲突、过时信息清理、主动遗忘的设计。',
          duration: 35,
          type: '理论',
          objectives: [
            '设计记忆更新策略（覆盖/合并/版本化）',
            '处理新旧记忆冲突的解决规则',
            '实现基于时间/重要性/访问频率的遗忘机制',
          ],
          tags: ['Memory Conflict', 'Forgetting', 'Update Strategy'],
          prerequisites: ['L08-03'],
          competency: '记忆架构',
        },
      ],
      project: {
        id: 'P8',
        title: '有记忆的私人知识管家',
        summary:
          '打造一个能长期记住你偏好、检索你私有知识库的 Agent。它跨会话记住你的习惯，' +
          '基于你的笔记/文档做 RAG 问答，并在回答中标注引用来源。',
        module: 8,
        difficulty: '进阶',
        deliverables: [
          '跨会话长期记忆（用户偏好）',
          '私有文档 RAG 问答',
          '混合检索 + reranker',
          '回答引用溯源',
        ],
        stack: ['Python', 'Chroma/pgvector', 'Embedding', 'RAG', 'Mem0 思路'],
      },
    },

    // ---------- M9：Code Execution 与沙箱 ----------
    {
      id: 9,
      title: 'Code Execution 与沙箱',
      subtitle: '让 Agent 安全地写代码、跑代码——从解释器到沙箱隔离',
      description:
        '能写代码的 Agent 才真正强大。但让 AI 执行代码也意味着安全风险。' +
        '本章从代码解释器的原理出发，到 Docker 沙箱的安全隔离、云端沙箱方案（E2B/Sandboxed），' +
        '再到代码执行的安全审计，完整覆盖"让 Agent 写代码并安全执行"的全链路。',
      difficulty: '高级',
      hours: 8,
      icon: '🐳',
      accent: 'brand',
      lessons: [
        {
          id: 'L09-01',
          title: 'Agent 代码执行全景：解释器、REPL、沙箱方案对比',
          summary: '从 Python REPL 到 Docker 沙箱，各种代码执行方案的优劣对比。',
          duration: 35,
          type: '理论',
          objectives: [
            '对比 REPL / subprocess / Docker 沙箱 / 云端沙箱',
            '理解代码执行在 Agent 循环中的位置',
            '评估不同方案的安全等级与性能开销',
          ],
          tags: ['Code Execution', 'REPL', 'Sandbox', 'Interpreter'],
          prerequisites: ['L06-01'],
          competency: '代码执行架构',
        },
        {
          id: 'L09-02',
          title: 'Docker 沙箱实战：安全隔离、资源限制、文件系统',
          summary: '用 Docker 构建安全的代码执行环境。namespace 隔离、cgroup 限制、临时文件系统。',
          duration: 50,
          type: '实战',
          objectives: [
            '用 Docker SDK 创建隔离的代码执行环境',
            '配置 CPU/内存/网络/磁盘的资源限制',
            '实现临时文件系统，执行后自动清理',
          ],
          tags: ['Docker', 'Sandbox', 'cgroup', 'Isolation'],
          prerequisites: ['L09-01'],
          competency: '沙箱工程',
        },
        {
          id: 'L09-03',
          title: '云端沙箱方案：E2B / Sandboxed / Fly.io Machines',
          summary: '不想自己管 Docker？云端沙箱即服务方案对比与实战。',
          duration: 40,
          type: '实战',
          objectives: [
            '对比 E2B / Sandboxed / Fly.io Machines 的差异',
            '用 E2B SDK 创建云端代码执行环境',
            '选择适合自己场景的沙箱方案',
          ],
          tags: ['E2B', 'Sandboxed', 'Fly.io', 'Cloud Sandbox'],
          prerequisites: ['L09-02'],
          competency: '沙箱工程',
        },
        {
          id: 'L09-04',
          title: '代码执行安全与审计：注入防护、输出审查、资源审计',
          summary: '安全是不可妥协的底线。代码注入防护、输出内容审查、资源使用审计。',
          duration: 35,
          type: '理论',
          objectives: [
            '识别并阻止代码注入攻击',
            '实现输出内容的安全审查',
            '建立代码执行的审计日志与异常告警',
          ],
          tags: ['Security', 'Injection', 'Audit', 'Content Review'],
          prerequisites: ['L09-01'],
          competency: '安全工程',
        },
      ],
      project: {
        id: 'P9',
        title: '安全代码沙箱服务',
        summary:
          '构建一个独立的代码执行沙箱微服务：支持 Docker 隔离、资源限制、文件系统隔离、' +
          '网络策略、执行审计，并提供统一的 API 供 Agent 调用。' +
          '配套压力测试与安全审计报告。',
        module: 9,
        difficulty: '高级',
        deliverables: [
          'Docker 沙箱执行环境',
          'CPU/内存/网络/磁盘资源限制',
          '代码注入防护与输出审查',
          '执行审计日志与异常告警',
          '统一 API + SDK 封装',
        ],
        stack: ['Docker', 'Python', 'cgroup', 'Audit Log'],
      },
    },

    // ---------- M10：Agent 框架与编排 ----------
    {
      id: 10,
      title: 'Agent 框架与编排',
      subtitle: 'LangGraph、LlamaIndex、CrewAI——框架选型与状态机编排',
      description:
        '当 Agent 复杂到一定规模，手写循环就不够了。本章带你进入框架时代：' +
        '理解 LangGraph 的图状态机模型、CrewAI 的角色协作模型，' +
        '学会用框架表达循环、分支、人工介入（human-in-the-loop）等复杂控制流，并保持代码可维护。',
      difficulty: '高级',
      hours: 12,
      icon: '🕸️',
      accent: 'brand',
      lessons: [
        {
          id: 'L10-01',
          title: 'Agent 框架全景图与选型',
          summary: 'LangChain / LangGraph / LlamaIndex / CrewAI / AutoGen / Smolagents 全景对比。',
          duration: 40,
          type: '理论',
          objectives: [
            '梳理主流框架的设计哲学',
            '从抽象层级理解框架差异',
            '为项目选型建立决策依据',
          ],
          tags: ['LangGraph', 'CrewAI', 'AutoGen', 'Framework Selection'],
          prerequisites: ['L05-02'],
          competency: '框架选型',
        },
        {
          id: 'L10-02',
          title: 'LangGraph：图状态机与可微编排',
          summary: '用节点和边表达 Agent 控制流。StateGraph、条件边、循环与检查点。',
          duration: 55,
          type: '实战',
          objectives: [
            '用 StateGraph 定义 Agent 状态',
            '实现条件分支与循环',
            '使用 checkpointer 做状态持久化',
          ],
          tags: ['LangGraph', 'StateGraph', 'Checkpointing'],
          prerequisites: ['L10-01', 'L07-03'],
          competency: '框架编排',
        },
        {
          id: 'L10-03',
          title: 'Human-in-the-Loop：人工介入编排',
          summary: '关键决策前暂停，等人工审核再继续。tool review、approval 工作流。',
          duration: 40,
          type: '实战',
          objectives: [
            '实现"工具调用前人工审批"',
            '处理中断后的状态恢复',
            '设计审核 UI 与超时降级',
          ],
          tags: ['HITL', 'Approval', 'Interrupt', 'LangGraph'],
          prerequisites: ['L10-02'],
          competency: '框架编排',
        },
        {
          id: 'L10-04',
          title: 'CrewAI：角色驱动的多 Agent 协作',
          summary: '定义 Crew、Agent、Task、Process，用角色分工解决复杂任务。',
          duration: 45,
          type: '实战',
          objectives: [
            '定义角色、目标与背景',
            '编排 sequential / hierarchical 流程',
            '理解 CrewAI 与 LangGraph 的取舍',
          ],
          tags: ['CrewAI', 'Role-based', 'Multi-Agent'],
          prerequisites: ['L10-01'],
          competency: '框架编排',
        },
        {
          id: 'L10-05',
          title: '流式输出与前端集成',
          summary: '把 Agent 的中间思考过程实时流式推到前端，打造"看得见的智能"。',
          duration: 40,
          type: '实战',
          objectives: [
            '流式传输 token 与中间步骤',
            '设计前端事件消费协议',
            '实现可中断的流式交互',
          ],
          tags: ['Streaming', 'SSE', 'Frontend Integration'],
          prerequisites: ['L10-02'],
          competency: '前端集成',
        },
        {
          id: 'L10-06',
          title: '框架抽象的代价与反模式',
          summary: '框架不是免费的。黑盒、调试困难、过度封装的常见陷阱。',
          duration: 30,
          type: '复盘',
          objectives: [
            '识别"框架绑架"的反模式',
            '判断何时退回手写实现',
            '保持对框架底层的可观测',
          ],
          tags: ['Anti-patterns', 'Framework Lock-in', 'Engineering'],
          prerequisites: ['L10-04'],
          competency: '架构决策',
        },
      ],
      project: {
        id: 'P10',
        title: '深度研究 Agent（LangGraph 编排 + HITL）',
        summary:
          '用 LangGraph 编排一个多步骤深度研究 Agent：规划→并行搜索→去重→综合→人工审阅→定稿。' +
          '关键节点支持人工介入审核，全程状态可持久化、可恢复、可重放。',
        module: 10,
        difficulty: '高级',
        deliverables: [
          'LangGraph 状态图编排',
          '并行搜索 + 去重 + 综合',
          'Human-in-the-loop 审核节点',
          '状态持久化与重放',
          '流式前端可视化',
        ],
        stack: ['LangGraph', 'Python', 'SSE', 'React 前端'],
      },
    },

    // ================================================================
    // 阶段五：多智能体与多模态篇（M11-M12）
    // ================================================================

    // ---------- M11：多智能体系统 ----------
    {
      id: 11,
      title: '多智能体系统',
      subtitle: '协作、辩论、监督——构建 Agent 团队',
      description:
        '单个 Agent 能力有上限。本章进入多智能体领域：探讨 Agent 间的通信、协作模式、' +
        '角色分工与监督机制。理解 debate、supervisor、swarm 等拓扑，并直面多 Agent 的协调成本与失败模式。',
      difficulty: '高级',
      hours: 10,
      icon: '👥',
      accent: 'brand',
      lessons: [
        {
          id: 'L11-01',
          title: '多智能体拓扑：链式、星型、网状、层级',
          summary: '不同协作结构的特点与适用场景，以及通信复杂度的增长。',
          duration: 35,
          type: '理论',
          objectives: [
            '识别四种典型多 Agent 拓扑',
            '评估通信复杂度 O(n²) 的风险',
            '为任务选择合适的协作结构',
          ],
          tags: ['Topology', 'Supervisor', 'Swarm', 'Networked'],
          prerequisites: ['L10-02'],
          competency: '多 Agent 架构',
        },
        {
          id: 'L11-02',
          title: 'Supervisor 模式：中心化调度',
          summary: '一个"主管"Agent 分派任务给下属，收集结果。LangGraph supervisor 实现。',
          duration: 45,
          type: '实战',
          objectives: [
            '实现 supervisor 编排',
            '处理下属 Agent 的失败与重试',
            '权衡中心化与去中心化',
          ],
          tags: ['Supervisor', 'LangGraph', 'Orchestration'],
          prerequisites: ['L11-01'],
          competency: '多 Agent 编排',
        },
        {
          id: 'L11-03',
          title: 'Debate 与多视角辩论',
          summary: '让多个 Agent 立场对立、相互质疑，提升答案的稳健性与全面性。',
          duration: 40,
          type: '理论',
          objectives: [
            '设计 debate 的轮次与角色',
            '防止"群体思维"坍缩',
            '用辩论提升复杂决策质量',
          ],
          tags: ['Debate', 'Multi-perspective', 'Robustness'],
          prerequisites: ['L11-01'],
          competency: '多 Agent 架构',
        },
        {
          id: 'L11-04',
          title: 'AutoGen / AG2 对话式多 Agent',
          summary: '用对话消息驱动多 Agent 协作。conversable agent 模式。',
          duration: 45,
          type: '实战',
          objectives: [
            '用 AutoGen 编排多 Agent 对话',
            '设计终止条件',
            '处理对话的发散与收敛',
          ],
          tags: ['AutoGen', 'Conversable Agent', 'Group Chat'],
          prerequisites: ['L11-02'],
          competency: '多 Agent 编排',
        },
        {
          id: 'L11-05',
          title: '多 Agent 的协调成本与失败模式',
          summary: 'Agent 越多越笨？死循环、互相恭维、责任推诿等典型病态行为及对策。',
          duration: 35,
          type: '复盘',
          objectives: [
            '识别多 Agent 的典型病态行为',
            '设计护栏与终止策略',
            '量化"更多 Agent"的边际收益递减',
          ],
          tags: ['Failure Modes', 'Coordination Cost', 'Guardrails'],
          prerequisites: ['L11-04'],
          competency: '架构决策',
        },
      ],
      project: {
        id: 'P11',
        title: '多 Agent 软件开发团队',
        summary:
          '组建一个由 Product Manager、Architect、Coder、Reviewer、Tester 组成的多 Agent 软件团队，' +
          '用 supervisor + debate 混合拓扑协作完成一个真实的小型软件需求：从需求拆解到代码交付与评审。',
        module: 11,
        difficulty: '高级',
        deliverables: [
          '5 角色多 Agent 团队',
          'Supervisor + Debate 混合编排',
          '代码生成 + 评审闭环',
          '病态行为护栏',
        ],
        stack: ['LangGraph', 'AutoGen', 'Python', 'Git 集成'],
      },
    },

    // ---------- M12：Multi-modal Agent ----------
    {
      id: 12,
      title: 'Multi-modal Agent',
      subtitle: '超越文本——让 Agent 看见、听见、理解多模态世界',
      description:
        '真实世界的交互不只有文本。本章将 Agent 的能力边界扩展到视觉、语音、视频：' +
        '从图片分析与 OCR 文档理解，到语音实时对话流水线，再到视频的时序理解与关键片段提取。' +
        '最终构建一个能同时处理文本、图片、语音、视频的跨模态智能助手。',
      difficulty: '专家',
      hours: 10,
      icon: '👁️',
      accent: 'brand',
      lessons: [
        {
          id: 'L12-01',
          title: '多模态模型能力对比：GPT-4o / Gemini / Claude 视觉',
          summary: '主流多模态模型的能力边界、API 差异与选型指南。',
          duration: 35,
          type: '理论',
          objectives: [
            '对比 GPT-4o / Gemini / Claude 的视觉能力差异',
            '理解多模态 API 的输入格式（base64 / URL / 文件）',
            '为不同模态任务选择合适的模型',
          ],
          tags: ['GPT-4o', 'Gemini', 'Claude Vision', 'Multi-modal'],
          prerequisites: ['L01-04'],
          competency: '多模态选型',
        },
        {
          id: 'L12-02',
          title: '视觉理解 Agent：图片分析、图表解读、OCR、文档理解',
          summary: '让 Agent "看懂"图片。从物体识别到复杂图表的数据提取。',
          duration: 45,
          type: '实战',
          objectives: [
            '实现图片内容分析与描述生成',
            '从图表中提取结构化数据',
            '构建 OCR + 文档理解的完整链路',
          ],
          tags: ['Vision', 'OCR', 'Chart Analysis', 'Document Understanding'],
          prerequisites: ['L12-01', 'L06-01'],
          competency: '多模态工程',
        },
        {
          id: 'L12-03',
          title: '语音交互 Agent：STT → LLM → TTS 实时流水线',
          summary: '语音输入→模型处理→语音输出。构建实时语音对话 Agent。',
          duration: 45,
          type: '实战',
          objectives: [
            '集成 STT（Whisper/Deepgram）实现语音转文本',
            '集成 TTS（ElevenLabs/Edge TTS）实现文本转语音',
            '处理语音交互中的打断、停顿与流畅性',
          ],
          tags: ['STT', 'TTS', 'Whisper', 'Voice Agent'],
          prerequisites: ['L12-01'],
          competency: '多模态工程',
        },
        {
          id: 'L12-04',
          title: '视频理解 Agent：帧采样、时序分析、关键片段提取',
          summary: '视频的信息密度高且有时序性。如何让 Agent 理解视频内容。',
          duration: 40,
          type: '实战',
          objectives: [
            '实现视频帧采样策略（均匀/关键帧/场景变化）',
            '用多模态模型做时序分析与事件定位',
            '提取视频的关键片段并生成摘要',
          ],
          tags: ['Video', 'Frame Sampling', 'Temporal Analysis'],
          prerequisites: ['L12-02'],
          competency: '多模态工程',
        },
        {
          id: 'L12-05',
          title: '视觉 Agent 专项实战：复杂图表与文档的深度解析',
          summary: '聚焦视觉模态的深度实战：多页文档理解、混合图表解析、表格结构化提取。',
          duration: 50,
          type: '实战',
          objectives: [
            '实现多页 PDF 文档的结构化理解',
            '从混合图表（柱状图+折线图）中提取多维度数据',
            '设计表格结构化提取与校验管道',
          ],
          tags: ['Document AI', 'Chart Parsing', 'Table Extraction'],
          prerequisites: ['L12-02'],
          competency: '多模态工程',
        },
      ],
      project: {
        id: 'P12',
        title: '多模态内容分析 Agent',
        summary:
          '构建一个支持图片、语音、视频三种输入模态的内容分析 Agent。' +
          '用户上传图片→自动识别内容并提取关键信息；上传语音→转写+摘要+情感分析；' +
          '上传视频→关键帧提取+时序事件标注+视频摘要。最终输出结构化的多模态分析报告。',
        module: 12,
        difficulty: '专家',
        deliverables: [
          '多模态输入路由',
          '图片分析 + OCR + 图表提取',
          '语音转写 + 摘要 + 情感',
          '视频关键帧 + 事件标注 + 摘要',
          '统一结构化报告',
        ],
        stack: ['Python', 'GPT-4o', 'Whisper', 'OpenCV', 'FFmpeg'],
      },
    },

    // ================================================================
    // 阶段六：质量保障篇（M13）
    // ================================================================

    // ---------- M13：评估、护栏、测试与可观测性 ----------
    {
      id: 13,
      title: '评估、护栏、测试与可观测性',
      subtitle: '让 Agent 可度量、可管控、可信任、可测试',
      description:
        '能跑起来不等于能上线。本章是 Agent 走向生产的关键工程能力：' +
        '建立 Agent 评估集与自动化评测、接入全链路 tracing、实施 NeMo Guardrails 护栏系统、' +
        '搭建 Agent 测试金字塔与回归测试体系，以及对抗 Prompt 注入、越狱、数据泄露等安全威胁。',
      difficulty: '高级',
      hours: 16,
      icon: '📊',
      accent: 'brand',
      lessons: [
        {
          id: 'L13-01',
          title: 'Agent 评估方法论',
          summary: '如何给"会做决策的 Agent"打分？任务成功率、轨迹评估、LLM-as-Judge。',
          duration: 40,
          type: '理论',
          objectives: [
            '区分结果评估与轨迹评估',
            '设计 Agent 评测集',
            '应用 LLM-as-a-Judge',
          ],
          tags: ['Evaluation', 'LLM-as-Judge', 'Trajectory Eval'],
          prerequisites: ['L05-02'],
          competency: '评估体系',
        },
        {
          id: 'L13-02',
          title: '搭建自动化评测流水线',
          summary: '把评测做成 CI。用 LangSmith / 自建框架做回归与质量门禁。',
          duration: 45,
          type: '实战',
          objectives: [
            '建立可回归的评测数据集',
            '集成进 CI/CD 做质量门禁',
            '追踪 Prompt/模型变更的影响',
          ],
          tags: ['CI/CD', 'LangSmith', 'Regression'],
          prerequisites: ['L13-01'],
          competency: '评估工程',
        },
        {
          id: 'L13-03',
          title: '全链路可观测性：Trace、Span、Token',
          summary: 'OpenTelemetry 思路接入 Agent。每一步推理、工具调用都可追溯。',
          duration: 45,
          type: '实战',
          objectives: [
            '为 Agent 接入 tracing',
            '可视化调用链与 Token 消耗',
            '定位延迟与成本瓶颈',
          ],
          tags: ['Tracing', 'OpenTelemetry', 'LangSmith', 'Arize'],
          prerequisites: ['L06-06'],
          competency: '可观测性',
        },
        {
          id: 'L13-04',
          title: '护栏系统：NeMo Guardrails、输入/输出护栏、话题边界',
          summary: '用护栏系统管控 Agent 行为。输入过滤、输出校验、话题边界控制。',
          duration: 45,
          type: '实战',
          objectives: [
            '用 NeMo Guardrails 定义对话规则',
            '实现输入护栏（PII 检测、敏感词过滤、注入检测）',
            '实现输出护栏（事实校验、格式校验、安全审查）',
          ],
          tags: ['Guardrails', 'NeMo', 'Input Guard', 'Output Guard'],
          prerequisites: ['L05-02'],
          competency: '安全护栏',
        },
        {
          id: 'L13-05',
          title: 'Prompt 注入与越狱攻防',
          summary: 'Agent 最大的安全风险。注入路径、防御纵深与不可信数据隔离。',
          duration: 45,
          type: '理论',
          objectives: [
            '识别直接与间接 Prompt 注入',
            '理解越狱（jailbreak）手法',
            '建立"不可信内容隔离"防御',
          ],
          tags: ['Prompt Injection', 'Jailbreak', 'Security'],
          prerequisites: ['L13-04'],
          competency: '安全工程',
        },
        {
          id: 'L13-06',
          title: '工具权限沙箱与数据安全',
          summary: 'Agent 能调工具就能搞破坏。权限最小化、代码执行沙箱、数据脱敏。',
          duration: 40,
          type: '实战',
          objectives: [
            '设计最小权限工具集',
            '用沙箱隔离代码执行',
            '敏感数据脱敏与审计日志',
          ],
          tags: ['Sandbox', 'Least Privilege', 'Data Masking'],
          prerequisites: ['L09-04', 'L13-04'],
          competency: '安全工程',
        },
        {
          id: 'L13-07',
          title: 'Agent 测试策略：单元测试、集成测试与端到端测试',
          summary: 'Agent 不是普通程序。如何为"会做决策的系统"建立测试金字塔。',
          duration: 45,
          type: '理论',
          objectives: [
            '设计 Agent 的测试金字塔（单元→集成→E2E）',
            '为工具调用、Prompt、Agent Loop 分别编写测试',
            '建立测试覆盖率与质量门禁',
          ],
          tags: ['Testing', 'Unit Test', 'Integration', 'E2E'],
          prerequisites: ['L13-01'],
          competency: '测试工程',
        },
        {
          id: 'L13-08',
          title: 'Mock LLM 与 Agent 回归测试体系',
          summary: 'LLM 输出不确定怎么测？Mock LLM、录制回放、确定性测试策略。',
          duration: 45,
          type: '实战',
          objectives: [
            '用 Mock LLM 实现确定性测试',
            '录制-回放 LLM 响应做回归测试',
            '搭建 Agent 持续回归测试流水线',
          ],
          tags: ['Mock LLM', 'Record-Replay', 'Regression'],
          prerequisites: ['L13-02', 'L13-07'],
          competency: '测试工程',
        },
      ],
      project: {
        id: 'P13',
        title: '生产级 Agent 质量与安全基线',
        summary:
          '为你此前的 Agent 项目补齐生产化能力：搭建自动化评测流水线（含 LLM-as-Judge）、' +
          '接入全链路 tracing、实施 NeMo Guardrails 护栏、Prompt 注入红队测试与工具沙箱加固、' +
          '建立 Mock LLM 回归测试体系，输出一份可上线的质量与安全报告。',
        module: 13,
        difficulty: '高级',
        deliverables: [
          '自动化评测流水线 + CI 门禁',
          '全链路 tracing 面板',
          'NeMo Guardrails 护栏配置',
          'Prompt 注入红队测试报告',
          '工具沙箱加固',
          'Mock LLM 回归测试套件',
        ],
        stack: ['LangSmith', 'OpenTelemetry', 'NeMo Guardrails', 'Docker Sandbox', 'CI/CD'],
      },
    },

    // ================================================================
    // 阶段七：架构设计与生产落地篇（M14-M16）
    // ================================================================

    // ---------- M14：Agent 架构设计 ----------
    {
      id: 14,
      title: 'Agent 架构设计',
      subtitle: '从"能实现"到"会设计"——架构决策、案例拆解与平台思维',
      description:
        '这是架构师成长的核心模块。你将学习如何做 Agent 系统的架构设计决策：' +
        '掌握架构决策框架（ADR）与 Trade-off 量化分析方法，拆解业界真实 Agent 产品的架构（Cursor/Devin/Perplexity 等），' +
        '理解 Agent 平台架构（多租户、可扩展、Agent-as-a-Service），并建立架构演进与版本兼容的系统思维。',
      difficulty: '专家',
      hours: 10,
      icon: '🏛️',
      accent: 'brand',
      lessons: [
        {
          id: 'L14-01',
          title: 'Agent 架构决策框架：ADR、Trade-off 量化分析',
          summary: '架构师的核心能力不是"能实现"，而是"会决策"。建立 Agent 架构决策方法论。',
          duration: 45,
          type: '理论',
          objectives: [
            '掌握 Architecture Decision Record（ADR）的编写方法',
            '建立 Agent 架构的 Trade-off 量化分析框架（成本/延迟/可靠性/可维护性）',
            '为常见 Agent 架构选择建立决策树',
          ],
          tags: ['ADR', 'Trade-off', 'Architecture Decision'],
          prerequisites: ['L05-06', 'L10-06'],
          competency: '架构决策',
        },
        {
          id: 'L14-02',
          title: '参考架构案例拆解 I：Cursor 与 GitHub Copilot',
          summary: 'AI 编程助手的架构是怎么设计的？从 Copilot 的补全到 Cursor 的 Agent 模式。',
          duration: 45,
          type: '理论',
          objectives: [
            '拆解 GitHub Copilot 的上下文组装与补全架构',
            '分析 Cursor 的 Agent 模式：工具链、Codebase 索引、多轮编辑',
            '提炼 AI 编程助手的架构模式与设计权衡',
          ],
          tags: ['Case Study', 'Cursor', 'Copilot', 'AI Coding'],
          prerequisites: ['L14-01'],
          competency: '架构分析',
        },
        {
          id: 'L14-03',
          title: '参考架构案例拆解 II：Devin 与 Claude Code 的自主编程系统',
          summary: '自主编程 Agent 的架构深度拆解。从规划到执行到验证的完整闭环。',
          duration: 45,
          type: '理论',
          objectives: [
            '分析 Devin 的自主编程架构：规划→执行→验证→修复循环',
            '拆解 Claude Code 的工具链设计与沙箱策略',
            '理解自主 Agent 的可靠性保障与安全边界',
          ],
          tags: ['Case Study', 'Devin', 'Claude Code', 'Autonomous Agent'],
          prerequisites: ['L14-02'],
          competency: '架构分析',
        },
        {
          id: 'L14-04',
          title: '参考架构案例拆解 III：Perplexity 与 ChatGPT 的 RAG+Agent 架构',
          summary: '搜索型 Agent 与对话型 Agent 的架构对比。RAG、工具、多轮推理如何协同。',
          duration: 45,
          type: '理论',
          objectives: [
            '拆解 Perplexity 的搜索→推理→引用→生成架构',
            '分析 ChatGPT 的工具调用与多轮推理架构',
            '对比搜索型 Agent 与对话型 Agent 的设计权衡',
          ],
          tags: ['Case Study', 'Perplexity', 'ChatGPT', 'Search Agent'],
          prerequisites: ['L14-02'],
          competency: '架构分析',
        },
        {
          id: 'L14-05',
          title: 'Agent 平台架构：多租户、可扩展、Agent-as-a-Service',
          summary: '不是单个 Agent，而是 Agent 平台。多租户隔离、水平扩展、Agent 即服务。',
          duration: 40,
          type: '理论',
          objectives: [
            '设计 Agent 平台的多租户架构（数据隔离/资源隔离/配额管理）',
            '规划 Agent 服务的水平扩展策略（无状态化/分片/负载均衡）',
            '理解 Agent-as-a-Service 的平台化架构模式',
          ],
          tags: ['Platform', 'Multi-tenant', 'Scalability', 'AaaS'],
          prerequisites: ['L14-01'],
          competency: '平台架构',
        },
        {
          id: 'L14-06',
          title: '架构演进、版本兼容与治理',
          summary: 'Agent 系统不是一次性交付。版本迁移、向后兼容、数据治理与合规审计。',
          duration: 35,
          type: '理论',
          objectives: [
            '设计 Agent 系统的版本演进策略（Prompt/工具/模型的三维版本管理）',
            '处理向后兼容与灰度迁移',
            '建立 Agent 数据治理与合规审计框架',
          ],
          tags: ['Evolution', 'Versioning', 'Governance', 'Compliance'],
          prerequisites: ['L14-05'],
          competency: '架构治理',
        },
      ],
      project: {
        id: 'P14',
        title: 'Agent 架构设计文档',
        summary:
          '选择一个真实业务场景（如企业智能客服、研发助手、数据分析 Agent），' +
          '产出完整的架构设计文档：包含架构决策记录（ADR）、系统架构图、' +
          'Trade-off 分析、容量估算、安全方案与演进规划。' +
          '要求对标至少一个业界参考架构。',
        module: 14,
        difficulty: '专家',
        deliverables: [
          '架构决策记录（ADR）至少 5 条',
          '系统架构图与数据流图',
          'Trade-off 量化分析报告',
          '容量估算与成本模型',
          '安全方案与合规策略',
          '架构演进路线图',
        ],
        stack: ['ADR', 'Architecture Diagram', 'Capacity Model', 'Cost Model'],
      },
    },

    // ---------- M15：生产架构与运维 ----------
    {
      id: 15,
      title: '生产架构与运维',
      subtitle: '从"能部署"到"能运维"——高可用、监控、故障应急与灰度发布',
      description:
        'Agent 上线只是开始。本章覆盖 Agent 系统的生产架构与运维全链路：' +
        'API 网关、任务队列、语义缓存、并发限流的基础架构，' +
        '成本-延迟-质量的三角优化，监控告警体系，故障应急与容灾恢复，' +
        '灰度发布与 A/B 测试策略，以及 Agent 产品的 UX 设计原则。',
      difficulty: '专家',
      hours: 12,
      icon: '🚀',
      accent: 'brand',
      lessons: [
        {
          id: 'L15-01',
          title: '生产架构：网关、队列、缓存、限流',
          summary: '把 Agent 跑成高可用服务。API 网关、任务队列、语义缓存、并发限流。',
          duration: 50,
          type: '实战',
          objectives: [
            '设计 Agent 服务的生产架构',
            '引入语义缓存降本',
            '处理长任务的异步队列',
          ],
          tags: ['Gateway', 'Queue', 'Semantic Cache', 'Rate Limit'],
          prerequisites: ['L07-04', 'L14-05'],
          competency: '生产架构',
        },
        {
          id: 'L15-02',
          title: '成本、延迟与质量的三角优化',
          summary: '生产环境的永恒难题。模型路由、缓存、蒸馏、speculative 优化策略。',
          duration: 40,
          type: '理论',
          objectives: [
            '量化成本-延迟-质量三角',
            '用模型路由与缓存降本',
            '设计分级推理策略',
          ],
          tags: ['Cost', 'Latency', 'Model Routing', 'Cache'],
          prerequisites: ['L15-01'],
          competency: '性能优化',
        },
        {
          id: 'L15-03',
          title: 'Agent 系统监控与告警体系',
          summary: 'Agent 的监控不同于传统服务。质量指标、行为指标、成本指标的立体监控。',
          duration: 45,
          type: '实战',
          objectives: [
            '设计 Agent 专属的监控指标体系（质量/行为/成本/性能）',
            '搭建告警规则与通知链路',
            '实现 SLA 定义与仪表盘',
          ],
          tags: ['Monitoring', 'Alerting', 'SLA', 'Dashboard'],
          prerequisites: ['L13-03'],
          competency: '运维工程',
        },
        {
          id: 'L15-04',
          title: '故障应急与容灾恢复：Incident Response',
          summary: 'Agent 系统出故障了怎么办？故障分级、应急响应、容灾切换与事后复盘。',
          duration: 40,
          type: '理论',
          objectives: [
            '建立 Agent 故障分级与应急响应流程',
            '设计容灾切换与降级预案',
            '执行故障复盘（Postmortem）与改进闭环',
          ],
          tags: ['Incident Response', 'Disaster Recovery', 'Postmortem'],
          prerequisites: ['L15-03', 'L07-05'],
          competency: '运维工程',
        },
        {
          id: 'L15-05',
          title: '灰度发布、A/B 测试与回滚策略',
          summary: 'Agent 的变更如何安全上线？灰度发布、A/B 测试与一键回滚。',
          duration: 40,
          type: '实战',
          objectives: [
            '设计 Agent 的灰度发布策略（Prompt/模型/工具的独立灰度）',
            '搭建 A/B 测试框架与统计显著性判断',
            '实现一键回滚与版本快照',
          ],
          tags: ['Canary Release', 'A/B Testing', 'Rollback'],
          prerequisites: ['L15-03'],
          competency: '发布工程',
        },
        {
          id: 'L15-06',
          title: 'Agent 产品的 UX 设计',
          summary: 'Agent 不是搜索框。透明度、可控性、错误恢复的产品设计原则。',
          duration: 35,
          type: '理论',
          objectives: [
            '设计 Agent 产品的透明度（show your work）',
            '给用户恰当下放控制权',
            '设计优雅的错误恢复体验',
          ],
          tags: ['UX', 'Transparency', 'Controllability'],
          prerequisites: ['L10-05'],
          competency: '产品设计',
        },
      ],
      project: {
        id: 'P15',
        title: '生产级 Agent 部署与运维基线',
        summary:
          '将此前开发的 Agent 项目部署到生产环境：搭建完整的网关+队列+缓存+限流架构，' +
          '接入监控告警体系，配置灰度发布流程，编写运维手册与故障应急预案，' +
          '完成一次完整的故障注入与恢复演练。',
        module: 15,
        difficulty: '专家',
        deliverables: [
          '生产部署架构（网关+队列+缓存+限流）',
          '监控告警仪表盘与 SLA 定义',
          '灰度发布与一键回滚流程',
          '运维手册与故障应急预案',
          '故障注入演练报告',
        ],
        stack: ['Docker', 'K8s', 'Redis', 'Prometheus', 'Grafana'],
      },
    },

    // ---------- M16：前沿范式与毕业设计 ----------
    {
      id: 16,
      title: '前沿范式与毕业设计',
      subtitle: 'Computer Use、A2A 协议、模型定制化与毕业大考',
      description:
        '最后一章面向前沿与毕业。你将接触 Computer Use（让 Agent 操作 GUI）、' +
        'Agent-to-Agent（A2A）通信协议等新范式，了解模型定制化（微调/LoRA/DPO）的工程决策，' +
        '并以一份毕业设计完成从"玩家"到"架构师"的最终跨越。',
      difficulty: '专家',
      hours: 8,
      icon: '🎓',
      accent: 'brand',
      lessons: [
        {
          id: 'L16-01',
          title: 'Computer Use：让 Agent 操控图形界面',
          summary: '不靠 API，直接看屏幕、点鼠标、敲键盘。GUI Agent 的能力与边界。',
          duration: 40,
          type: '理论',
          objectives: [
            '理解 Computer Use 的工作机制',
            '识别 GUI Agent 的可靠性与成本',
            '评估适用场景与替代方案',
          ],
          tags: ['Computer Use', 'GUI Agent', 'Claude'],
          prerequisites: ['L06-05'],
          competency: '前沿技术',
        },
        {
          id: 'L16-02',
          title: 'A2A 协议与 Agent 互联',
          summary: 'Agent 之间如何通信？Google A2A 协议、agent card、任务委托。',
          duration: 40,
          type: '理论',
          objectives: [
            '理解 A2A 协议的架构',
            '区分 A2A 与 MCP 的层次',
            '评估跨组织 Agent 协作的前景',
          ],
          tags: ['A2A', 'Agent Card', 'Interoperability'],
          prerequisites: ['L06-04', 'L11-01'],
          competency: '前沿技术',
        },
        {
          id: 'L16-03',
          title: '模型定制化概览：微调、LoRA、DPO 的工程决策',
          summary: '什么时候该微调？LoRA/DPO 的原理速览与 ROI 评估框架。',
          duration: 40,
          type: '理论',
          objectives: [
            '理解 Fine-tuning / LoRA / DPO / RLHF 的定位与适用场景',
            '建立"该不该微调"的工程决策框架',
            '评估微调的 ROI 与替代方案（RAG/Few-shot/Prompt 优化）',
          ],
          tags: ['Fine-tuning', 'LoRA', 'DPO', 'Model Customization'],
          prerequisites: ['L01-04'],
          competency: '模型选型决策',
        },
        {
          id: 'L16-04',
          title: '回顾与你的成长地图',
          summary: '串联全书，绘制从 Prompt 到多智能体到架构设计的完整知识图谱，规划后续专精方向。',
          duration: 30,
          type: '复盘',
          objectives: [
            '串联 16 大模块的知识脉络',
            '识别自己的专精方向',
            '建立持续学习的信息源',
          ],
          tags: ['Knowledge Map', 'Career', 'Continuous Learning'],
          prerequisites: ['L14-01'],
          competency: '职业规划',
        },
      ],
      project: {
        id: 'P16',
        title: '毕业设计：生产级 Agent 产品',
        summary:
          '综合全书所学，设计并交付一个可部署的生产级 Agent 产品（如智能客服、研发助手、' +
          '数据分析 Agent 等），要求：多 Agent 协作 + MCP 工具 + RAG 记忆 + 评测流水线 + ' +
          '全链路可观测 + 安全加固 + 生产部署架构 + 运维基线，' +
          '并配套架构设计文档（ADR）、前端 UI 与部署方案。',
        module: 16,
        difficulty: '专家',
        deliverables: [
          '完整的生产级 Agent 产品',
          '多 Agent + MCP + RAG 全栈',
          '评测 + 可观测 + 安全基线',
          '生产部署架构 + 运维手册',
          '架构设计文档（ADR）',
          '前端 UI + 部署方案',
          '毕业答辩与复盘报告',
        ],
        stack: ['LangGraph', 'MCP', 'RAG', 'Docker', 'K8s', '前端', 'CI/CD'],
      },
    },
  ],
}

// ============ 衍生统计 ============

export const totalLessons = curriculum.modules.reduce(
  (sum, m) => sum + m.lessons.length,
  0,
)

export const totalMinutes = curriculum.modules.reduce(
  (sum, m) => sum + m.lessons.reduce((s, l) => s + l.duration, 0),
  0,
)

export const totalHours = Math.round((totalMinutes / 60) * 10) / 10

export const totalProjects = curriculum.modules.filter((m) => m.project).length

export const allProjects = curriculum.modules
  .map((m) => m.project)
  .filter((p): p is NonNullable<typeof p> => Boolean(p))

/** 学习阶段分组 */
export const stages = [
  { id: 1, name: '筑基篇', range: [1, 2], color: 'from-emerald-500 to-teal-500' },
  { id: 2, name: '上下文与知识篇', range: [3, 4], color: 'from-cyan-500 to-blue-500' },
  { id: 3, name: 'Agent 核心篇', range: [5, 7], color: 'from-brand-500 to-indigo-500' },
  { id: 4, name: '记忆执行与编排篇', range: [8, 10], color: 'from-violet-500 to-purple-500' },
  { id: 5, name: '多智能体与多模态篇', range: [11, 12], color: 'from-fuchsia-500 to-pink-500' },
  { id: 6, name: '质量保障篇', range: [13, 13], color: 'from-amber-500 to-orange-500' },
  { id: 7, name: '架构设计与生产落地篇', range: [14, 16], color: 'from-rose-500 to-red-500' },
] as const
