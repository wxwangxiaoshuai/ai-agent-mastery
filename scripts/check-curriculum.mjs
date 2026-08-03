#!/usr/bin/env node
/**
 * 课程一致性校验
 *
 * 把 2026-07 课程审查中发现的每一类问题固化成自动检查，防止随时间重新腐烂。
 * 详见 curriculum-review-report.md 与 curriculum-action-plan.md。
 *
 * 用法：
 *   node scripts/check-curriculum.mjs          # 全量检查
 *   node scripts/check-curriculum.mjs --strict # 把 warning 升级为 error
 *
 * 退出码：0 = 通过，1 = 存在 error
 */

import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('--strict')

const errors = []
const warnings = []
const passed = []

const err = (code, msg) => errors.push(`${code} ${msg}`)
const warn = (code, msg) => (STRICT ? errors : warnings).push(`${code} ${msg}`)
const ok = (code, msg) => passed.push(`${code} ${msg}`)

const read = (p) => readFileSync(join(ROOT, p), 'utf-8')

// ---------------------------------------------------------------- 数据抽取
// curriculum.ts 是 TS 源文件，这里用正则做轻量解析，避免为一个校验脚本引入
// 编译工具链。解析失败会直接报错而不是静默跳过。

const curriculumSrc = read('src/data/curriculum.ts')

function parseModules() {
  const mods = []
  const chunks = curriculumSrc.split(/\n {4}\{\n {6}id: (\d+),/)
  for (let i = 1; i < chunks.length; i += 2) {
    const id = Number(chunks[i])
    const body = chunks[i + 1]
    const title = body.match(/title: '([^']+)'/)?.[1] ?? '(无标题)'
    const hours = Number(body.match(/\n {6}hours: (\d+),/)?.[1] ?? NaN)
    const durations = [...body.matchAll(/duration: (\d+)/g)].map((m) => Number(m[1]))
    const lessonIds = [...body.matchAll(/id: '(L\d{2}-\d{2})'/g)].map((m) => m[1])
    const projectBlock = body.match(/project: \{[\s\S]*?\n {6}\}/)?.[0] ?? ''
    const projectId = projectBlock.match(/id: '(P\d+)'/)?.[1] ?? null
    const projectHours = Number(projectBlock.match(/hours: (\d+),/)?.[1] ?? NaN)
    mods.push({ id, title, hours, durations, lessonIds, projectId, projectHours })
  }
  return mods
}

const modules = parseModules()
if (modules.length === 0) {
  console.error('无法从 curriculum.ts 解析出模块 —— 解析逻辑可能已与数据结构脱节。')
  process.exit(1)
}

const componentMapSrc = read('src/components/MarkdownRenderer.tsx')
// 只解析 componentMap 对象字面量内部，否则会把函数参数（如 `text: string,`）
// 当成组件注册项 —— 这个 bug 真出现过。
const componentMapBlock = componentMapSrc.match(/const componentMap[^{]*\{([\s\S]*?)\n\}/)?.[1]
if (componentMapBlock == null) {
  console.error('无法定位 MarkdownRenderer.tsx 中的 componentMap —— 解析逻辑可能已脱节。')
  process.exit(1)
}
const componentMap = Object.fromEntries(
  [...componentMapBlock.matchAll(/^\s{2}(\w+): (\w+),$/gm)].map((m) => [m[1], m[2]]),
)

// stages 是阶段划分的唯一真源，阶段数从这里解析而不是写死。
const stagesBlock = curriculumSrc.match(/export const stages = \[([\s\S]*?)\n\] as const/)?.[1]
if (stagesBlock == null) {
  console.error('无法定位 curriculum.ts 中的 stages —— 解析逻辑可能已脱节。')
  process.exit(1)
}
const stageRanges = [...stagesBlock.matchAll(/range: \[(\d+), (\d+)\]/g)].map((m) => [
  Number(m[1]),
  Number(m[2]),
])
const stageCount = stageRanges.length

const contentDir = join(ROOT, 'src/content')
const contentFiles = []
for (const d of readdirSync(contentDir)) {
  const dp = join(contentDir, d)
  if (!statSync(dp).isDirectory()) continue
  for (const f of readdirSync(dp)) {
    if (f.endsWith('.md')) {
      contentFiles.push({
        rel: `src/content/${d}/${f}`,
        module: Number(d.replace('module-', '')),
        isLesson: f.startsWith('lesson-'),
        id: f.replace(/^(lesson|project)-/, '').replace(/\.md$/, '').toUpperCase(),
        text: readFileSync(join(dp, f), 'utf-8'),
      })
    }
  }
}
const lessonFiles = contentFiles.filter((f) => f.isLesson)

// ---------------------------------------------------------- C1 时长一致性
{
  let bad = 0
  for (const m of modules) {
    const lessonMin = m.durations.reduce((a, b) => a + b, 0)
    if (!Number.isFinite(m.projectHours)) {
      err('C1', `M${m.id} ${m.title}：project 缺少 hours 字段`)
      bad++
      continue
    }
    const expect = Math.round(lessonMin / 60 + m.projectHours)
    if (expect !== m.hours) {
      err(
        'C1',
        `M${m.id} ${m.title}：hours=${m.hours}，但 Math.round(${lessonMin}/60 + ${m.projectHours})=${expect}`,
      )
      bad++
    }
  }
  if (!bad) ok('C1', `时长不变式全部成立（${modules.length} 个模块）`)
}

// ------------------------------------------------------ C2 组件引用有效性
{
  let bad = 0
  for (const f of contentFiles) {
    for (const m of f.text.matchAll(/::interactive\{type="(\w+)"/g)) {
      const type = m[1]
      if (!componentMap[type]) {
        err('C2', `${f.rel} 引用了未注册的组件 type="${type}"`)
        bad++
      } else if (
        !existsSync(join(ROOT, `src/components/interactive/${componentMap[type]}.tsx`)) &&
        !existsSync(join(ROOT, `src/components/diagrams/${componentMap[type]}.tsx`))
      ) {
        err('C2', `${f.rel} 的 type="${type}" 映射到不存在的组件文件 ${componentMap[type]}.tsx`)
        bad++
      }
    }
  }
  if (!bad) ok('C2', '内容中的交互组件引用全部有效')
}

// -------------------------------------------------------- C3 组件覆盖率（收紧）
{
  // 从"每模块 ≥1"收紧为：每模块交互覆盖率 ≥ 40% 的 lesson，或至少每 3 节课 1 个。
  // 这能防止 M17（16 节课只有 3 个交互）和 M13（9 节课只有 1 个交互）等极端情况。
  const MIN_COVERAGE = 0.4
  const MIN_RATIO = 1 / 3 // 每 3 节课至少 1 个

  const moduleStats = new Map()
  for (const f of contentFiles) {
    if (!moduleStats.has(f.module)) {
      moduleStats.set(f.module, { total: 0, interactive: 0 })
    }
    const s = moduleStats.get(f.module)
    s.total++
    if (/::interactive\{/.test(f.text)) s.interactive++
  }

  let bad = 0
  for (const m of modules) {
    const s = moduleStats.get(m.id)
    if (!s) continue
    const ratio = s.interactive / s.total
    const minRequired = Math.max(1, Math.ceil(s.total * MIN_RATIO))
    if (ratio < MIN_COVERAGE && s.interactive < minRequired) {
      warn('C3', `M${m.id} ${m.title}：${s.interactive}/${s.total} 节课有交互（${(ratio*100).toFixed(0)}%，目标 ≥${Math.ceil(MIN_COVERAGE*100)}% 或 ≥${minRequired} 个）`)
      bad++
    }
  }

  if (!bad) {
    const worstModule = [...moduleStats.entries()]
      .sort((a, b) => a[1].interactive / a[1].total - b[1].interactive / b[1].total)[0]
    ok('C3', `交互覆盖率全部达标（最不达标模块 M${worstModule[0]}：${(worstModule[1].interactive/worstModule[1].total*100).toFixed(0)}%）`)
  }
}

// -------------------------------------------------------- C26 组件借用审计
{
  // 组件设计为教学服务，不是为凑 C3。以下两种模式告警：
  // 1. 某模块全部组件来自其他模块（自身无专属交互）
  // 2. 同一组件在同一模块内被多次引用（疑似凑数）
  let bad = 0

  for (const m of modules) {
    const modFiles = contentFiles.filter((f) => f.module === m.id)
    const usedTypes = new Set()
    const typeCounts = new Map()
    let allBorrowed = true

    for (const f of modFiles) {
      for (const match of f.text.matchAll(/::interactive\{type="(\w+)"/g)) {
        const type = match[1]
        usedTypes.add(type)
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
      }
    }

    if (usedTypes.size === 0) continue

    // 检查 1：全部借用（所有组件都已在其他模块出现）
    for (const type of usedTypes) {
      const appearsInOther = contentFiles.some(
        (f) => f.module !== m.id && f.text.includes(`::interactive{type="${type}"}`),
      )
      if (appearsInOther) continue
      allBorrowed = false
    }
    if (allBorrowed && usedTypes.size > 0) {
      warn('C26', `M${m.id} 所有交互组件（${[...usedTypes].join('、')}）均借用自其他模块——建议至少设计 1 个专属组件`)
      bad++
    }

    // 检查 2：同组件在模块内重复引用
    for (const [type, count] of typeCounts) {
      if (count > 1) {
        warn('C26', `M${m.id} 组件 "${type}" 被引用 ${count} 次（疑似凑数——同一组件不建议在同一模块内重复出现）`)
        bad++
      }
    }
  }

  if (!bad) ok('C26', '组件借用审计通过（无全部借用 / 无重复凑数）')
}

// ------------------------------------------------------ C4 反向孤儿检查
{
  const used = new Set()
  for (const f of contentFiles) {
    for (const m of f.text.matchAll(/::interactive\{type="(\w+)"/g)) used.add(m[1])
  }
  const orphans = Object.keys(componentMap).filter((t) => !used.has(t))
  if (orphans.length) {
    warn('C4', `以下组件已注册但内容中零引用：${orphans.join('、')}（写好了没接进内容）`)
  } else {
    ok('C4', '无孤儿组件')
  }
}

// ---------------------------------------------------- C5 模型标识白名单
{
  // 白名单来自 src/data/models.ts —— 那里是模型标识的唯一真源。
  // 想在正文里用一个新型号？先去 models.ts 登记，顺手更新 CALIBRATED_ON。
  const modelsSrc = read('src/data/models.ts')
  const tiersBlock = modelsSrc.match(/export const MODEL_TIERS[^=]*= \[([\s\S]*?)\n\]/)?.[1]
  if (tiersBlock == null) {
    console.error('无法定位 models.ts 中的 MODEL_TIERS —— 解析逻辑可能已脱节。')
    process.exit(1)
  }
  const ALLOWED = new Set([...tiersBlock.matchAll(/id: '([^']+)'/g)].map((m) => m[1]))
  if (ALLOWED.size === 0) {
    console.error('models.ts 中未解析到任何模型标识 —— 解析逻辑可能已脱节。')
    process.exit(1)
  }
  const found = new Map()
  const re = /\b(gpt-[0-9o][\w.-]*|o[34][\w.-]*|claude-(?:opus|sonnet|haiku)-[\w.-]*|gemini-[\w.-]*|text-embedding-[\w.-]*|whisper-[\w.-]*|tts-[\w.-]*)\b/g
  for (const f of contentFiles) {
    for (const m of f.text.matchAll(re)) {
      const id = m[1].replace(/[.,;:)）]+$/, '')
      if (!ALLOWED.has(id)) {
        if (!found.has(id)) found.set(id, [])
        found.get(id).push(f.rel)
      }
    }
  }
  if (found.size) {
    for (const [id, files] of found) {
      err('C5', `未知模型标识 "${id}"（${files.length} 处，如 ${files[0]}）`)
    }
  } else {
    ok('C5', `模型标识全部在白名单内（${ALLOWED.size} 个）`)
  }
}

// ------------------------------------------------------ C6 结构完整性
{
  const missing = lessonFiles.filter((f) => !f.text.includes('要点总结'))
  if (missing.length) {
    err('C6', `以下课程缺少"要点总结"：${missing.map((f) => f.rel).join('、')}`)
  } else {
    ok('C6', `全部 ${lessonFiles.length} 节课含"要点总结"`)
  }
}

// -------------------------------------------------------- C7 练习覆盖
{
  const missing = lessonFiles.filter((f) => !f.text.includes('动手 5 分钟'))
  if (missing.length) {
    warn('C7', `${missing.length}/${lessonFiles.length} 节课缺少"动手 5 分钟"练习（见行动计划 W5）`)
  } else {
    ok('C7', '全部课程含练习小节')
  }
}

// -------------------------------------------------------- C8 篇幅下限
{
  const MIN = 150
  const thin = lessonFiles
    .map((f) => ({ rel: f.rel, lines: f.text.split('\n').length }))
    .filter((f) => f.lines < MIN)
    .sort((a, b) => a.lines - b.lines)
  if (thin.length) {
    warn(
      'C8',
      `${thin.length} 节课不足 ${MIN} 行：${thin.map((t) => `${t.rel}(${t.lines})`).join('、')}（见行动计划 W6）`,
    )
  } else {
    ok('C8', `全部课程 ≥ ${MIN} 行`)
  }
}

// -------------------------------------------------- C9 数据与文件对应
{
  let bad = 0
  const fileIds = new Set(lessonFiles.map((f) => f.id))
  for (const m of modules) {
    for (const lid of m.lessonIds) {
      if (!fileIds.has(lid)) {
        err('C9', `curriculum.ts 中的 ${lid} 没有对应的 .md 文件`)
        bad++
      }
    }
    if (m.projectId) {
      const p = `src/content/module-${String(m.id).padStart(2, '0')}/project-${m.projectId.toLowerCase()}.md`
      if (!existsSync(join(ROOT, p))) {
        err('C9', `${m.projectId} 没有对应的 ${p}`)
        bad++
      }
    }
  }
  const dataIds = new Set(modules.flatMap((m) => m.lessonIds))
  for (const f of lessonFiles) {
    if (!dataIds.has(f.id)) {
      err('C9', `${f.rel} 是孤儿文件，curriculum.ts 中无对应 lesson`)
      bad++
    }
  }
  if (!bad) ok('C9', `课程数据与内容文件一一对应（${lessonFiles.length} 节）`)
}

// ------------------------------------------------------ C10 文档同步
{
  const claudeMd = read('CLAUDE.md')
  const documented = new Set(
    [...claudeMd.matchAll(/^\| (\w+) \| (\w+) \|/gm)].map((m) => m[1]).filter((t) => t !== 'type'),
  )
  const registered = new Set(Object.keys(componentMap))
  const ghost = [...documented].filter((t) => !registered.has(t))
  const undoc = [...registered].filter((t) => !documented.has(t))
  if (ghost.length) err('C10', `CLAUDE.md 登记了未实现的组件：${ghost.join('、')}`)
  if (undoc.length) err('C10', `以下已实现组件未登记进 CLAUDE.md：${undoc.join('、')}`)
  if (!ghost.length && !undoc.length) ok('C10', 'CLAUDE.md 组件表与 componentMap 一致')
}

// ------------------------------------------ C12 联合类型与 Record 映射同步
{
  // 曾经从 LessonType 里删掉 '项目'，却漏改 Badges.tsx 的 Record<LessonType, string>，
  // 结果本地校验全绿、CI 上 tsc 才报错。这里把 tsc 的这条规则前移到 check。
  const typesSrc = read('src/data/types.ts')
  const unions = {}
  for (const m of typesSrc.matchAll(/export type (\w+) = ((?:'[^']*'\s*\|?\s*)+)/g)) {
    unions[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
  }

  const srcFiles = []
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${e}`
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
      else if (/\.tsx?$/.test(e)) srcFiles.push(rel)
    }
  }
  walk('src')

  let bad = 0
  let checked = 0
  for (const rel of srcFiles) {
    const text = read(rel)
    for (const m of text.matchAll(/Record<(\w+), [^>]+> = \{([\s\S]*?)\n\}/g)) {
      const union = unions[m[1]]
      if (!union) continue
      checked++
      const keys = [...m[2].matchAll(/^\s{2}'?([^\s':]+)'?:/gm)].map((x) => x[1])
      const missing = union.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !union.includes(k))
      if (missing.length) {
        err('C12', `${rel} 的 Record<${m[1]}, …> 缺少键：${missing.join('、')}`)
        bad++
      }
      if (extra.length) {
        err('C12', `${rel} 的 Record<${m[1]}, …> 含 ${m[1]} 中不存在的键：${extra.join('、')}`)
        bad++
      }
    }
  }
  if (!bad) {
    ok('C12', `联合类型与 Record 映射同步（${checked} 处映射 / ${Object.keys(unions).length} 个联合类型）`)
  }
}

// -------------------------------------------------- C11 文档数字与数据一致
{
  // 曾经 README 和 CLAUDE.md 都写着 91 节课，而数据里只有 87 节 ——
  // 这类漂移靠人眼是发现不了的。
  //
  // 只校验"规模声明句"：同一行里同时出现模块数、课节数、项目数。
  // 不要退化成全文扫数字，否则 "模块 1（4 节课 + P1）" 这种局部计数会误报。
  const nLessons = modules.reduce((s, m) => s + m.lessonIds.length, 0)
  const nModules = modules.length
  const nProjects = modules.filter((m) => m.projectId).length
  const totalHours = modules.reduce((s, m) => s + m.hours, 0)

  const SCALE_RE =
    /(\d+)\s*(?:大|个)?模块[^\n]*?(\d+)\s*节(?:精讲)?课[^\n]*?(\d+)\s*个?(?:递进式)?(?:实战)?项目/g
  let bad = 0
  let seen = 0
  for (const file of ['README.md', 'CLAUDE.md']) {
    for (const m of read(file).matchAll(SCALE_RE)) {
      seen++
      const got = [Number(m[1]), Number(m[2]), Number(m[3])]
      const want = [nModules, nLessons, nProjects]
      if (got.some((v, i) => v !== want[i])) {
        err('C11', `${file} 规模声明 "${m[0]}" 与数据不符，应为 ${want.join(' / ')}`)
        bad++
      }
    }
  }
  if (seen === 0) {
    err('C11', 'README.md / CLAUDE.md 中找不到任何规模声明句 —— 检查是否被改写导致本项失效')
    bad++
  }

  const h = Number(read('README.md').match(/(\d+)\s*小时/)?.[1] ?? NaN)
  if (h !== totalHours) {
    err('C11', `README.md 写着 "${h} 小时"，实际总时长为 ${totalHours}`)
    bad++
  }

  for (const file of ['README.md', 'CLAUDE.md']) {
    for (const m of read(file).matchAll(/(\d+)\s*大阶段/g)) {
      if (Number(m[1]) !== stageCount) {
        err('C11', `${file} 写着 "${m[1]} 大阶段"，实际为 ${stageCount}`)
        bad++
      }
    }
  }

  if (!bad) {
    ok(
      'C11',
      `文档规模数字与课程数据一致（${nModules} 模块 / ${nLessons} 节 / ${nProjects} 项目 / ${totalHours}h，共 ${seen} 处声明）`,
    )
  }
}

// -------------------------------------------- C13 阶段划分覆盖与全站表述一致
{
  // 曾经出现过：数据层收敛成 6 阶段，首页却还硬编码着一份 7 阶段副本，
  // 课程正文里也留着"七大阶段"。这里同时守护区间连续性与全站表述。
  let bad = 0

  const sorted = [...stageRanges].sort((a, b) => a[0] - b[0])
  if (sorted.length === 0) {
    err('C13', 'stages 为空')
    bad++
  } else {
    if (sorted[0][0] !== 1) {
      err('C13', `stages 未从模块 1 开始，首个区间为 [${sorted[0].join(', ')}]`)
      bad++
    }
    const last = sorted[sorted.length - 1][1]
    if (last !== modules.length) {
      err('C13', `stages 未覆盖到最后一个模块：末区间到 M${last}，实际有 ${modules.length} 个模块`)
      bad++
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i][0] !== sorted[i - 1][1] + 1) {
        err(
          'C13',
          `stages 区间不连续：[${sorted[i - 1].join(', ')}] 之后是 [${sorted[i].join(', ')}]`,
        )
        bad++
      }
    }
    for (const r of sorted) {
      if (r[1] - r[0] === 0) {
        warn('C13', `阶段 [${r.join(', ')}] 只含 1 个模块，建议并入相邻阶段`)
      }
    }
  }

  // 全站中文数字表述："七大阶段" / "分七个阶段" 之类
  const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
  const targets = [...lessonFiles.map((f) => f.rel), ...srcTsxFiles()]
  for (const rel of targets) {
    const text = read(rel)
    // 只匹配"课程整体阶段数"的表述，避免误伤"训练/微调/推理三个阶段"这类局部用法。
    const RE = /([一二三四五六七八九十\d]+)\s*大阶段|(?:课程(?:分|共)|全课程|整个课程)\s*([一二三四五六七八九十\d]+)\s*个阶段/g
    for (const m of text.matchAll(RE)) {
      m[1] = m[1] ?? m[2]
      const n = CN[m[1]] ?? Number(m[1])
      if (Number.isFinite(n) && n !== stageCount) {
        err('C13', `${rel} 写着 "${m[0]}"，实际阶段数为 ${stageCount}`)
        bad++
      }
    }
  }

  if (!bad) ok('C13', `阶段划分连续且全站表述一致（${stageCount} 个阶段，覆盖 M1–M${modules.length}）`)
}

function srcTsxFiles() {
  const out = []
  const walk = (dir) => {
    for (const f of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${f}`
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
      else if (/\.tsx?$/.test(f)) out.push(rel)
    }
  }
  walk('src')
  return out
}

// ------------------------------------------------ C14 模型白名单校准新鲜度
{
  // 模型标识是全站最容易过期的信息。这里不判断"型号是否还存在"（脚本没有网络），
  // 只逼着维护者定期回头核对一次，并把核对日期写下来。
  //
  // ⚠️ 注意：本检查只验证"日期是否在有效期内"，无法判断你是否真实核对了厂商文档。
  // 改 CALIBRATED_ON 而不核对模型 = 把过期模型留在内容里 = 学生在 404。
  const modelsSrc = read('src/data/models.ts')
  const on = modelsSrc.match(/export const CALIBRATED_ON = '(\d{4}-\d{2}-\d{2})'/)?.[1]
  const maxAge = Number(
    modelsSrc.match(/export const CALIBRATION_MAX_AGE_DAYS = (\d+)/)?.[1] ?? NaN,
  )
  if (!on || !Number.isFinite(maxAge)) {
    err('C14', 'models.ts 缺少 CALIBRATED_ON 或 CALIBRATION_MAX_AGE_DAYS')
  } else {
    const age = Math.floor((Date.now() - Date.parse(`${on}T00:00:00Z`)) / 86400000)
    if (age > maxAge / 2) {
      // 半衰期警告：提前提醒，让维护者有足够时间安排核对
      const tier = age > maxAge ? 'error' : 'warn'
      const msg = age > maxAge
        ? `模型白名单已 ${age} 天未校准（上次 ${on}，阈值 ${maxAge} 天）—— C5 将无法拦截已下线的模型，请立即对照官方文档复核 models.ts。改日期不等于校准，必须逐模型确认。`
        : `模型白名单距上次校准已 ${age} 天（阈值 ${maxAge} 天，即将过半）—— 请安排近期校准。`
      if (tier === 'error') err('C14', msg)
      else warn('C14', msg)
    } else {
      ok('C14', `模型白名单校准新鲜（${on}，${age} 天前）`)
    }
  }
}

// ----------------------------------------------------- C15 语言定位不夸大
{
  // 曾经 M1-03 的标题写着"Python & TypeScript 双语言"，而全站 TS 代码块只有 4 个。
  // 这条检查不要求补齐 TS，只要求文案别承诺做不到的事。
  let bad = 0
  const claim = /双语言|Python\s*[/&+]\s*TypeScript|TypeScript\s*[/&+]\s*Python/
  for (const rel of [
    'README.md',
    'CLAUDE.md',
    'src/data/curriculum.ts',
    ...lessonFiles.map((f) => f.rel),
  ]) {
    for (const line of read(rel).split('\n')) {
      // CLAUDE.md 里那条"不要承诺双语言"的约定本身会命中，放行带否定词的行。
      if (claim.test(line) && !/不要|禁止|别在|不得|曾经|假装/.test(line)) {
        err('C15', `${rel} 出现双语言承诺："${line.trim().slice(0, 60)}"`)
        bad++
      }
    }
  }

  // 顺带把实际比例算出来，供维护者判断这个定位是否还成立
  let py = 0
  let ts = 0
  for (const f of contentFiles) {
    py += (f.text.match(/^```python/gm) ?? []).length
    ts += (f.text.match(/^```(?:typescript|tsx?|jsx)/gm) ?? []).length
  }
  if (!bad) ok('C15', `语言定位与实际一致（Python 代码块 ${py} 个 / TypeScript 系 ${ts} 个）`)
}

// ------------------------------------------- C16–C20 静态图结构守护
{
  const WIDTH_BOUNDS = {
    sm: { min: 68, max: 100 },
    md: { min: 96, max: 160 },
    hub: { min: 140, max: 200 },
  }
  const diagramDir = join(ROOT, 'src/components/diagrams')
  const diagramFiles = readdirSync(diagramDir)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ name: f, text: readFileSync(join(diagramDir, f), 'utf-8') }))

  const NUM = String.raw`(?:-?\d+(?:\.\d+)?|[A-Za-z_][\w]*)`
  const EXPR = String.raw`(?:-?\d+(?:\.\d+)?|[A-Za-z_][\w]*(?:\[[\d]+\])?)`

  let edgeBad = 0
  let isoBad = 0
  let widthBad = 0
  let overlapBad = 0
  let unsetPorts = 0
  let edgeTotal = 0

  for (const file of diagramFiles) {
    const { name, text } = file

    /** @type {Record<string, number>} */
    const consts = {}
    for (const m of text.matchAll(/const\s+([A-Za-z_][\w]*)\s*=\s*(-?\d+(?:\.\d+)?)/g)) {
      consts[m[1]] = Number(m[2])
    }
    /** @type {Record<string, number[]>} */
    const arrays = {}
    for (const m of text.matchAll(
      /const\s+([A-Za-z_][\w]*)\s*=\s*\[([^\]]+)\]/g,
    )) {
      arrays[m[1]] = m[2].split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
    }

    function resolve(expr) {
      if (expr == null) return null
      const t = expr.trim()
      if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
      const idx = t.match(/^([A-Za-z_][\w]*)\[(\d+)\]$/)
      if (idx && arrays[idx[1]] && arrays[idx[1]][Number(idx[2])] != null) {
        return arrays[idx[1]][Number(idx[2])]
      }
      if (Object.prototype.hasOwnProperty.call(consts, t)) return consts[t]
      return null
    }

    /** @type {Map<string, any>} */
    const nodes = new Map()

    for (const m of text.matchAll(
      new RegExp(
        String.raw`\bg\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*(${EXPR})\s*,\s*(${EXPR})\s*,\s*(${EXPR})\s*,\s*(${EXPR})`,
        'g',
      ),
    )) {
      const x = resolve(m[2])
      const y = resolve(m[3])
      const w = resolve(m[4])
      const h = resolve(m[5])
      if (x == null || y == null || w == null || h == null) continue
      nodes.set(m[1], { x, y, w, h, type: 'group', size: 'md', emphasis: 'default' })
    }

    for (const m of text.matchAll(
      new RegExp(
        String.raw`\bann\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*(${EXPR})\s*,\s*(${EXPR})\s*\)`,
        'g',
      ),
    )) {
      const x = resolve(m[2])
      const y = resolve(m[3])
      if (x == null || y == null) continue
      nodes.set(m[1], {
        x,
        y,
        w: 160,
        h: 24,
        type: 'annotation',
        size: 'md',
        emphasis: 'default',
      })
    }

    for (const m of text.matchAll(
      new RegExp(
        String.raw`\bn\(\s*'([^']+)'\s*,\s*(?:'[^']*'|"[^"]*")\s*,\s*(${EXPR})\s*,\s*(${EXPR})(?:\s*,\s*\{([^}]*)\})?`,
        'g',
      ),
    )) {
      const id = m[1]
      const x = resolve(m[2])
      const y = resolve(m[3])
      if (x == null || y == null) continue
      const opts = m[4] ?? ''
      const widthTok = opts.match(/width:\s*([^\s,}]+)/)?.[1]
      const heightTok = opts.match(/height:\s*([^\s,}]+)/)?.[1]
      const size = opts.match(/size:\s*'(\w+)'/)?.[1] ?? 'md'
      const emphasis = opts.match(/emphasis:\s*'(\w+)'/)?.[1] ?? 'default'
      const parentId = opts.match(/parentId:\s*'([^']+)'/)?.[1]
      const explicitWidth = widthTok != null ? resolve(widthTok) : null
      const explicitHeight = heightTok != null ? resolve(heightTok) : null
      const w = explicitWidth ?? (size === 'sm' ? 84 : 110)
      const h = explicitHeight ?? 48
      nodes.set(id, {
        x,
        y,
        w,
        h,
        type: 'diagram',
        size,
        emphasis,
        parentId,
        explicitWidth,
      })
    }

    // Also collect node ids that failed numeric resolve but appear as n('id'...
    // so C16 can still validate edge endpoints against declared ids.
    const declaredIds = new Set(nodes.keys())
    for (const m of text.matchAll(/\b(?:n|g|ann)\(\s*'([^']+)'/g)) declaredIds.add(m[1])

    const edges = []
    for (const m of text.matchAll(
      /\be\(\s*'([^']+)'\s*,\s*'([^']+)'(?:\s*,\s*\{([^}]*)\})?/g,
    )) {
      const opts = m[3] ?? ''
      const hasPort = /fromSide:|toSide:|sourceHandle:|targetHandle:/.test(opts)
      edges.push({ source: m[1], target: m[2], hasPort })
    }
    edgeTotal += edges.length

    for (const edge of edges) {
      if (!declaredIds.has(edge.source) || !declaredIds.has(edge.target)) {
        err('C16', `${name} 边 ${edge.source}→${edge.target} 引用了不存在的节点`)
        edgeBad++
      }
      if (!edge.hasPort) unsetPorts++
    }

    const degree = new Map()
    for (const id of declaredIds) degree.set(id, { in: 0, out: 0 })
    for (const edge of edges) {
      if (degree.has(edge.source)) degree.get(edge.source).out++
      if (degree.has(edge.target)) degree.get(edge.target).in++
    }
    for (const id of declaredIds) {
      const node = nodes.get(id)
      // Skip groups/annotations; also skip ids we couldn't fully parse as diagram nodes
      // but are only groups — if not in nodes map, check type via source scan
      if (node?.type === 'group' || node?.type === 'annotation') continue
      // If id is only a group/ann that failed resolve, detect from source:
      if (!node) {
        const isGroup = new RegExp(String.raw`\bg\(\s*'${id}'`).test(text)
        const isAnn = new RegExp(String.raw`\bann\(\s*'${id}'`).test(text)
        if (isGroup || isAnn) continue
      }
      const d = degree.get(id)
      if (d && d.in === 0 && d.out === 0) {
        err('C17', `${name} 存在孤立节点 "${id}"（入度=出度=0）`)
        isoBad++
      }
    }

    for (const [id, node] of nodes) {
      if (node.type !== 'diagram' || node.explicitWidth == null) continue
      const bounds =
        node.emphasis === 'hub'
          ? WIDTH_BOUNDS.hub
          : node.size === 'sm'
            ? WIDTH_BOUNDS.sm
            : WIDTH_BOUNDS.md
      if (node.explicitWidth < bounds.min || node.explicitWidth > bounds.max) {
        err(
          'C18',
          `${name} 节点 "${id}" width=${node.explicitWidth} 超出 ${node.size}/${node.emphasis} 区间 [${bounds.min},${bounds.max}]`,
        )
        widthBad++
      }
    }

    const abs = new Map()
    for (const [id, node] of nodes) {
      let x = node.x
      let y = node.y
      if (node.parentId && nodes.has(node.parentId)) {
        const p = nodes.get(node.parentId)
        x += p.x
        y += p.y
      }
      abs.set(id, { ...node, ax: x, ay: y })
    }

    const diagramNodes = [...abs.entries()].filter(([, n]) => n.type === 'diagram')
    for (let i = 0; i < diagramNodes.length; i++) {
      const [idA, a] = diagramNodes[i]
      for (let j = i + 1; j < diagramNodes.length; j++) {
        const [idB, b] = diagramNodes[j]
        const overlap =
          a.ax < b.ax + b.w &&
          a.ax + a.w > b.ax &&
          a.ay < b.ay + b.h &&
          a.ay + a.h > b.ay
        if (overlap) {
          err('C19', `${name} 节点包围盒重叠：${idA} ∩ ${idB}`)
          overlapBad++
        }
      }
      if (a.parentId && abs.has(a.parentId)) {
        const p = abs.get(a.parentId)
        const inside =
          a.ax >= p.ax - 1 &&
          a.ay >= p.ay - 1 &&
          a.ax + a.w <= p.ax + p.w + 1 &&
          a.ay + a.h <= p.ay + p.h + 1
        if (!inside) {
          err('C19', `${name} 节点 "${idA}" 超出所属泳道 "${a.parentId}"`)
          overlapBad++
        }
      }
    }
  }

  if (!edgeBad) ok('C16', `静态图边引用全部有效（${diagramFiles.length} 个文件 / ${edgeTotal} 条边）`)
  if (!isoBad) ok('C17', '静态图无孤立节点（annotation 已豁免）')
  if (!widthBad) ok('C18', '显式 width 均落在 size 类区间内')
  if (!overlapBad) ok('C19', '节点包围盒无重叠且未越出泳道')
  if (unsetPorts === 0) {
    ok('C20', '全部边已显式指定端口')
  } else {
    warn(
      'C20',
      `${unsetPorts}/${edgeTotal} 条边未显式指定端口（运行时由 layoutEdges 按坐标推断）`,
    )
  }
}

// ------------------------------------------------ C21 内容文件禁止 NUL 字节
{
  let bad = 0
  function walkMd(dir) {
    for (const f of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${f}`
      const full = join(ROOT, rel)
      if (statSync(full).isDirectory()) walkMd(rel)
      else if (f.endsWith('.md')) {
        const buf = readFileSync(full)
        if (buf.includes(0)) {
          err('C21', `${rel} 含 NUL 字节（${buf.filter((b) => b === 0).length} 处）—— 请截断损坏尾部`)
          bad++
        }
      }
    }
  }
  walkMd('src/content')
  if (!bad) ok('C21', '内容 Markdown 无 NUL / 二进制污染')
}

// ------------------------------------------------ C28 模型档位完整性
{
  const tiersSrc = read('src/data/models.ts')
  const tiersBlock = tiersSrc.match(/export const MODEL_TIERS[^=]*= \[([\s\S]*?)\n\]/)?.[1]
  if (tiersBlock == null) {
    console.error('无法定位 models.ts 中的 MODEL_TIERS —— 解析逻辑可能已脱节。')
    process.exit(1)
  }
  // 按 tier 名提取每个档位的 models 数组
  const tierRegex = /tier: '(\w+)'[\s\S]*?models: \[([\s\S]*?)\]/g
  let match
  let bad = false
  const tierModels = new Map()
  while ((match = tierRegex.exec(tiersBlock)) !== null) {
    const tierName = match[1]
    const modelsBlock = match[2]
    const ids = [...modelsBlock.matchAll(/id: '([^']+)'/g)].map((m) => m[1])
    tierModels.set(tierName, ids)
    if (ids.length === 0) {
      err('C28', `档位 "${tierName}" 的 models 为空 —— 必须至少登记一个模型标识`)
      bad = true
    }
  }
  // 检查是否有两档完全相同
  const entries = [...tierModels.entries()]
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [aName, aIds] = entries[i]
      const [bName, bIds] = entries[j]
      if (aIds.length > 0 && bIds.length > 0 && aIds.join(',') === bIds.join(',')) {
        err('C28', `档位 "${aName}" 与 "${bName}" 的 models 完全相同（${aIds.join(', ')}）—— 必须区分`)
        bad = true
      }
    }
  }
  if (!bad) ok('C28', `模型档位完整（${tierModels.size} 个档位，均非空且互不相同）`)
}

// ----------------------------------------------------- C22 Python 代码块语法检查
{
  // 从所有 .md 文件中抽取 ```python 代码块，先跑 py_compile 抓语法错误，
  // 再跑 ruff --select F 抓未定义名等逻辑问题。C22 标记为 warn 级别，
  // 因为部分代码块是示意性片段（如只展示关键逻辑），不是完整可执行文件。
  //
  // 区分"真错误"和"代码片段"的策略：
  //   1. py_compile 明确报 SyntaxError 的 → 真错误，报 warn
  //   2. ruff F821（未定义名）中，如果未定义名只有 `...`（Ellipsis 字面量占位符）
  //      → 跳过（属于 Task 2.11 的占位符清理范畴）
  //   3. 其余 ruff F 规则 → 报 warn

  const TMP_DIR = join(ROOT, '.check-tmp', 'py-blocks')
  mkdirSync(TMP_DIR, { recursive: true })

  // 收集所有 .md 文件
  const mdPaths = []
  function walkMd(dir) {
    const full = join(ROOT, dir)
    if (!existsSync(full)) return
    for (const e of readdirSync(full)) {
      const rel = `${dir}/${e}`
      const abs = join(ROOT, rel)
      if (e.endsWith('.md')) mdPaths.push({ rel, abs })
      else if (existsSync(abs) && !e.startsWith('.') && !e.startsWith('_')) {
        try { if (statSync(abs).isDirectory()) walkMd(rel) } catch (_) {}
      }
    }
  }
  walkMd('src/content')

  let syntaxBad = 0
  let ruffBad = 0
  let ruffAvailable = true
  let totalBlocks = 0
  const syntaxErrors = []
  const ruffIssues = []

  for (const { rel, abs } of mdPaths) {
    const text = readFileSync(abs, 'utf-8')
    const re = /```python\s*\n([\s\S]*?)```/g
    let match
    let blockIdx = 0
    while ((match = re.exec(text)) !== null) {
      totalBlocks++
      const code = match[1]
      const moduleName = rel.replace('src/content/', '').replace(/\//g, '_').replace(/\.md$/, '')
      const blockFile = `${moduleName}_block${blockIdx}.py`
      const absPath = join(TMP_DIR, blockFile)
      writeFileSync(absPath, code, 'utf-8')
      blockIdx++

      // py_compile 语法检查
      try {
        execSync(`python3 -m py_compile "${absPath}"`, { stdio: 'pipe', timeout: 5000 })
      } catch (e) {
        const stderr = e.stderr?.toString() || ''
        syntaxBad++
        syntaxErrors.push(`${rel} block#${blockIdx - 1}: ${stderr.trim().split('\n')[0]}`)
      }

      // ruff --select F 检查
      try {
        execSync(`ruff check --select F --no-cache "${absPath}"`, { stdio: 'pipe', timeout: 10000 })
      } catch (e) {
        if (e.message?.includes('command not found') || e.message?.includes('not found')) {
          ruffAvailable = false
        } else {
          const stdout = e.stdout?.toString() || ''
          const stderr = e.stderr?.toString() || ''
          const lines = (stdout + '\n' + stderr).split('\n').filter((l) => l.trim())
          // 过滤掉仅包含 `...` 占位符的 F821（属于 Task 2.11 清理范畴）
          const realIssues = lines.filter((l) => {
            if (l.includes('F821') && l.includes('`...`')) return false
            return true
          })
          if (realIssues.length > 0) {
            ruffBad += realIssues.length
            ruffIssues.push(`${rel} block#${blockIdx - 1}: ${realIssues[0]}`)
          }
        }
      }
    }
  }

  if (syntaxBad > 0) {
    warn('C22', `Python 语法错误（py_compile）：${syntaxBad} 个块（共 ${totalBlocks} 个块）`)
    for (const s of syntaxErrors.slice(0, 5)) warn('C22', `  ${s}`)
    if (syntaxErrors.length > 5) warn('C22', `  ... 还有 ${syntaxErrors.length - 5} 个`)
  }
  if (ruffAvailable) {
    if (ruffBad > 0) {
      warn('C22', `ruff --select F 问题：${ruffBad} 条（共 ${totalBlocks} 个块）`)
      for (const s of ruffIssues.slice(0, 5)) warn('C22', `  ${s}`)
      if (ruffIssues.length > 5) warn('C22', `  ... 还有 ${ruffIssues.length - 5} 个`)
    }
  }
  if (syntaxBad === 0 && ruffBad === 0) {
    ok('C22', `Python 代码块语法检查通过（${totalBlocks} 个块）`)
  }
}

// ----------------------------------------- C27 open(..., "w") 必须带 encoding=
{
  let bad = 0
  for (const f of contentFiles) {
    const lines = f.text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // 匹配 open(..., "w") 或 open(..., 'w') 但未带 encoding=
      if (/open\([^)]*["']w["']/.test(line) && !/encoding\s*=/.test(line)) {
        // 排除注释行
        if (/^\s*#/.test(line)) continue
        // 排除 open(..., "wb") 二进制模式
        if (/open\([^)]*["']w[b+]/.test(line)) continue
        // 排除 tarfile.open / io.open / codecs.open 等非文件写入
        if (/tarfile\.open|io\.open|codecs\.open/.test(line)) continue
        bad++
        warn('C27', `${f.rel}:${i + 1} open(..., "w") 缺少 encoding= —— 应显式指定 encoding="utf-8"`)
      }
    }
  }
  if (!bad) ok('C27', '所有 open(..., "w") 调用均带 encoding=')
}

// -------------------------------------- C24 正文规模数字校验（防 P0-28 回归）
{
  // 曾经 L19-06 写"前面 108 节"但实际是 117 节。C11 只校验文档声明，
  // 本项校验正文里的"前面 N 节""共 N 节课"等规模数字与实际课程数一致。
  let bad = 0
  let checked = 0
  // 计算每节课在全部 lesson 中的序号（从 1 开始）
  const lessonOrder = new Map()
  let order = 0
  for (const m of modules) {
    for (const lid of m.lessonIds) {
      order++
      lessonOrder.set(lid, order)
    }
  }
  const totalLessons = order

  for (const f of lessonFiles) {
    const orderInTotal = lessonOrder.get(f.id)
    if (orderInTotal == null) continue
    // 按模块内的序号
    const modLessons = modules.find((m) => m.lessonIds.includes(f.id))
    const modOrder = modLessons ? modLessons.lessonIds.indexOf(f.id) + 1 : null
    const modTotal = modLessons ? modLessons.lessonIds.length : null

    // 数字/中文数字转换
    const cnDigits = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10,
                       十一:11, 十二:12, 十三:13, 十四:14, 十五:15, 十六:16, 十七:17, 十八:18, 十九:19 }
    const numRE = String.raw`(\d+|[一二三四五六七八九十]+(?:[一二三四五六七八九])?)`

    // 匹配"前面 N 节" / "前面 N 节课"（阿拉伯数字或中文数字）
    const aheadRE = new RegExp(`(?:前面|之前)(?:已经学过的?\\s*)?${numRE}\\s*节(?:课)?`, 'g')
    for (const m of f.text.matchAll(aheadRE)) {
      const raw = m[1]
      const claimed = cnDigits[raw] ?? Number(raw)
      if (Number.isNaN(claimed)) continue
      // 如果 N < 本模块总课数，按模块内序校验（如"前面六节"指本节前 6 节，合理）
      // 如果 N >= 本模块总课数，按全课程序校验（如"前面 117 节"指全课程）
      if (modTotal && claimed < modTotal) {
        // 模块局部声明——跳过（每们课的顺序不会变，且模块内节数是自洽的）
        checked++
        continue
      }
      if (claimed !== orderInTotal - 1) {
        warn('C24', `${f.rel} 写"前面 ${raw} 节"，但本节是全课程第 ${orderInTotal} 节（实际前面 ${orderInTotal - 1} 节）`)
        bad++
      }
      checked++
    }

    // 匹配"本章共 N 节" 
    const modTotalRE = new RegExp(`本(?:章|模块)(?:共|包含?)\\s*${numRE}\\s*节`, 'g')
    for (const m of f.text.matchAll(modTotalRE)) {
      const raw = m[1]
      const claimed = cnDigits[raw] ?? Number(raw)
      if (Number.isNaN(claimed)) continue
      if (modTotal && claimed !== modTotal) {
        warn('C24', `${f.rel} 写"本章共 ${raw} 节"，实际本模块 ${modTotal} 节`)
        bad++
      }
      checked++
    }

    // 匹配"第 N 节"（当本节自称序号时）
    const selfOrderRE = new RegExp(`本(?:节|课)(?:是|为)?\\s*第\\s*${numRE}\\s*节`, 'g')
    for (const m of f.text.matchAll(selfOrderRE)) {
      const raw = m[1]
      const claimed = cnDigits[raw] ?? Number(raw)
      if (Number.isNaN(claimed)) continue
      if (modOrder && claimed !== modOrder) {
        warn('C24', `${f.rel} 自称"第 ${raw} 节"，实际为本模块第 ${modOrder} 节`)
        bad++
      }
      checked++
    }
  }

  if (!bad && checked > 0) {
    ok('C24', `正文规模数字与课程数据一致（${checked} 处声明）`)
  } else if (checked === 0) {
    ok('C24', '正文中无规模数字声明（跳过校验）')
  }
  // bad handled by warn above
}

// -------------------------------------- C25 代码块级双语言检测（C15 扩展）
{
  // C15 只匹配"双语言""Python & TypeScript"等文案措辞，
  // 匹配不到代码块级的双语言残留。本项扩展：
  // 非例外清单文件不得出现 ts/tsx/js/jsx 代码块。
  //
  // 例外清单：已知合法使用 TypeScript 系代码的文件
  const ALLOWED_FILES = [
    // M10 前端演示（L10-05 有 React 组件示例）
    'src/content/module-10/lesson-l10-05.md',
    // P10 前端演示（Step 5 有 React 组件示例）
    'src/content/module-10/project-p10.md',
    // M15 前端演示（L15-06 有状态面板组件示例）
    'src/content/module-15/lesson-l15-06.md',
    // M16 项目有前端演示
    'src/content/module-16/project-p16.md',
    // M17 开发实战（多节课有前端/工程化代码）
    'src/content/module-17/lesson-l17-05.md',
    'src/content/module-17/lesson-l17-06.md',
    'src/content/module-17/lesson-l17-11.md',
    'src/content/module-17/lesson-l17-12.md',
    'src/content/module-17/lesson-l17-15.md',
  ]

  let bad = 0
  for (const f of contentFiles) {
    if (ALLOWED_FILES.includes(f.rel)) continue
    const tsBlocks = [...f.text.matchAll(/```(?:typescript|tsx?|jsx?)\b/g)]
    if (tsBlocks.length > 0) {
      warn('C25', `${f.rel} 含 ${tsBlocks.length} 个 TypeScript/JS 代码块，不在例外清单中 —— 请确认或补进例外清单`)
      bad++
    }
  }

  if (!bad) ok('C25', '代码块级语言定位与实际一致（非例外文件无非 Python 代码块）')
}

// ------------------------------------------------------------------ 输出
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

console.log(`\n${DIM}课程一致性校验${STRICT ? '（strict）' : ''}${RESET}\n`)
for (const p of passed) console.log(`  ${GREEN}✓${RESET} ${p}`)
for (const w of warnings) console.log(`  ${YELLOW}!${RESET} ${w}`)
for (const e of errors) console.log(`  ${RED}✗${RESET} ${e}`)

console.log(`\n${passed.length} 通过 · ${warnings.length} 警告 · ${errors.length} 错误\n`)

if (errors.length) {
  console.log(`${RED}检查未通过。${RESET}\n`)
  process.exit(1)
}
