#!/usr/bin/env node
/**
 * check-user-book.mjs — 校验用户目录里的教材数据（textbook_archive 写入的书）
 *
 * 用法：
 *   node plugin/textbook-parser/test/check-user-book.mjs [bookId]
 *   默认 bookId = advanced-mathematics-tongji
 *
 * 校验内容：book/章结构（复用 host/store.js 的 validateBook/validateChapter，含跨文件一致性）
 * + v1.1 扩展字段（overview.analogy、章 analogy、节 summary/analogy/examples、点 analogy）
 * + 统计输出（章/节/点/例题/题型）。
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const storeModule = await import(pathToFileURL(path.join(here, '..', 'host', 'store.js')).href)
const { validateBook, validateChapter } = storeModule

const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const bookId = process.argv[2] || 'advanced-mathematics-tongji'
const bookDir = path.join(home, 'textbook-parser', 'books', bookId)

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0
const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

async function readJson(file) {
  const text = await readFile(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) err(`${path.basename(file)} 含 BOM`)
  return JSON.parse(text)
}

const bookFile = path.join(bookDir, 'book.json')
let book
try {
  book = await readJson(bookFile)
} catch (e) {
  console.error(`读取失败 ${bookFile}：${e.message}`)
  process.exit(1)
}

const chaptersDir = path.join(bookDir, 'chapters')
const chapterFiles = (await readdir(chaptersDir).catch(() => [])).filter((f) => /^ch\d+\.json$/.test(f)).sort()
const chapters = new Map()
for (const f of chapterFiles) {
  try {
    chapters.set(f.replace(/\.json$/, ''), await readJson(path.join(chaptersDir, f)))
  } catch (e) {
    err(`${f} 解析失败：${e.message}`)
  }
}

// 1) 结构校验（复用插件 store 的一致性检查）
const chapterFilesMap = new Map()
for (const [id, ch] of chapters) chapterFilesMap.set(id, ch)
const bookResult = validateBook(book, { chapterFiles: chapterFilesMap })
for (const e of bookResult.errors) err(`book: ${e}`)
for (const [id, ch] of chapters) {
  const res = validateChapter(ch, { book })
  for (const e of res.errors) err(`${id}: ${e}`)
}

// 2) v1.1 扩展字段
if (!nonEmpty(book?.overview?.analogy)) err('overview.analogy 缺失或为空')
const bookChapterMap = new Map((book.chapters || []).map((c) => [c?.id, c]))
let sectionTotal = 0
let pointTotal = 0
let exampleTotal = 0
let analogyTotal = 0
let importantTotal = 0
let detailTotal = 0
let detailMin = Infinity
let detailMax = 0
let theoremTotal = 0
let stepTotal = 0
let digestTotal = 0
const typeStats = new Map()
for (const [id, ch] of chapters) {
  if (!nonEmpty(ch.analogy)) err(`${id}: chapter.analogy 缺失或为空`)
  const meta = bookChapterMap.get(id)
  if (meta && meta.analogy !== ch.analogy) err(`${id}: book/章文件 analogy 不一致`)
  for (const section of ch.sections || []) {
    sectionTotal += 1
    if (!nonEmpty(section.summary)) err(`${id} ${section.id}: summary 缺失`)
    if (!nonEmpty(section.analogy)) err(`${id} ${section.id}: analogy 缺失`)
    const ex = Array.isArray(section.examples) ? section.examples : []
    if (ex.length < 3) err(`${id} ${section.id}: examples 少于 3 道（${ex.length}）`)
    const types = new Set()
    ex.forEach((e, i) => {
      if (!nonEmpty(e?.question)) err(`${id} ${section.id}.examples[${i}]: question 空`)
      if (!nonEmpty(e?.answer)) err(`${id} ${section.id}.examples[${i}]: answer 空`)
      if (!nonEmpty(e?.type)) err(`${id} ${section.id}.examples[${i}]: type 空`)
      if (e?.type) { types.add(e.type.trim()); typeStats.set(e.type.trim(), (typeStats.get(e.type.trim()) || 0) + 1) }
      if (/^\s*(略|参见教材|见教材|同上)\s*$/.test(String(e?.answer || ''))) err(`${id} ${section.id}.examples[${i}]: answer 是“略”`)
    })
    if (ex.length >= 3 && types.size < 2) err(`${id} ${section.id}: 例题题型少于 2 类`)
    exampleTotal += ex.length
    let sectionImportant = 0
    for (const point of section.points || []) {
      pointTotal += 1
      if (!nonEmpty(point.analogy)) err(`${id} ${section.id} ${point.id}: analogy 缺失`)
      else analogyTotal += 1
      /* v1.2：重点星标 + 学习型详解 */
      if (typeof point.important !== 'boolean') err(`${id} ${section.id} ${point.id}: important 必须是 boolean`)
      if (point.important === true) { importantTotal += 1; sectionImportant += 1 }
      const detail = typeof point.detail === 'string' ? point.detail.trim() : ''
      if (!detail) err(`${id} ${section.id} ${point.id}: detail 缺失`)
      else {
        detailTotal += detail.length
        detailMin = Math.min(detailMin, detail.length)
        detailMax = Math.max(detailMax, detail.length)
        if (detail.length < 200) err(`${id} ${section.id} ${point.id}: detail 过短（${detail.length}）`)
        else if (detail.length < 350 || detail.length > 900) warn(`${id} ${section.id} ${point.id}: detail 建议 350-800 字（当前 ${detail.length}）`)
      }
      const keyPoints = point.keyPoints
      if (!Array.isArray(keyPoints)) err(`${id} ${section.id} ${point.id}: keyPoints 必须是数组`)
      else {
        if (keyPoints.length < 3 || keyPoints.length > 8) err(`${id} ${section.id} ${point.id}: keyPoints 数量应为 3-6（${keyPoints.length}）`)
        keyPoints.forEach((item, i) => { if (!nonEmpty(item)) err(`${id} ${section.id} ${point.id}.keyPoints[${i}]: 空`) })
      }
      for (const key of ['derivation', 'mistakes', 'examTips']) {
        if (typeof point[key] !== 'string') err(`${id} ${section.id} ${point.id}: ${key} 必须是字符串（可为空）`)
      }
      /* v1.3：结构化定理 + 推导步骤 */
      const math = point.math
      if (!math || typeof math !== 'object') err(`${id} ${section.id} ${point.id}: math 缺失`)
      else {
        const theorems = Array.isArray(math.theorems) ? math.theorems : null
        if (!theorems) err(`${id} ${section.id} ${point.id}: math.theorems 必须是数组`)
        else {
          theoremTotal += theorems.length
          theorems.forEach((thm, t) => {
            if (!nonEmpty(thm && thm.name)) err(`${id} ${section.id} ${point.id}.math.theorems[${t}]: name 空`)
            if (!nonEmpty(thm && thm.statement)) err(`${id} ${section.id} ${point.id}.math.theorems[${t}]: statement 空`)
          })
        }
        const steps = Array.isArray(math.derivationSteps) ? math.derivationSteps : null
        if (!steps) err(`${id} ${section.id} ${point.id}: math.derivationSteps 必须是数组`)
        else {
          stepTotal += steps.length
          steps.forEach((step, si) => {
            if (!nonEmpty(step && step.step)) err(`${id} ${section.id} ${point.id}.math.derivationSteps[${si}]: step 空`)
            if (!nonEmpty(step && step.line) && !nonEmpty(step && step.detail)) {
              err(`${id} ${section.id} ${point.id}.math.derivationSteps[${si}]: 需要 line 或 detail`)
            }
          })
        }
      }
    }
    if (sectionImportant === 0) err(`${id} ${section.id}: 本节没有重点知识点`)
    /* v1.3：digest 六段 */
    const digest = section.digest
    if (!digest || typeof digest !== 'object') err(`${id} ${section.id}: digest 缺失`)
    else {
      if (!nonEmpty(digest.oneLine)) err(`${id} ${section.id}: digest.oneLine 空`)
      for (const key of ['corePoints', 'argumentChain', 'takeaways', 'pitfalls']) {
        if (!Array.isArray(digest[key]) || digest[key].length === 0) err(`${id} ${section.id}: digest.${key} 必须是非空数组`)
      }
      if (!Array.isArray(digest.pointMap) || digest.pointMap.length === 0) err(`${id} ${section.id}: digest.pointMap 必须是非空数组`)
      if (!digest.connections || !nonEmpty(digest.connections.before) || !nonEmpty(digest.connections.after)) {
        err(`${id} ${section.id}: digest.connections.before/after 不能为空`)
      }
      digestTotal += 1
    }
  }
}

// 3) stats 一致性
const actual = { chapters: chapters.size, sections: sectionTotal, points: pointTotal }
for (const k of Object.keys(actual)) {
  if (book?.stats?.[k] !== actual[k]) warn(`book.stats.${k}=${book?.stats?.[k]} 与实际 ${actual[k]} 不一致`)
}

console.log(`\n教材：${book.title}（${book.subtitle || ''}） id=${book.id}`)
console.log(`目录：${bookDir}`)
console.log(`规模：${actual.chapters} 章 / ${actual.sections} 节 / ${actual.points} 知识点 / ${exampleTotal} 道例题（平均 ${(exampleTotal / Math.max(actual.sections, 1)).toFixed(1)} 道/节）/ ${analogyTotal} 个知识点类比`)
const importantRatio = importantTotal / Math.max(actual.points, 1)
const detailAvg = Math.round(detailTotal / Math.max(actual.points, 1))
console.log(`v1.2：重点知识点 ${importantTotal}（${(importantRatio * 100).toFixed(1)}%）/ 详解平均 ${detailAvg} 字（${Number.isFinite(detailMin) ? detailMin : 0}-${detailMax}）`)
console.log(`v1.3：结构化定理 ${theoremTotal} 条 / 推导步骤 ${stepTotal} 步 / digest ${digestTotal} 节`)
if (actual.points > 0 && (importantRatio < 0.30 || importantRatio > 0.55)) warn(`重点比例 ${(importantRatio * 100).toFixed(1)}% 不在 30%-55% 区间（每节≥1 重点优先）`)
console.log(`题型：${[...typeStats.entries()].map(([k, v]) => `${k}=${v}`).join(' / ') || '无'}`)
if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 条：`)
  for (const w of warnings.slice(0, 20)) console.log('  - ' + w)
}
if (errors.length) {
  console.error(`\n✗ 错误 ${errors.length} 条：`)
  for (const e of errors.slice(0, 60)) console.error('  - ' + e)
  if (errors.length > 60) console.error(`  ... 其余 ${errors.length - 60} 条省略`)
  process.exit(1)
}
console.log('\n✓ 用户书校验通过')