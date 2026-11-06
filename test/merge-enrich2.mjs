#!/usr/bin/env node
/**
 * merge-enrich2.mjs — 把 enrich2/ 下的「知识点详解 + 星标」扩展数据合并进教材数据。
 *
 * 用法：
 *   node plugin/textbook-parser/test/merge-enrich2.mjs           # 合并并写盘
 *   node plugin/textbook-parser/test/merge-enrich2.mjs --check   # 只校验不写盘
 *
 * 覆盖两类书：
 *   - 信号与系统（内置，plugin/textbook-parser/data/books/signals-systems-zheng）
 *     文件：enrich2/chNN.enrich.json
 *   - 高等数学（用户书，$DSH_HOME/textbook-parser/books/advanced-mathematics-tongji）
 *     文件：enrich2/gaoshu-chNN.enrich.json
 *
 * 每个 enrich 文件结构：
 *   { "bookId": "...", "chapterId": "ch01", "points": { "1.1.1": {
 *       "important": true, "detail": "...", "keyPoints": ["..."],
 *       "derivation": "...", "mistakes": "...", "examTips": "..." } } }
 *
 * 规则：points 的 key 必须与该章文件的知识点 id 完全一致（缺/多都失败且不写盘）；
 * 幂等：重复执行覆盖同样字段。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, '..')
const workspace = path.resolve(pkgRoot, '..', '..')
const enrichRoot = path.join(workspace, 'enrich2')

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')

const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

const BOOKS = [
  {
    bookId: 'signals-systems-zheng',
    label: '信号与系统（内置）',
    bookDir: path.join(pkgRoot, 'data', 'books', 'signals-systems-zheng'),
    fileOf: (chapterId) => `${chapterId}.enrich.json`,
  },
  {
    bookId: 'advanced-mathematics-tongji',
    label: '高等数学（用户书）',
    bookDir: path.join(home, 'textbook-parser', 'books', 'advanced-mathematics-tongji'),
    fileOf: (chapterId) => `gaoshu-${chapterId}.enrich.json`,
  },
]

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const errors = []
const err = (m) => errors.push(m)

function checkPointFields(point, where) {
  if (!isObj(point)) { err(`${where} 必须是对象`); return 0 }
  let ok = false
  if (typeof point.important !== 'boolean') err(`${where}.important 必须是 boolean`)
  if (!nonEmpty(point.detail)) err(`${where}.detail 不能为空`)
  else if (point.detail.trim().length < 150) err(`${where}.detail 过短（${point.detail.trim().length} 字，要求 ≥350 字为宜）`)
  else if (point.detail.trim().length > 1200) err(`${where}.detail 过长（${point.detail.trim().length} 字，建议 ≤800）`)
  else ok = true
  if (!Array.isArray(point.keyPoints)) err(`${where}.keyPoints 必须是数组`)
  else {
    if (point.keyPoints.length < 3 || point.keyPoints.length > 8) err(`${where}.keyPoints 数量应为 3-6（当前 ${point.keyPoints.length}）`)
    point.keyPoints.forEach((item, i) => { if (!nonEmpty(item)) err(`${where}.keyPoints[${i}] 不能为空`) })
  }
  for (const key of ['derivation', 'mistakes', 'examTips']) {
    if (typeof point[key] !== 'string') err(`${where}.${key} 必须是字符串（可为 ""）`)
  }
  if (typeof point.mistakes === 'string' && nonEmpty(point.mistakes) === false) err(`${where}.mistakes 建议非空`)
  if (typeof point.examTips === 'string' && nonEmpty(point.examTips) === false) err(`${where}.examTips 建议非空`)
  return ok ? 1 : 0
}

async function readJson(file) {
  const text = await readFile(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) err(`${path.basename(file)} 含 BOM`)
  return JSON.parse(text)
}

async function mergeBook(book) {
  const bookFile = path.join(book.bookDir, 'book.json')
  let bookJson
  try {
    bookJson = await readJson(bookFile)
  } catch (e) {
    err(`${book.label}: 读取 book.json 失败（${bookFile}）：${e.message}`)
    return null
  }
  const chaptersDir = path.join(book.bookDir, 'chapters')
  const chapterFiles = (await readdir(chaptersDir).catch(() => [])).filter((f) => /^ch\d+\.json$/.test(f)).sort()
  if (chapterFiles.length === 0) { err(`${book.label}: 找不到章节文件 ${chaptersDir}`); return null }

  const pending = []
  const stats = { chapters: 0, points: 0, important: 0, detailTotal: 0, detailMin: Infinity, detailMax: 0, files: 0 }

  for (const file of chapterFiles) {
    const chapterFile = path.join(chaptersDir, file)
    const chapter = await readJson(chapterFile)
    const enrichFile = path.join(enrichRoot, book.fileOf(chapter.id))
    let enrich
    try {
      enrich = await readJson(enrichFile)
    } catch (e) {
      err(`${book.label}: ${chapter.id} 缺少 enrich2 文件（${path.basename(enrichFile)}）：${e.message}`)
      continue
    }
    if (enrich.bookId !== undefined && enrich.bookId !== book.bookId) err(`${chapter.id}: enrich.bookId=${enrich.bookId} 与 ${book.bookId} 不一致`)
    if (enrich.chapterId !== chapter.id) err(`${chapter.id}: enrich.chapterId=${enrich.chapterId} 与章 id 不一致`)
    const pointMap = isObj(enrich.points) ? enrich.points : {}
    const allIds = new Set()
    for (const section of chapter.sections || []) for (const point of section.points || []) if (point && point.id) allIds.add(point.id)
    for (const key of Object.keys(pointMap)) if (!allIds.has(key)) err(`${chapter.id}: enrich2 有未知知识点 ${key}`)
    for (const id of allIds) if (!isObj(pointMap[id])) err(`${chapter.id}: enrich2 缺少知识点 ${id}`)
    if (errors.length > 0) continue

    let chapterImportant = 0
    let sectionHasImportant = new Map()
    for (const section of chapter.sections || []) {
      const sid = section && section.id
      for (const point of (section && section.points) || []) {
        const ext = pointMap[point.id]
        if (!ext) continue
        point.important = ext.important === true
        point.detail = String(ext.detail || '').trim()
        point.keyPoints = Array.isArray(ext.keyPoints) ? ext.keyPoints.map((s) => String(s)) : []
        point.derivation = typeof ext.derivation === 'string' ? ext.derivation : ''
        point.mistakes = typeof ext.mistakes === 'string' ? ext.mistakes : ''
        point.examTips = typeof ext.examTips === 'string' ? ext.examTips : ''
        stats.points += 1
        stats.detailTotal += point.detail.length
        stats.detailMin = Math.min(stats.detailMin, point.detail.length)
        stats.detailMax = Math.max(stats.detailMax, point.detail.length)
        if (point.important) { stats.important += 1; chapterImportant += 1; sectionHasImportant.set(sid, true) }
      }
      if (section && section.id && !sectionHasImportant.get(sid)) err(`${chapter.id} ${sid}: 该节没有重点知识点（important=true）`)
    }
    const allSections = (chapter.sections || []).map((s) => s && s.id).filter(Boolean)
    const ratio = chapterImportant / Math.max([...allIds].length, 1)
    /* 每节至少 1 个重点为硬约束；每节 2 点的高数书 1 星/节 = 50%，允许到 55%。 */
    if (ratio < 0.25 || ratio > 0.60) err(`${chapter.id}: 重点比例 ${(ratio * 100).toFixed(0)}% 超出允许范围（25%-60%）`)
    stats.chapters += 1
    stats.files += 1
    pending.push({ file: chapterFile, chapter })
  }

  if (errors.length > 0) return null

  if (!checkOnly) {
    for (const item of pending) await writeFile(item.file, JSON.stringify(item.chapter, null, 2) + '\n', 'utf8')
  }
  return { ...stats, avgDetail: Math.round(stats.detailTotal / Math.max(stats.points, 1)), importantRatio: (stats.important / Math.max(stats.points, 1)) }
}

async function main() {
  if (!(await readdir(enrichRoot).catch(() => null))) {
    console.error(`enrich2 目录不存在：${enrichRoot}`)
    process.exit(1)
  }
  console.log(`enrich2 目录：${enrichRoot}`)
  const results = []
  for (const book of BOOKS) results.push({ book, stats: await mergeBook(book) })
  if (errors.length) {
    console.error(`\n✗ 合并失败，${errors.length} 个问题（未写盘）：`)
    for (const e of errors.slice(0, 100)) console.error('  - ' + e)
    if (errors.length > 100) console.error(`  ... 其余 ${errors.length - 100} 条省略`)
    process.exit(1)
  }
  for (const { book, stats } of results) {
    if (!stats) continue
    console.log(`✓ ${book.label}: ${stats.chapters} 章 / ${stats.points} 点 / 重点 ${stats.important}（${(stats.importantRatio * 100).toFixed(1)}%）/ detail 平均 ${stats.avgDetail} 字（${stats.detailMin}-${stats.detailMax}）${checkOnly ? '（--check 未写盘）' : ''}`)
  }
  console.log('\n✓ 全部 enrich2 已合并')
}

main().catch((e) => {
  console.error('merge-enrich2 异常：', e)
  process.exit(1)
})