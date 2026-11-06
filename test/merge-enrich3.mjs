#!/usr/bin/env node
/**
 * merge-enrich3.mjs — 把 enrich3/ 下的「结构化定理 + 推导步骤 + deepread 风格小节 digest」
 * 合并进教材数据。
 *
 * 用法：
 *   node plugin/textbook-parser/test/merge-enrich3.mjs           # 合并并写盘
 *   node plugin/textbook-parser/test/merge-enrich3.mjs --check   # 只校验不写盘
 *
 * 覆盖：
 *   - 信号与系统（内置）      enrich3/chNN.enrich.json
 *   - 高等数学（用户书）      enrich3/gaoshu-chNN.enrich.json
 *
 * enrich 结构：
 *   { "bookId":"...", "chapterId":"ch01",
 *     "sections": { "1.1": { "digest": { oneLine, corePoints[], argumentChain[],
 *                                        pointMap[{id,title,role,keyIdea}], takeaways[],
 *                                        pitfalls[], connections{before,after} } } },
 *     "points":   { "1.1.1": { "math": { theorems[{name,statement,conditions[],symbols[{sym,meaning}]}],
 *                                         derivationSteps[{step,detail}], image:null } } } }
 *
 * 规则：sections/points 的 key 必须覆盖该章**全部**节与知识点。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, '..')
const workspace = path.resolve(pkgRoot, '..', '..')
const enrichRoot = path.join(workspace, 'enrich3')
const checkOnly = process.argv.includes('--check')
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

async function readJson(file) {
  const text = await readFile(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) err(`${path.basename(file)} 含 BOM`)
  return JSON.parse(text)
}

/** 校验 digest（deepread 六段） */
function checkDigest(digest, where) {
  if (!isObj(digest)) { err(`${where}.digest 必须是对象`); return 0 }
  let ok = true
  if (!nonEmpty(digest.oneLine)) { err(`${where}.digest.oneLine 不能为空`); ok = false }
  for (const key of ['corePoints', 'argumentChain', 'takeaways', 'pitfalls']) {
    const list = digest[key]
    if (!Array.isArray(list) || list.length === 0) { err(`${where}.digest.${key} 必须是非空数组`); ok = false; continue }
    list.forEach((item, i) => { if (!nonEmpty(item)) { err(`${where}.digest.${key}[${i}] 不能为空`); ok = false } })
  }
  if (Array.isArray(digest.pitfalls) && digest.pitfalls.length < 1) { err(`${where}.digest.pitfalls 至少 1 条`); ok = false }
  const map = digest.pointMap
  if (!Array.isArray(map) || map.length === 0) { err(`${where}.digest.pointMap 必须是非空数组`); ok = false }
  else map.forEach((row, i) => {
    if (!isObj(row)) { err(`${where}.digest.pointMap[${i}] 必须是对象`); ok = false; return }
    if (!nonEmpty(row.id)) { err(`${where}.digest.pointMap[${i}].id 不能为空`); ok = false }
    if (!nonEmpty(row.title)) { err(`${where}.digest.pointMap[${i}].title 不能为空`); ok = false }
  })
  const conn = digest.connections
  if (!isObj(conn)) { err(`${where}.digest.connections 必须是对象`); ok = false }
  else {
    if (!nonEmpty(conn.before)) { err(`${where}.digest.connections.before 不能为空`); ok = false }
    if (!nonEmpty(conn.after)) { err(`${where}.digest.connections.after 不能为空`); ok = false }
  }
  return ok ? 1 : 0
}

/** 校验 math（定理 / 推导步骤 / 图片） */
function checkMath(math, where) {
  if (!isObj(math)) { err(`${where}.math 必须是对象`); return 0 }
  let ok = true
  const theorems = math.theorems
  if (!Array.isArray(theorems)) { err(`${where}.math.theorems 必须是数组`); ok = false }
  else theorems.forEach((thm, i) => {
    if (!isObj(thm)) { err(`${where}.math.theorems[${i}] 必须是对象`); ok = false; return }
    if (!nonEmpty(thm.name)) { err(`${where}.math.theorems[${i}].name 不能为空`); ok = false }
    if (!nonEmpty(thm.statement)) { err(`${where}.math.theorems[${i}].statement 不能为空`); ok = false }
    if (thm.conditions !== undefined && !Array.isArray(thm.conditions)) { err(`${where}.math.theorems[${i}].conditions 必须是数组`); ok = false }
    if (thm.symbols !== undefined) {
      if (!Array.isArray(thm.symbols)) { err(`${where}.math.theorems[${i}].symbols 必须是数组`); ok = false }
      else thm.symbols.forEach((sym, si) => {
        if (!isObj(sym)) { err(`${where}.math.theorems[${i}].symbols[${si}] 必须是对象`); ok = false; return }
        if (!nonEmpty(sym.sym)) { err(`${where}.math.theorems[${i}].symbols[${si}].sym 不能为空`); ok = false }
        if (!nonEmpty(sym.meaning)) { err(`${where}.math.theorems[${i}].symbols[${si}].meaning 不能为空`); ok = false }
      })
    }
  })
  const steps = math.derivationSteps
  if (!Array.isArray(steps)) { err(`${where}.math.derivationSteps 必须是数组`); ok = false }
  else steps.forEach((step, i) => {
    if (!isObj(step)) { err(`${where}.math.derivationSteps[${i}] 必须是对象`); ok = false; return }
    if (!nonEmpty(step.step)) { err(`${where}.math.derivationSteps[${i}].step 不能为空`); ok = false }
    if (!nonEmpty(step.detail)) { err(`${where}.math.derivationSteps[${i}].detail 不能为空`); ok = false }
  })
  const image = math.image
  if (image !== null && image !== undefined) {
    if (!isObj(image)) { err(`${where}.math.image 必须是对象或 null`); ok = false }
    else if (image.dataUrl !== undefined) {
      const url = String(image.dataUrl)
      if (!url.startsWith('data:image/')) { err(`${where}.math.image.dataUrl 必须以 data:image/ 开头`); ok = false }
      else if (url.length > 200000) { err(`${where}.math.image.dataUrl 过长（${url.length} > 200000）`); ok = false }
    }
  }
  return ok ? 1 : 0
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
  if (!chapterFiles.length) { err(`${book.label}: 找不到章节文件`); return null }

  const pending = []
  const stats = { chapters: 0, sections: 0, points: 0, theorems: 0, steps: 0, digests: 0, importantWithMath: 0, importantTotal: 0, files: 0 }

  for (const file of chapterFiles) {
    const chapterFile = path.join(chaptersDir, file)
    const chapter = await readJson(chapterFile)
    const enrichFile = path.join(enrichRoot, book.fileOf(chapter.id))
    let enrich
    try {
      enrich = await readJson(enrichFile)
    } catch (e) {
      err(`${book.label}: ${chapter.id} 缺少 enrich3 文件（${path.basename(enrichFile)}）：${e.message}`)
      continue
    }
    if (enrich.bookId !== undefined && enrich.bookId !== book.bookId) err(`${chapter.id}: enrich.bookId 不一致`)
    if (enrich.chapterId !== chapter.id) err(`${chapter.id}: enrich.chapterId=${enrich.chapterId} 与章 id 不一致`)

    const sectionMap = isObj(enrich.sections) ? enrich.sections : {}
    const pointMap = isObj(enrich.points) ? enrich.points : {}
    const allSections = []
    const allPoints = []
    for (const section of chapter.sections || []) {
      if (!section || !section.id) continue
      allSections.push(section.id)
      for (const point of section.points || []) if (point && point.id) allPoints.push(point.id)
    }
    for (const key of Object.keys(sectionMap)) if (!allSections.includes(key)) err(`${chapter.id}: enrich3.sections 有未知节 ${key}`)
    for (const key of Object.keys(pointMap)) if (!allPoints.includes(key)) err(`${chapter.id}: enrich3.points 有未知知识点 ${key}`)
    for (const sid of allSections) if (!isObj(sectionMap[sid])) err(`${chapter.id}: enrich3 缺少节 ${sid}`)
    for (const pid of allPoints) if (!isObj(pointMap[pid])) err(`${chapter.id}: enrich3 缺少知识点 ${pid}`)
    if (errors.length > 0) continue

    let chapterTheorems = 0
    let chapterSteps = 0
    for (const section of chapter.sections || []) {
      const sec = sectionMap[section.id]
      if (sec && isObj(sec.digest)) {
        if (checkDigest(sec.digest, `${chapter.id} ${section.id}`)) {
          section.digest = sec.digest
          stats.digests += 1
        }
        const mapped = Array.isArray(sec.digest.pointMap) ? sec.digest.pointMap.map((r) => r && r.id) : []
        for (const pid of (section.points || []).map((p) => p && p.id)) {
          if (!mapped.includes(pid)) err(`${chapter.id} ${section.id}: digest.pointMap 缺少知识点 ${pid}`)
        }
      }
      stats.sections += 1
      for (const point of section.points || []) {
        const pe = pointMap[point.id]
        if (point.important === true) stats.importantTotal += 1
        if (!pe || !isObj(pe.math)) continue
        if (checkMath(pe.math, `${chapter.id} ${point.id}`)) {
          point.math = pe.math
          stats.points += 1
          const t = Array.isArray(pe.math.theorems) ? pe.math.theorems.length : 0
          const s = Array.isArray(pe.math.derivationSteps) ? pe.math.derivationSteps.length : 0
          chapterTheorems += t
          chapterSteps += s
          if (point.important === true && t > 0 && s > 0) stats.importantWithMath += 1
        }
      }
    }
    if (errors.length > 0) continue
    stats.theorems += chapterTheorems
    stats.steps += chapterSteps
    stats.chapters += 1
    stats.files += 1
    pending.push({ file: chapterFile, chapter })
  }

  if (errors.length > 0) return null
  if (!checkOnly) {
    for (const item of pending) await writeFile(item.file, JSON.stringify(item.chapter, null, 2) + '\n', 'utf8')
  }
  return stats
}

async function main() {
  if (!(await readdir(enrichRoot).catch(() => null))) {
    console.error(`enrich3 目录不存在：${enrichRoot}`)
    process.exit(1)
  }
  console.log(`enrich3 目录：${enrichRoot}`)
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
    const ratio = ((stats.importantWithMath / Math.max(stats.importantTotal, 1)) * 100).toFixed(1)
    console.log(`✓ ${book.label}: ${stats.chapters} 章 / ${stats.sections} 节 / ${stats.points} 点含 math / ${stats.digests} 节含 digest / 定理 ${stats.theorems} / 推导步 ${stats.steps} / 重点点带定理+推导 ${stats.importantWithMath}/${stats.importantTotal}（${ratio}%）${checkOnly ? '（--check 未写盘）' : ''}`)
  }
  console.log('\n✓ 全部 enrich3 已合并')
}

main().catch((e) => {
  console.error('merge-enrich3 异常：', e)
  process.exit(1)
})