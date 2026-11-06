#!/usr/bin/env node
/**
 * merge-enrich.mjs — 把 enrich/ 下的扩展数据（生活类比 / 小节汇总 / 多题型例题）
 * 合并进内置教材数据 plugin/textbook-parser/data/books/<bookId>/。
 *
 * 用法：
 *   node plugin/textbook-parser/test/merge-enrich.mjs                 # 合并并写盘
 *   node plugin/textbook-parser/test/merge-enrich.mjs --check         # 只校验不写盘
 *   node plugin/textbook-parser/test/merge-enrich.mjs --book signals-systems-zheng
 *
 * enrich 文件结构（见 SPEC-V2 §1.3）：
 *   00-overview.enrich.json = { "overviewAnalogy": "..." }
 *   chNN.enrich.json = { "chapterId":"ch01", "chapterAnalogy":"...",
 *     "sections": { "1.1": { "summary":"...", "analogy":"...", "examples":[{id,type,source,question,answer,note?}] } },
 *     "points":   { "1.1.1": { "analogy":"..." } } }
 *
 * 规则：enrich 必须完整覆盖对应章的每一节与每一个知识点；缺失/多余都会失败且不写盘。
 * 幂等：重复执行会覆盖同样字段，不会累积。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, '..')
const workspace = path.resolve(pkgRoot, '..', '..')
const booksRoot = path.join(pkgRoot, 'data', 'books')
const enrichRoot = path.join(workspace, 'enrich')

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const bookArgIndex = args.indexOf('--book')
const bookFilter = bookArgIndex >= 0 ? args[bookArgIndex + 1] : ''

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

const errors = []
const err = (msg) => errors.push(msg)

function validateExamples(list, where) {
  if (!Array.isArray(list)) { err(`${where}.examples 必须是数组`); return 0 }
  if (list.length < 3) err(`${where}.examples 至少 3 道（当前 ${list.length}）`)
  const ids = new Set()
  let valid = 0
  list.forEach((ex, i) => {
    const w = `${where}.examples[${i}]`
    if (!isObj(ex)) { err(`${w} 必须是对象`); return }
    if (!nonEmpty(ex.question)) err(`${w}.question 不能为空`)
    if (!nonEmpty(ex.answer)) err(`${w}.answer 不能为空`)
    if (!nonEmpty(ex.type)) err(`${w}.type 不能为空`)
    if (ex.source !== undefined && typeof ex.source !== 'string') err(`${w}.source 必须是字符串`)
    if (ex.note !== undefined && typeof ex.note !== 'string') err(`${w}.note 必须是字符串`)
    if (ex.id !== undefined) {
      if (!nonEmpty(ex.id)) err(`${w}.id 不能为空字符串`)
      else if (ids.has(ex.id)) err(`${w}.id 重复：${ex.id}`)
      else ids.add(ex.id)
    }
    if (/^\s*(略|参见教材|见教材|同上)\s*$/.test(String(ex.answer || ''))) err(`${w}.answer 不能是“略/参见教材”`)
    if (nonEmpty(ex.question) && nonEmpty(ex.answer) && nonEmpty(ex.type)) valid += 1
  })
  return valid
}

async function readJson(file) {
  const text = await readFile(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) err(`${file}: 含 BOM`)
  return JSON.parse(text)
}

async function main() {
  const dirs = (await readdir(booksRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !bookFilter || name === bookFilter)

  if (dirs.length === 0) {
    console.error(`没有可合并的教材（--book ${bookFilter || '(全部)'}）`)
    process.exit(1)
  }
  if (!(await readdir(enrichRoot).catch(() => null))) {
    console.error(`enrich 目录不存在：${enrichRoot}`)
    process.exit(1)
  }

  let overviewAnalogy = ''
  try {
    const raw = await readJson(path.join(enrichRoot, '00-overview.enrich.json'))
    if (nonEmpty(raw.overviewAnalogy)) overviewAnalogy = raw.overviewAnalogy
    else err('00-overview.enrich.json: overviewAnalogy 不能为空')
  } catch (e) {
    err(`00-overview.enrich.json 读取失败：${e.message}`)
  }

  let totalSections = 0
  let totalExamples = 0
  let totalPointAnalogies = 0

  for (const dirName of dirs) {
    const bookDir = path.join(booksRoot, dirName)
    const bookFile = path.join(bookDir, 'book.json')
    const book = await readJson(bookFile)
    if (!isObj(book)) { err(`${bookFile}: 不是对象`); continue }

    if (overviewAnalogy) {
      book.overview = isObj(book.overview) ? book.overview : {}
      book.overview.analogy = overviewAnalogy
    } else {
      err(`${dirName}: 缺少 overviewAnalogy，无法写入 overview.analogy`)
    }

    const chaptersDir = path.join(bookDir, 'chapters')
    const chapterFiles = (await readdir(chaptersDir)).filter((f) => /^ch\d+\.json$/.test(f)).sort()
    const pending = []

    for (const file of chapterFiles) {
      const chapterFile = path.join(chaptersDir, file)
      const chapter = await readJson(chapterFile)
      if (!isObj(chapter)) { err(`${chapterFile}: 不是对象`); continue }
      const enrichFile = path.join(enrichRoot, `${chapter.id}.enrich.json`)
      let enrich
      try {
        enrich = await readJson(enrichFile)
      } catch (e) {
        err(`${chapter.id}: enrich 文件缺失或不可读（${enrichFile}）：${e.message}`)
        continue
      }
      if (enrich.chapterId !== chapter.id) err(`${chapter.id}: enrich.chapterId=${enrich.chapterId} 与章 id 不一致`)
      if (!nonEmpty(enrich.chapterAnalogy)) err(`${chapter.id}: chapterAnalogy 不能为空`)

      const meta = (book.chapters || []).find((c) => isObj(c) && c.id === chapter.id)
      if (!meta) err(`${chapter.id}: book.json 缺少该章`)
      if (meta && nonEmpty(enrich.chapterAnalogy)) meta.analogy = enrich.chapterAnalogy
      if (nonEmpty(enrich.chapterAnalogy)) chapter.analogy = enrich.chapterAnalogy

      const sectionMap = isObj(enrich.sections) ? enrich.sections : {}
      const pointMap = isObj(enrich.points) ? enrich.points : {}
      const chapterSections = Array.isArray(chapter.sections) ? chapter.sections : []
      const chapterSectionIds = new Set(chapterSections.map((s) => s && s.id).filter(Boolean))
      const chapterPointIds = new Set()
      for (const section of chapterSections) for (const point of section.points || []) if (point && point.id) chapterPointIds.add(point.id)

      for (const key of Object.keys(sectionMap)) if (!chapterSectionIds.has(key)) err(`${chapter.id}: enrich.sections 有未知节 ${key}`)
      for (const key of Object.keys(pointMap)) if (!chapterPointIds.has(key)) err(`${chapter.id}: enrich.points 有未知知识点 ${key}`)
      for (const sid of chapterSectionIds) if (!isObj(sectionMap[sid])) err(`${chapter.id}: enrich.sections 缺少节 ${sid}`)
      for (const pid of chapterPointIds) if (!isObj(pointMap[pid])) err(`${chapter.id}: enrich.points 缺少知识点 ${pid}`)

      for (const section of chapterSections) {
        if (!isObj(section)) continue
        const ex = sectionMap[section.id]
        if (!isObj(ex)) continue
        if (!nonEmpty(ex.summary)) err(`${chapter.id} ${section.id}: summary 不能为空`)
        if (!nonEmpty(ex.analogy)) err(`${chapter.id} ${section.id}: analogy 不能为空`)
        const count = validateExamples(ex.examples, `${chapter.id} ${section.id}`)
        if (count > 0) {
          section.summary = ex.summary
          section.analogy = ex.analogy
          section.examples = ex.examples
          totalSections += 1
          totalExamples += count
        }
        for (const point of section.points || []) {
          if (!isObj(point)) continue
          const pe = pointMap[point.id]
          if (isObj(pe) && nonEmpty(pe.analogy)) {
            point.analogy = pe.analogy
            totalPointAnalogies += 1
          }
        }
      }
      pending.push({ file: chapterFile, chapter })
    }

    if (errors.length === 0) {
      book.updatedAt = new Date().toISOString()
      if (!checkOnly) {
        await writeFile(bookFile, JSON.stringify(book, null, 2) + '\n', 'utf8')
        for (const item of pending) await writeFile(item.file, JSON.stringify(item.chapter, null, 2) + '\n', 'utf8')
      }
      console.log(`✓ ${dirName}: 合并 ${pending.length} 章 / ${totalSections} 节 / ${totalExamples} 道例题 / ${totalPointAnalogies} 个知识类比${checkOnly ? '（--check 未写盘）' : ''}`)
      totalSections = 0
      totalExamples = 0
      totalPointAnalogies = 0
    }
  }

  if (errors.length) {
    console.error(`\n✗ 合并失败，${errors.length} 个问题（未写盘）：`)
    for (const e of errors.slice(0, 80)) console.error('  - ' + e)
    if (errors.length > 80) console.error(`  ... 其余 ${errors.length - 80} 条省略`)
    process.exit(1)
  }
  console.log('\n✓ 全部 enrich 已合并')
}

main().catch((e) => {
  console.error('merge-enrich 异常：', e)
  process.exit(1)
})