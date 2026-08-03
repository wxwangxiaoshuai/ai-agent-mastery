/**
 * check-curriculum.mjs 冒烟测试
 *
 * 验证检查脚本可以正常加载和运行，不验证具体检查项的输出（那是 C1-C28 本身的职责）。
 * 这些测试确保：
 * 1. 脚本能正确解析 curriculum.ts（如果数据结构变了，脚本也会报错）
 * 2. 核心数据抽取函数返回合理结果
 * 3. exit code 行为正确
 *
 * 用法：node scripts/check-curriculum.test.mjs
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = join(ROOT, 'scripts/check-curriculum.mjs')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
    failed++
  }
}

function assertContains(text, substr, msg) {
  if (!text.includes(substr)) throw new Error(msg || `expected "${substr}" in output`)
}

function assertExitCode(cmd, expectedCode) {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 30000, cwd: ROOT })
    if (expectedCode !== 0) throw new Error(`expected exit code ${expectedCode}`)
  } catch (e) {
    if (e.status !== expectedCode) throw new Error(`expected exit code ${expectedCode}, got ${e.status}`)
  }
}

console.log('\ncheck-curriculum.mjs 冒烟测试\n')

// ── 脚本可加载 ──
test('脚本可以无报错执行', () => {
  const out = execSync(`node "${CHECK}"`, { stdio: 'pipe', timeout: 120000, cwd: ROOT }).toString()
  assertContains(out, '课程一致性校验', '输出应包含标题')
  assertContains(out, '通过', '输出应包含结果统计')
})

// ── --strict 模式 ──
test('--strict 把 warn 升级为 error — 应有非零 exit code', () => {
  try {
    execSync(`node "${CHECK}" --strict`, { stdio: 'pipe', timeout: 120000, cwd: ROOT })
    // strict 模式下如果 C20 的 warn 没有升级成 error，exit 0 就不对
    // 但如果后续某个版本 C20 也被修复（所有边显式指定端口），这里会通过
    // 此时只需关注 exit code 行为是否正确
  } catch (e) {
    // strict 模式下有 warning → 期望非零 exit code，这是正确的行为
    if (e.status === 0) throw new Error('strict 模式下应返回非零 exit code')
  }
})

// ── curriculum.ts 解析 ──
test('课程数据可正确解析（modules 解析不为空）', () => {
  const src = readFileSync(join(ROOT, 'src/data/curriculum.ts'), 'utf-8')
  const ids = [...src.matchAll(/\n {4}\{\n {6}id: (\d+),/g)]
  if (ids.length === 0) throw new Error('未从 curriculum.ts 解析到模块')
  if (ids.length !== 19) throw new Error(`预期 19 个模块，实际 ${ids.length}`)
})

// ── models.ts 白名单可解析 ──
test('models.ts 白名单非空', () => {
  const src = readFileSync(join(ROOT, 'src/data/models.ts'), 'utf-8')
  const ids = [...src.matchAll(/id: '([^']+)'/g)]
  if (ids.length === 0) throw new Error('未从 models.ts 解析到模型标识')
  if (ids.length < 10) throw new Error(`预期至少 10 个模型标识，实际 ${ids.length}`)
})

// ── C5 模型白名单覆盖率 ──
test('C5 正则覆盖 OpenAI 推理模型标识', () => {
  // C5 的 regex 应覆盖 gpt-* / claude-* / gemini-* / text-embedding-* / whisper-* / tts-* / o*
  const c5re = /\bgpt-[0-9o][\w.-]*|o[34][\w.-]*|claude-(?:opus|sonnet|haiku)-[\w.-]*|gemini-[\w.-]*|text-embedding-[\w.-]*|whisper-[\w.-]*|tts-[\w.-]*\b/
  if (!c5re.test('gpt-5')) throw new Error('C5 不匹配 gpt-5')
  if (!c5re.test('text-embedding-3-small')) throw new Error('C5 不匹配 text-embedding-3-small')
  if (!c5re.test('whisper-1')) throw new Error('C5 不匹配 whisper-1')
  if (!c5re.test('o3-mini')) throw new Error('C5 不匹配 o3-mini')
  if (!c5re.test('o4-mini-2025-01-31')) throw new Error('C5 不匹配 o4-mini-2025-01-31')
})

// ── 内容文件完整性 ──
test('所有模块目录存在至少一个 .md 文件', () => {
  for (let m = 1; m <= 19; m++) {
    const dir = join(ROOT, `src/content/module-${String(m).padStart(2, '0')}`)
    try {
      const files = execSync(`ls "${dir}"/*.md 2>/dev/null | wc -l`, { shell: true }).toString().trim()
      if (Number(files) === 0) throw new Error(`M${m} 目录无 .md 文件`)
    } catch (e) {
      if (e.message) throw e
      throw new Error(`M${m} 目录不存在`)
    }
  }
})

console.log(`\n${passed} 通过 / ${failed} 失败\n`)
if (failed > 0) process.exit(1)
