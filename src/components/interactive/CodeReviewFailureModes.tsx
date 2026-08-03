/**
 * 代码审查失败模式对照器 —— M17 L17-09
 * 学员选择审查模式（风格/逻辑/安全/性能/体验）→ 展示该模式下 AI 审查常见的五种失败方式和应对策略
 */
import { useState } from 'react'

interface FailureMode {
  mode: string
  symptom: string
  cause: string
  fix: string
}

const MODES: Record<string, { name: string; failures: FailureMode[] }> = {
  style: {
    name: '风格审查',
    failures: [
      { mode: '挑剔过度', symptom: '修改了所有变量名，包括你不打算改的', cause: 'AI 不懂命名背后的业务约定', fix: '约定文件 + "禁止重命名"限定' },
      { mode: '风格漂移', symptom: '这次建议 snake_case，上次建议 camelCase', cause: '每次独立判断，不参考历史', fix: '提供 lint 配置 + "遵循现有风格"提示' },
      { mode: '遗漏', symptom: '改了一处但忘了相关文件', cause: '无法理解跨文件的命名影响', fix: '先让 AI 列出所有影响的文件，再逐个改' },
      { mode: '破坏可读性', symptom: '建议把 15 行拆成 25 行的小函数', cause: '机械执行"函数要短"的原则', fix: '附加约束："保持当前函数的逻辑内聚性"' },
      { mode: '格式冲突', symptom: '建议的格式和项目 prettier 配置冲突', cause: 'AI 看不到你的 prettier 配置', fix: '把 .eslintrc/.prettierrc 加入上下文' },
    ],
  },
  logic: {
    name: '逻辑审查',
    failures: [
      { mode: '漏判', symptom: '明显的边界条件漏了（空数组、负值、溢出）', cause: 'AI 主要关注代码结构而非语义边界', fix: '显式列出边界条件清单："检查空输入、极值、null"' },
      { mode: '误判', symptom: '把正确的并发控制标记为"可能有竞态"', cause: '不理解你的分布式锁或幂等设计', fix: '提供架构上下文文档，标注已知的安全设计模式' },
      { mode: '过度防御', symptom: '每条 if 后面都建议加空值检查', cause: '保守策略，宁多勿少', fix: '明确写"仅对用户输入做校验，内部断言用 assert"' },
      { mode: '忽略完整性', symptom: '改了函数签名但没建议改调用方', cause: '审查范围限制在 diff 内', fix: '要求"列出所有调用此函数的文件并检查兼容性"' },
      { mode: '盲信注释', symptom: '相信了过时的注释"TODO: optimize later"', cause: 'AI 把注释当作权威信息', fix: '注释前加日期 + "review:"让 AI 也做校验' },
    ],
  },
  security: {
    name: '安全审查',
    failures: [
      { mode: '注意力不均', symptom: '关注了输入校验但漏了日志里的敏感信息脱敏', cause: '对常见的 XSS/SQL 注入敏感，对隐蔽的信息泄露不敏感', fix: '提供安全审查清单（输入/输出/日志/存储/传输）' },
      { mode: '误报泛滥', symptom: '把 base64 编码当"混淆代码"标记', cause: '不了解你的业务场景中哪些是合法的', fix: '用例外清单 + "已确认安全的模式"白名单' },
      { mode: '忽略权限', symptom: '没检查 API 是否有适当的鉴权', cause: 'AI 通常只看函数体不看中间件配置', fix: '把路由/鉴权中间件也纳入上下文' },
      { mode: '补丁式修复', symptom: '建议在控制器层加校验，但数据库约束才是根本', cause: '倾向于在最近的层次修改', fix: '要求"给出纵深防御的多层修复方案"' },
      { mode: '忽视供应链', symptom: '没检查依赖包的安全漏洞', cause: 'AI 无法实时扫描 CVE', fix: 'CI 中加入 npm audit / pip-audit 作为独立 Gate' },
    ],
  },
  performance: {
    name: '性能审查',
    failures: [
      { mode: '过早优化', symptom: '建议给每个 for 循环加缓存', cause: '对所有循环一视同仁', fix: '附带 profiling 数据 + \u201c只有热点路径才值得优化\u201d' },
      { mode: '忽视数据库', symptom: '关注了循环优化但漏了 N+1 查询', cause: '代码层面看不到 ORM 的 lazy load', fix: '把生成的 SQL 查询日志也放进审查上下文' },
      { mode: '本地思维', symptom: '推荐的优化在单机上有效但在分布式下反而更慢', cause: '不了解部署拓扑', fix: '补充\u201c当前运行在 X 节点集群上，数据分布在 Y 个分片\u201d' },
      { mode: '忽略冷热', symptom: '把一个热点函数和一个冷路径函数放一起优化', cause: '无法从代码本身推断调用频率', fix: '用 `rg`/profiler 获取调用计数，只审高频代码' },
      { mode: '缓存幻觉', symptom: '认为所有 Redis 缓存都是 O(1) ', cause: '不了解你的 key 设计和淘汰策略', fix: '附上缓存配置和 hit rate 数据' },
    ],
  },
}

export function CodeReviewFailureModes() {
  const [active, setActive] = useState<string>('style')

  const mode = MODES[active]

  return (
    <div className="my-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-3">🔍 AI 代码审查的失败模式</h3>
      <p className="text-xs text-gray-400 mb-3">
        AI 做代码审查有固定的盲区。选一种审查类型，看最常见五种失败模式和对应的防法。
      </p>

      {/* 模式选择 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {Object.keys(MODES).map((key) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`px-2.5 py-0.5 text-xs rounded ${
              active === key
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {MODES[key].name}
          </button>
        ))}
      </div>

      {/* 失败模式列表 */}
      <div className="space-y-2">
        {mode.failures.map((f, i) => (
          <div key={i} className="p-2.5 bg-white rounded border text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 font-semibold">{f.mode}</span>
            </div>
            <div className="grid grid-cols-1 gap-1 text-gray-600">
              <div>
                <span className="text-gray-400">症状：</span>{f.symptom}
              </div>
              <div>
                <span className="text-gray-400">原因：</span>{f.cause}
              </div>
              <div>
                <span className="text-green-600 font-medium">对策：</span>{f.fix}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 border-t pt-2">
        💡 AI 审查最有用的方式不是让它"找出所有问题"——它会瞎编——而是
        <strong>你告诉它看什么</strong>（"只检查这段代码的并发安全"），然后你验证它的发现。
      </p>
    </div>
  )
}
