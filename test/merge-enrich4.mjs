#!/usr/bin/env node
/**
 * merge-enrich4.mjs — 合并「保姆级推导」扩展（enrich4/），只替换 point.math.derivationSteps。
 *
 * 用法：
 *   node plugin/textbook-parser/test/merge-enrich4.mjs           # 合并并写盘
 *   node plugin/textbook-parser/test/merge-enrich4.mjs --check   # 只校验
 *
 * enrich4 文件：
 *   { "bookId":"...", "chapterId":"ch02",
 *     "sections": {},                        // 可选，本版一般留空
 *     "points": { "2.7.1": { "math": { theorems[...], derivationSteps[{step,line,why,detail}], image } } } }
 *
 * 特点：允许「部分覆盖」——只写某章中的若干知识点，未写的点保持原样。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, '..')
const workspace = path.resolve(pkgRoot, '..', '..')
const enrichRoot = path.join(workspace, 'enrich4')
const checkOnly = process.argv.includes('--check')
const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

const BOOKS = [
  { bookId: 'signals-systems-zheng', label: '信号与系统（内置）', bookDir: path.join(pkgRoot, 'data', 'books', 'signals-systems-zheng'), prefix: '' },
  { bookId: 'advanced-mathematics-tongji', label: '高等数学（用户书）', bookDir: path.join(home, 'textbook-parser', 'books', 'advanced-mathematics-tongji'), prefix: 'gaoshu-' },
]

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const errors = []
const err = (m) => errors.push(m)

async function readJson(file) {
  const text = await readFile(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) err(`${path.basename(file)} 含 BOM`)
  return JSON.parse(text)
}

function checkMath(math, where) {
  if (!isObj(math)) { err(`${where}.math 必须是对象`); return false }
  let ok = true
  if (!Array.isArray(math.theorems)) { err(`${where}.math.theorems 必须是数组`); ok = false }
  else math.theorems.forEach((t, i) => {
    if (!isObj(t)) { err(`${where}.theorems[${i}] 必须是对象`); ok = false; return }
    if (!nonEmpty(t.name)) { err(`${where}.theorems[${i}].name 不能为空`); ok = false }
    if (!nonEmpty(t.statement)) { err(`${where}.theorems[${i}].statement 不能为空`); ok = false }
  })
  const steps = math.derivationSteps
  if (!Array.isArray(steps)) { err(`${where}.math.derivationSteps 必须是数组`); ok = false }
  else {
    if (steps.length === 0) { err(`${where}.math.derivationSteps 不能为空（本文件目的就是补推导）`); ok = false }
    steps.forEach((st, i) => {
      if (!isObj(st)) { err(`${where}.derivationSteps[${i}] 必须是对象`); ok = false; return }
      if (!nonEmpty(st.step)) { err(`${where}.derivationSteps[${i}].step 不能为空`); ok = false }
      const hasLine = nonEmpty(st.line)
      const hasDetail = nonEmpty(st.detail)
      if (!hasLine && !hasDetail) { err(`${where}.derivationSteps[${i}] 需要 line 或 detail`); ok = false }
      if (hasLine && String(st.line).trim().length < 3) { err(`${where}.derivationSteps[${i}].line 过短`); ok = false }
    })
  }
  return ok
}

async function mergeBook(book) {
  const chaptersDir = path.join(book.bookDir, 'chapters')
  let files
  try { files = (await readdir(chaptersDir)).filter((f) => /^ch\d+\.json$/.test(f)).sort() } catch { return null }
  const pending = []
  let updatedPoints = 0
  let updatedSteps = 0
  let updatedChapters = 0

  for (const file of files) {
    const chapterFile = path.join(chaptersDir, file)
    const chapter = await readJson(chapterFile)
    const enrichFile = path.join(enrichRoot, book.prefix + chapter.id + '.enrich.json')
    let enrich
    try { enrich = await readJson(enrichFile) } catch { continue }  // 该章无扩展
    if (enrich.bookId !== undefined && enrich.bookId !== book.bookId) err(`${chapter.id}: enrich4.bookId 不一致`)
    const pointMap = isObj(enrich.points) ? enrich.points : {}
    const allIds = new Set()
    for (const s of chapter.sections || []) for (const p of s.points || []) if (p && p.id) allIds.add(p.id)
    let changed = 0
    for (const pid of Object.keys(pointMap)) {
      if (!allIds.has(pid)) { err(`${book.label} ${chapter.id}: enrich4 有未知知识点 ${pid}`); continue }
      const ext = pointMap[pid]
      if (!isObj(ext) || !isObj(ext.math)) { err(`${chapter.id} ${pid}: 缺少 math`); continue }
      if (!checkMath(ext.math, `${chapter.id} ${pid}`)) continue
      for (const s of chapter.sections || []) {
        for (const p of s.points || []) {
          if (!p || p.id !== pid) continue
          p.math = Object.assign({}, p.math || {}, {
            theorems: ext.math.theorems || (p.math && p.math.theorems) || [],
            derivationSteps: ext.math.derivationSteps,
            image: ext.math.image !== undefined ? ext.math.image : ((p.math && p.math.image) || null),
          })
          updatedPoints += 1
          updatedSteps += ext.math.derivationSteps.length
          changed += 1
        }
      }
    }
    if (changed) { updatedChapters += 1; pending.push({ file: chapterFile, chapter }) }
  }
  if (errors.length) return null
  if (!checkOnly) for (const item of pending) await writeFile(item.file, JSON.stringify(item.chapter, null, 2) + '\n', 'utf8')
  return { chapters: updatedChapters, points: updatedPoints, steps: updatedSteps }
}

async function main() {
  if (!(await readdir(enrichRoot).catch(() => null))) { console.error(`enrich4 目录不存在：${enrichRoot}`); process.exit(1) }
  console.log(`enrich4 目录：${enrichRoot}`)
  const results = []
  for (const b of BOOKS) results.push({ book: b, stats: await mergeBook(b) })
  if (errors.length) {
    console.error(`\n✗ 合并失败，${errors.length} 个问题（未写盘）：`)
    errors.slice(0, 80).forEach((e) => console.error('  - ' + e))
    process.exit(1)
  }
  for (const { book, stats } of results) {
    if (!stats) continue
    console.log(`✓ ${book.label}: 更新 ${stats.chapters} 章 / ${stats.points} 个知识点 / ${stats.steps} 步保姆级推导${checkOnly ? '（--check 未写盘）' : ''}`)
  }
  console.log('\n✓ enrich4 已合并')
}

main().catch((e) => { console.error('merge-enrich4 异常：', e); process.exit(1) })