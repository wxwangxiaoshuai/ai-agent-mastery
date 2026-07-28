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

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
      } else if (!existsSync(join(ROOT, `src/components/interactive/${componentMap[type]}.tsx`))) {
        err('C2', `${f.rel} 的 type="${type}" 映射到不存在的组件文件 ${componentMap[type]}.tsx`)
        bad++
      }
    }
  }
  if (!bad) ok('C2', '内容中的交互组件引用全部有效')
}

// -------------------------------------------------------- C3 组件覆盖率
{
  const covered = new Set(
    contentFiles.filter((f) => /::interactive\{/.test(f.text)).map((f) => f.module),
  )
  const missing = modules.map((m) => m.id).filter((id) => !covered.has(id))
  if (missing.length) {
    warn('C3', `以下模块没有任何交互组件：M${missing.join('、M')}（见行动计划 W2）`)
  } else {
    ok('C3', '每个模块至少含 1 个交互组件')
  }
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
  const re = /\b(gpt-[0-9o][\w.-]*|claude-(?:opus|sonnet|haiku)-[\w.-]*|gemini-[\w.-]*)\b/g
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
  const modelsSrc = read('src/data/models.ts')
  const on = modelsSrc.match(/export const CALIBRATED_ON = '(\d{4}-\d{2}-\d{2})'/)?.[1]
  const maxAge = Number(
    modelsSrc.match(/export const CALIBRATION_MAX_AGE_DAYS = (\d+)/)?.[1] ?? NaN,
  )
  if (!on || !Number.isFinite(maxAge)) {
    err('C14', 'models.ts 缺少 CALIBRATED_ON 或 CALIBRATION_MAX_AGE_DAYS')
  } else {
    const age = Math.floor((Date.now() - Date.parse(`${on}T00:00:00Z`)) / 86400000)
    if (age > maxAge) {
      warn(
        'C14',
        `模型白名单已 ${age} 天未校准（上次 ${on}，阈值 ${maxAge} 天）—— 请对照厂商文档复核 models.ts`,
      )
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
