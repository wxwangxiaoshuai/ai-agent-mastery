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
  // W3 落地模型别名层后，此白名单应改为从 src/data/models.ts 读取。
  const ALLOWED = new Set([
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4o-2024-08-06',
    'gpt-4o-2024-11-20',
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-haiku-4-5',
    'claude-sonnet-4-20250514',
    'gemini-2.0-flash',
  ])
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

  const stageCount = 6
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
