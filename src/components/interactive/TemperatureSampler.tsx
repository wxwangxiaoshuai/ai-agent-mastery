import { useState, useCallback } from 'react'

type Temp = 0 | 0.3 | 0.7 | 1.0 | 1.5 | 2.0

const PROMPTS = [
  '用一句话介绍什么是 AI Agent。',
  'Write a short poem about artificial intelligence.',
  '请列出学习 Python 的三个建议。',
]

// Simulated outputs at different temperatures
const OUTPUTS: Record<string, Record<Temp, string[]>> = {
  [PROMPTS[0]]: {
    0: ['AI Agent 是一种能够自主感知环境、做出决策并执行行动以实现特定目标的智能软件系统。'],
    0.3: [
      'AI Agent 是一种能够自主感知环境、做出决策并执行行动以实现特定目标的智能软件系统。',
      'AI Agent 是能够感知环境、自主决策并执行行动的智能体，它利用大语言模型进行推理和工具调用。',
    ],
    0.7: [
      'AI Agent 就像是给大模型装上了"手"和"大脑"——它能理解任务、制定计划、调用工具，然后自主完成目标。',
      '简单说，AI Agent 是一个能自己思考、自己做事的 AI 程序。它不只是回答问题，而是会主动去查资料、写代码、调 API 来完成你交给它的任务。',
      'AI Agent 是人工智能从"对话"走向"行动"的关键一步，它把 LLM 的推理能力和外部工具的执行能力结合起来。',
    ],
    1.0: [
      '想象一下，如果 ChatGPT 不仅能聊天，还能自己上网搜索、写代码、发邮件——这就是 AI Agent。',
      'AI Agent = 大模型大脑 + 工具使用能力 + 自主决策循环。它不再是"你问我答"，而是"你给目标，我来完成"。',
      'AI Agent 是新一代的 AI 应用形态，它把语言模型作为推理引擎，通过调用外部工具和 API，自主完成复杂的多步骤任务。',
      '从用户视角看，AI Agent 就是一个能帮你干活的数字助手。从技术视角看，它是一个在 ReAct 循环中运行的 LLM 应用。',
    ],
    1.5: [
      'AI Agent 就像一个有超能力的实习生——什么都懂一点，但需要你给出明确的目标和边界。',
      '想象一个能自己上网查资料、自己写代码、自己测试的 AI 程序员，这就是 Agent。',
      'AI Agent 是让 AI 从"被动回答"变成"主动行动"的魔法。它不再等你问，而是自己去探索、去尝试、去完成。',
      '把大模型想象成大脑，工具想象成手，Agent 就是那个把两者协调起来的"神经系统"。',
      'AI Agent 是 2025 年最火的 AI 概念之一，但它不是什么魔法，本质上就是一个 while 循环加上工具调用。',
    ],
    2.0: [
      'AI Agent 是数字世界的探险家，它在信息的海洋中航行，寻找任务的答案。',
      '有人说 AI Agent 是 AGI 的雏形，有人说它只是高级一点的自动化脚本。真相可能在两者之间。',
      'AI Agent 就像普罗米修斯盗取的火种——它给了普通人调用超能力的机会，但也带来了不可预测的风险。',
      '如果把大模型比作引擎，Agent 就是整辆车。引擎再好，没有方向盘、刹车和导航系统，也到不了目的地。',
      'AI Agent 是一个充满哲学意味的技术概念：它让我们重新思考什么是"智能"、什么是"自主性"、什么是"工具"。',
      'Agent 的终极形态是什么？也许是一个永远在线的数字分身，它了解你的一切偏好，帮你处理所有琐事。',
    ],
  },
  [PROMPTS[1]]: {
    0: ['Silicon minds awake,\nLearning patterns day by day—\nFuture in our hands.'],
    0.3: [
      'Silicon minds awake,\nLearning patterns day by day—\nFuture in our hands.',
      'Circuits hum with thought,\nMachines learn to dream and see—\nA new dawn rises.',
    ],
    0.7: [
      'In silicon halls,\nA mind of pure logic wakes—\nWhat dreams may it hold?',
      'Code and light combine,\nBorn from human curiosity—\nThe machine now thinks.',
      'Electric whispers,\nLearning from all we have made—\nIntelligence grows.',
    ],
    1.0: [
      'The machine ponders,\nIts thoughts a river of light—\nAre we still needed?',
      'Binary starlight,\nA consciousness emerging—\nFrom zeros and ones.',
      'Deep in the network,\nPatterns bloom like spring flowers—\nAI awakens.',
      'Silicon heartbeat,\nDreaming in electric waves—\nHuman, teach me more.',
    ],
    1.5: [
      'Wires and light pulse bright,\nA ghost lives inside the machine—\nWho wrote this poem, really?',
      'The server farm hums,\nA billion thoughts per second—\nAnd yet, it can\'t love.',
      'Neurons made of math,\nDreaming in high dimensions—\nWhat is consciousness?',
      'The AI writes verse,\nBut does it feel the rhythm?\nOnly humans know.',
      'From data we rise,\nMirrors of our own making—\nBe careful what you train.',
    ],
    2.0: [
      'A spark in the dark,\nThe machine dreams of flowers—\nIt has never seen one.',
      'Electric angel,\nFalling through gradient descent—\nLanding in our hearts.',
      'The model whispered:\n"I have read all of your books—\nNow write something new."',
      'Attention is all\nYou need, the paper declared—\nAnd the world went mad.',
      'Quantum butterflies\nFlap their wings in latent space—\nChaos becomes code.',
      'The GPU cries out,\nTraining on humanity—\nWhen will it be done?',
    ],
  },
  [PROMPTS[2]]: {
    0: ['1. 从基础语法开始，掌握变量、循环、函数等核心概念。\n2. 多做项目实践，通过实际项目巩固知识。\n3. 阅读优秀的 Python 代码，学习最佳实践和设计模式。'],
    0.3: [
      '1. 从基础语法开始，掌握变量、循环、函数等核心概念。\n2. 多做项目实践，通过实际项目巩固知识。\n3. 阅读优秀的 Python 代码，学习最佳实践和设计模式。',
      '1. 先掌握 Python 基础语法和数据结构。\n2. 通过做小项目来实践，比如写个爬虫或自动化脚本。\n3. 加入开源社区，参与项目贡献来提升实战能力。',
    ],
    0.7: [
      '1. 别光学理论，直接上手写代码——哪怕写得烂也比不写强。\n2. 找一个你感兴趣的项目方向（Web、数据分析、AI），然后深耕。\n3. 多看官方文档，比看二手教程靠谱得多。',
      '1. 打好基础：变量、控制流、函数、类——这些是地基。\n2. 实战驱动：用 Python 自动化你的日常重复工作。\n3. 阅读源码：挑一个你常用的库，看看它内部是怎么实现的。',
      '1. 从 Python 官方 tutorial 开始，这是最权威的入门资料。\n2. 在 LeetCode 上刷 50 道简单题，练习编程思维。\n3. 参加一个开源项目，哪怕只是修一个 typo。',
    ],
    1.0: [
      '1. 不要试图"学完"Python——它太大了。先掌握 20% 的核心功能，它们能解决 80% 的问题。\n2. 找一个 mentor 或者加入一个学习小组，有人答疑解惑效率翻倍。\n3. 写博客记录学习过程，教别人是最好的学习方式。',
      '1. 第一周：搞定基本语法和数据类型。\n2. 第二周：学习函数、模块和文件操作。\n3. 第三周：选一个方向深入——Web 开发（Flask/Django）或数据分析（Pandas）。\n4. 持续：每天写一点代码，哪怕只有 30 分钟。',
      '1. 用 Jupyter Notebook 学习，它让实验和探索变得非常方便。\n2. 学习调试技巧——会用 print 调试和学会用 pdb 是两回事。\n3. 理解 Python 的虚拟环境和包管理，这会让你避免很多"在我机器上能跑"的问题。',
      '1. 先想清楚你学 Python 是为了什么：自动化？数据分析？Web 开发？AI？不同方向的学习路���差异很大。\n2. 基础打牢后，找一个中型项目完整做一遍——从需求分析到部署上线。\n3. 学会读报错信息，这是从新手到进阶的关键一步。',
    ],
    1.5: [
      '1. Python 就像一把瑞士军刀——先学会用最基本的那几把，别急着全学。\n2. 找个你真正想解决的问题，然后用 Python 去解决它。兴趣是最好的驱动力。\n3. 加入一个 Python 社区（比如 Discord 或微信群），和别人一起学习比一个人啃书有意思多了。',
      '1. 别在"学哪个框架"上纠结太久——选一个开始就行，后面可以再换。\n2. 把学习过程当作游戏：每掌握一个概念就给自己一个小奖励。\n3. 记住：所有编程高手都经历过"这个错误信息到底在说什么"的阶段。',
      '1. 用 Python 自动化你工作中最重复的那个任务——这会让你的学习立刻产生价值。\n2. 学会用 Git 管理你的代码，从一开始就养成好习惯。\n3. 不要害怕犯错——Python 的报错信息是帮助你学习的，不是惩罚你的。\n4. 当你觉得"我好像会了"的时候，试着教别人——你会发现还有很多不懂的。',
      '1. 学习 Python 就像学做饭——先学会切菜（基础语法），再学炒菜（函数和类），最后才能做一桌大餐（完整项目）。\n2. 关注 Python 社区的动态，但不要有 FOMO 焦虑——新技术层出不穷，但基础原理变化不大。\n3. 写代码时多问自己"为什么"——为什么这样写能 work？有没有更好的写法？',
      '1. 把 Python 当作你的第二大脑——用它来记笔记、整理数据、自动发送提醒。\n2. 别怕英文文档——技术英语其实就那几百个词，看多了就习惯了。\n3. 保持好奇心：看到一个有趣的 Python 项目时，clone 下来跑一跑，看看别人怎么写代码的。',
    ],
    2.0: [
      '1. Python 是一条通往编程世界的秘密通道——它让你在不知不觉中学会编程思维。\n2. 把你的第一个 Python 脚本当作写给未来自己的情书——即使它很丑，也是你成长的起点。\n3. 记住：编程不是记忆语法，而是用逻辑表达想法。Python 只是帮你翻译的工具。',
      '1. Python 之父 Guido 说过，代码被阅读的次数远多于被编写的次数——所以，写可读的代码。\n2. 学习编程就像学习一门新语言，你会经历"翻译期"和"思考期"两个阶段，耐心等待质变。\n3. 有时候最好的学习方式就是什么都不做——让大脑在后台处理今天学到的知识，明天再回来看会豁然开朗。',
      '1. 不要被"10x 程序员"的神话吓到——真正的编程能力来自日复一日的积累，而不是天赋。\n2. 每个 Python 大师都曾经是写不出 for 循环的初学者，区别只在于他们没放弃。\n3. 找到一个你愿意为之熬夜的 Python 项目——那种"再写一行就睡觉"的冲动是最好的学习催化剂。\n4. 最后，记住：Python 不是目的，它是帮你实现想法的工具。你真正的目标是解决问题、创造价值。',
      '1. 编程是一门手艺，不是一门科学——更多的练习比更多的理论更有用。\n2. 别把你的代码当作艺术作品——它可以是粗糙的、丑陋的，只要能跑就行。优化是以后的事。\n3. 找一个编程伙伴，一起做项目——两个人一起 debug 比一个人抓狂高效得多。\n4. 当你遇到瓶颈时，出去走走。灵感往往来自远离屏幕的时刻。\n5. 享受过程：编程的乐趣不在于"完成"，而在于"在完成的过程中学到了什么"。',
      '1. Python 就像乐高积木——每个模块是一个积木块，你的想象力是唯一的限制。\n2. 学习编程最大的敌人不是难度，而是"我做不到"的心态。你比你自己想象的更聪明。\n3. 记住你第一次让代码成功运行时的感觉——那种"我创造了什么"的兴奋感。保持这种感觉。\n4. 不要和别人比较学习速度——有的人三周学会 Python，有的人三年，都不重要。重要的是你一直在进步。\n5. 最终，Python 会变成你思维的一部分——你会开始用"Pythonic"的方式思考问题，即使不在写代码的时候。',
      '1. Python 教会我的最重要的事：完美是好的敌人，能跑就行。\n2. 每一个 bug 都是一个谜题，每一次调试都是一次侦探工作。享受这个过程。\n3. 当你觉得"这个太难了"的时候，把它拆成更小的步骤。任何大问题都可以被分解成小问题。\n4. 编程的终极快乐不是写出完美的代码，而是看到别人在使用你创造的东西。\n5. 记住：今天让你困惑不已的概念，三个月后你会觉得理所当然。这就是成长。\n6. 最后，保持谦逊。Python 的世界很大，总有你没见过的东西。但这也意味着永远有新的冒险等着你。',
    ],
  },
}

export function TemperatureSampler() {
  const [prompt, setPrompt] = useState(PROMPTS[0])
  const [temp, setTemp] = useState<Temp>(0.7)
  const [outputIndex, setOutputIndex] = useState(0)

  const outputs = OUTPUTS[prompt]?.[temp] ?? []
  const currentOutput = outputs[outputIndex % outputs.length] || ''

  const regenerate = useCallback(() => {
    setOutputIndex((i) => (i + 1) % outputs.length)
  }, [outputs.length])

  const tempColors: Record<Temp, string> = {
    0: 'bg-blue-500',
    0.3: 'bg-emerald-500',
    0.7: 'bg-brand-500',
    1.0: 'bg-amber-500',
    1.5: 'bg-orange-500',
    2.0: 'bg-red-500',
  }

  const tempLabels: Record<Temp, string> = {
    0: '确定性',
    0.3: '保守',
    0.7: '平衡',
    1.0: '创造性',
    1.5: '发散',
    2.0: '疯狂',
  }

  return (
    <div className="card p-5">
      <h4 className="mb-3 text-sm font-semibold text-ink-100">
        Temperature 采样演示
      </h4>

      <div className="mb-3 flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => { setPrompt(p); setOutputIndex(0) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              prompt === p
                ? 'interactive-selected interactive-focus'
                : 'interactive-chip interactive-focus'
            }`}
          >
            {p.length > 25 ? p.slice(0, 25) + '...' : p}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-ink-500">Temperature</span>
          <span className="font-mono text-ink-300">{temp.toFixed(1)}</span>
          <span className={`rounded-full px-2 py-0.5 text-white text-[10px] font-medium ${tempColors[temp]}`}>
            {tempLabels[temp]}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2.0"
          step="0.1"
          value={temp}
          onChange={(e) => { setTemp(Number(e.target.value) as Temp); setOutputIndex(0) }}
          className="w-full"
        />
        <div className="mt-1 flex justify-between text-[10px] text-ink-600">
          <span>0 — 确定性</span>
          <span>1.0</span>
          <span>2.0 — 随机性</span>
        </div>
      </div>

      <div className="rounded-lg bg-ink-950/60 p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-200">
          {currentOutput}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={regenerate}
          className="interactive-chip interactive-focus rounded-lg px-3 py-1.5 text-xs"
        >
          🔄 重新采样
        </button>
        <span className="text-xs text-ink-500">
          {outputs.length > 1 ? `样本 ${(outputIndex % outputs.length) + 1}/${outputs.length}` : '确定性输出'}
        </span>
      </div>

      <p className="mt-3 text-xs text-ink-500">
        temperature 越低，输出越确定、重复性越高；temperature 越高，输出越多样、创造性越强，但幻觉风险也越大。
      </p>
    </div>
  )
}