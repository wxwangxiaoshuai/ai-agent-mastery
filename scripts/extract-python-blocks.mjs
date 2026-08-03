#!/usr/bin/env node
/**
 * 从所有课程 .md 文件中抽取 Python 代码块，写入临时目录供静态分析。
 *
 * 用法：
 *   node scripts/extract-python-blocks.mjs              # 默认输出到 .check-tmp/py-blocks/
 *   node scripts/extract-python-blocks.mjs --out DIR    # 指定输出目录
 *   node scripts/extract-python-blocks.mjs --json       # 输出 JSON 到 stdout
 *
 * 退出码：0
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

const JSON_MODE = args.includes('--json')
const outArg = args.indexOf('--out')
const OUT_DIR = outArg >= 0 ? args[outArg + 1] : join(ROOT, '.check-tmp', 'py-blocks')

// 收集所有 .md 文件
function walkMd(dir) {
  const files = []
  const full = join(ROOT, dir)
  if (!existsSync(full)) return files
  for (const e of readdirSync(full)) {
    const rel = `${dir}/${e}`
    const abs = join(ROOT, rel)
    if (e.endsWith('.md')) files.push({ rel, abs })
    else if (existsSync(abs) && !e.startsWith('.') && !e.startsWith('_')) {
      // 可能是子目录
      try {
        const st = readdirSync(abs)
        if (st.length > 0) files.push(...walkMd(rel))
      } catch (_) {}
    }
  }
  return files
}

// 从 Markdown 中抽取 Python 代码块
function extractPythonBlocks(text) {
  const blocks = []
  const re = /```python\s*\n([\s\S]*?)```/g
  let match
  let idx = 0
  while ((match = re.exec(text)) !== null) {
    blocks.push({ index: idx++, code: match[1] })
  }
  return blocks
}

// 尝试 py_compile 检查
function checkSyntax(absPath) {
  try {
    execSync(`python3 -m py_compile "${absPath}"`, { stdio: 'pipe', timeout: 5000 })
    return { ok: true }
  } catch (e) {
    const stderr = e.stderr?.toString() || ''
    return { ok: false, error: stderr.trim() }
  }
}

// 尝试 ruff 检查（如果可用）
function checkRuff(absPath) {
  try {
    execSync(`ruff check --select F --no-cache "${absPath}"`, { stdio: 'pipe', timeout: 10000 })
    return { ok: true, issues: [] }
  } catch (e) {
    // ruff 不可用
    if (e.message?.includes('command not found') || e.message?.includes('not found')) {
      return { ok: true, issues: [], unavailable: true }
    }
    // ruff 报错 = 有 lint 问题
    const stderr = e.stderr?.toString() || ''
    const stdout = e.stdout?.toString() || ''
    const lines = (stdout + stderr).split('\n').filter(l => l.trim())
    return { ok: false, issues: lines }
  }
}

// 主流程
const mdFiles = walkMd('src/content')
const allResults = []
let totalBlocks = 0
let syntaxErrors = 0
let lintIssues = 0
let ruffAvailable = true

if (!JSON_MODE) {
  mkdirSync(OUT_DIR, { recursive: true })
}

for (const { rel, abs } of mdFiles) {
  const text = readFileSync(abs, 'utf-8')
  const blocks = extractPythonBlocks(text)
  if (blocks.length === 0) continue

  const moduleName = rel.replace('src/content/', '').replace(/\//g, '_').replace(/\.md$/, '')
  totalBlocks += blocks.length

  for (const block of blocks) {
    const blockFile = `${moduleName}_block${block.index}.py`
    const absPath = join(OUT_DIR, blockFile)

    if (!JSON_MODE) {
      // 写文件
      const dir = dirname(absPath)
      mkdirSync(dir, { recursive: true })
      writeFileSync(absPath, block.code, 'utf-8')
    }

    // 语法检查
    const syntaxResult = checkSyntax(absPath)
    if (!syntaxResult.ok) {
      syntaxErrors++
    }

    // ruff 检查
    const ruffResult = checkRuff(absPath)
    if (ruffResult.unavailable) ruffAvailable = false
    if (!ruffResult.ok) {
      lintIssues += ruffResult.issues.length
    }

    allResults.push({
      source: rel,
      blockIndex: block.index,
      blockFile,
      code: JSON_MODE ? block.code : undefined,
      syntax: syntaxResult.ok ? 'ok' : syntaxResult.error,
      ruff: ruffResult.unavailable ? 'unavailable' : (ruffResult.ok ? 'ok' : ruffResult.issues),
    })
  }
}

if (JSON_MODE) {
  console.log(JSON.stringify({
    totalBlocks,
    syntaxErrors,
    lintIssues,
    ruffAvailable,
    results: allResults,
  }, null, 2))
} else {
  console.log(`\n抽取完成：${totalBlocks} 个 Python 代码块 → ${OUT_DIR}`)
  if (syntaxErrors > 0) {
    console.log(`\n语法错误（py_compile）：${syntaxErrors} 个块`)
    for (const r of allResults) {
      if (r.syntax !== 'ok') {
        console.log(`  ✗ ${r.source} block#${r.blockIndex}`)
        console.log(`    ${r.syntax.split('\n')[0]}`)
      }
    }
  }
  if (ruffAvailable) {
    if (lintIssues > 0) {
      console.log(`\nruff 问题：${lintIssues} 条`)
    }
  } else {
    console.log('\nruff 未安装，跳过 lint 检查。安装后运行：pip install ruff')
  }
}