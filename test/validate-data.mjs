#!/usr/bin/env node
/**
 * validate-data.mjs — 校验 textbook-parser 内置教材数据（book.json + chapters/*.json）
 *
 * 用法：
 *   node plugin/textbook-parser/test/validate-data.mjs
 *   node plugin/textbook-parser/test/validate-data.mjs --fix-stats
 *
 * v2 新增校验（SPEC-V2）：overview.analogy、chapter.analogy、section.summary、
 * section.analogy、section.examples（≥3 道、题型覆盖、答案非“略”）、point.analogy。
 *
 * --fix-stats：按实际内容重算 book.json 的 stats 并写回（仅 Lead 使用）。
 * 退出码：0 全通过；1 存在错误。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const booksDir = path.join(root, 'data', 'books')
const fixStats = process.argv.includes('--fix-stats')

const errors = []
const warnings = []
const err = (file, msg) => errors.push(`${file}: ${msg}`)
const warn = (file, msg) => warnings.push(`${file}: ${msg}`)

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isArr = Array.isArray
const BAD_ANSWER_RE = /^\s*(略|参见教材|见教材|同上)\s*$/

function reqString(file, obj, key, label = key) {
  if (!nonEmpty(obj?.[key])) err(file, `缺少或为空: ${label}`)
  return typeof obj?.[key] === 'string' ? obj[key] : ''
}
function optString(file, obj, key, label = key) {
  if (obj?.[key] !== undefined && typeof obj[key] !== 'string') err(file, `${label} 必须是字符串`)
  return typeof obj?.[key] === 'string' ? obj[key] : ''
}
function reqStringArray(file, obj, key, { min = 0 } = {}) {
  const v = obj?.[key]
  if (!isArr(v)) return err(file, `${key} 必须是数组`)
  if (v.length < min) err(file, `${key} 至少需要 ${min} 项`)
  v.forEach((x, i) => { if (!nonEmpty(x)) err(file, `${key}[${i}] 不能为空`) })
  return v
}

async function readJson(file) {
  try {
    const text = await readFile(file, 'utf8')
    if (text.charCodeAt(0) === 0xfeff) err(file, '文件含 BOM')
    return JSON.parse(text)
  } catch (e) {
    err(file, `JSON 解析失败: ${e.message}`)
    return null
  }
}

function validateBook(file, book) {
  if (!book) return
  if (book.schemaVersion !== 1) err(file, 'schemaVersion 必须为 1')
  reqString(file, book, 'id')
  if (book.id && !/^[a-z0-9][a-z0-9-]*$/.test(book.id)) err(file, 'id 必须为 kebab-case')
  reqString(file, book, 'title')
  reqString(file, book, 'subject')
  reqStringArray(file, book, 'tags')
  const ov = book.overview
  if (!isObj(ov)) err(file, '缺少 overview 对象')
  else {
    reqString(file, ov, 'goal', 'overview.goal')
    reqString(file, ov, 'pain', 'overview.pain')
    reqString(file, ov, 'mainline', 'overview.mainline')
    reqString(file, ov, 'analogy', 'overview.analogy（生活类比，v2 必填）')
    if (!isArr(ov.chain) || ov.chain.length < 2) err(file, 'overview.chain 至少 2 项')
    else ov.chain.forEach((c, i) => {
      if (!isObj(c)) return err(file, `overview.chain[${i}] 必须是对象`)
      reqString(file, c, 'step', `overview.chain[${i}].step`)
      reqString(file, c, 'detail', `overview.chain[${i}].detail`)
      reqString(file, c, 'defect', `overview.chain[${i}].defect`)
    })
  }
  const chapters = book.chapters
  if (!isArr(chapters) || chapters.length !== 12) err(file, `chapters 必须为 12 章，实际 ${isArr(chapters) ? chapters.length : '非数组'}`)
  const chapterIds = new Set()
  if (isArr(chapters)) {
    chapters.forEach((ch, i) => {
      const f = `chapters[${i}]`
      if (!isObj(ch)) return err(file, `${f} 必须是对象`)
      if (ch.id !== `ch${String(i + 1).padStart(2, '0')}`) err(file, `${f}.id 应为 ch${String(i + 1).padStart(2, '0')}`)
      if (ch.number !== i + 1) err(file, `${f}.number 应为 ${i + 1}`)
      if (chapterIds.has(ch.id)) err(file, `${f}.id 重复: ${ch.id}`)
      chapterIds.add(ch.id)
      reqString(file, ch, 'title', `${f}.title`)
      reqString(file, ch, 'solves', `${f}.solves`)
      reqString(file, ch, 'gain', `${f}.gain`)
      reqString(file, ch, 'remainingGap', `${f}.remainingGap`)
      reqString(file, ch, 'analogy', `${f}.analogy（生活类比，v2 必填）`)
      reqStringArray(file, ch, 'requires', { min: 0 })
      if (!isArr(ch.sections) || ch.sections.length < 6) err(file, `${f}.sections 至少 6 节`)
      else {
        const seen = new Set()
        ch.sections.forEach((s, j) => {
          const sf = `${f}.sections[${j}]`
          if (!isObj(s)) return err(file, `${sf} 必须是对象`)
          reqString(file, s, 'id', `${sf}.id`)
          reqString(file, s, 'title', `${sf}.title`)
          reqString(file, s, 'subProblem', `${sf}.subProblem`)
          if (seen.has(s.id)) err(file, `${sf}.id 重复: ${s.id}`)
          seen.add(s.id)
          if (!Number.isInteger(s.pointCount) || s.pointCount < 2) err(file, `${sf}.pointCount 必须是 >=2 的整数`)
        })
      }
    })
  }
  if (!isObj(book.stats)) err(file, '缺少 stats')
}

function validateExamples(file, section, label) {
  const list = section.examples
  if (!isArr(list)) { err(file, `${label}.examples（v2 必填）必须是数组`); return 0 }
  if (list.length < 3) err(file, `${label}.examples 至少 3 道（当前 ${list.length}）`)
  const ids = new Set()
  const types = new Set()
  list.forEach((ex, i) => {
    const w = `${label}.examples[${i}]`
    if (!isObj(ex)) return err(file, `${w} 必须是对象`)
    reqString(file, ex, 'type', `${w}.type`)
    reqString(file, ex, 'question', `${w}.question`)
    const answer = reqString(file, ex, 'answer', `${w}.answer`)
    reqString(file, ex, 'source', `${w}.source`)
    if (ex.source !== undefined) optString(file, ex, 'source', `${w}.source`)
    if (ex.note !== undefined) optString(file, ex, 'note', `${w}.note`)
    if (ex.id !== undefined) {
      if (!nonEmpty(ex.id)) err(file, `${w}.id 不能为空字符串`)
      else if (ids.has(ex.id)) err(file, `${w}.id 重复：${ex.id}`)
      else ids.add(ex.id)
    }
    if (answer && BAD_ANSWER_RE.test(answer)) err(file, `${w}.answer 不能是“略/参见教材”`)
    if (nonEmpty(ex.type)) types.add(ex.type.trim())
  })
  if (list.length >= 3 && types.size < 2) err(file, `${label}.examples 题型覆盖不足（至少 2 类，当前：${[...types].join('/') || '无'}）`)
  else if (list.length >= 3 && types.size < 3) warn(file, `${label}.examples 题型只有 ${types.size} 类（建议 3 类以上）`)
  return list.length
}

function validateChapter(file, ch) {
  if (!ch) return
  const rel = path.basename(file)
  reqString(file, ch, 'id')
  if (ch.id !== rel.replace(/\.json$/, '')) err(file, `章 id "${ch.id}" 与文件名 ${rel} 不一致`)
  if (!Number.isInteger(ch.number) || ch.number < 1 || ch.number > 12) err(file, 'number 必须是 1..12 的整数')
  reqString(file, ch, 'title')
  reqString(file, ch, 'solves')
  reqString(file, ch, 'gain')
  reqString(file, ch, 'remainingGap')
  reqString(file, ch, 'analogy', 'chapter.analogy（生活类比，v2 必填）')
  reqStringArray(file, ch, 'requires')
  const chain = ch.chain
  if (!isArr(chain) || chain.length < 2) err(file, 'chain 至少 2 项')
  else chain.forEach((c, i) => {
    if (!isObj(c)) return err(file, `chain[${i}] 必须是对象`)
    reqString(file, c, 'from', `chain[${i}].from`)
    reqString(file, c, 'to', `chain[${i}].to`)
    reqString(file, c, 'label', `chain[${i}].label`)
  })
  const sections = ch.sections
  if (!isArr(sections) || sections.length < 6) err(file, 'sections 至少 6 节')
  const sectionIds = new Set()
  const pointIds = new Set()
  let pointTotal = 0
  let exampleTotal = 0
  let analogyTotal = 0
  let theoremTotal = 0
  let stepTotal = 0
  let importantTotal = 0
  let detailTotal = 0
  let detailMin = Infinity
  let detailMax = 0
  if (isArr(sections)) {
    sections.forEach((s, i) => {
      const sf = `sections[${i}]`
      if (!isObj(s)) return err(file, `${sf} 必须是对象`)
      reqString(file, s, 'id', `${sf}.id`)
      reqString(file, s, 'title', `${sf}.title`)
      reqString(file, s, 'subProblem', `${sf}.subProblem`)
      reqString(file, s, 'summary', `${sf}.summary（本节知识点汇总，v2 必填）`)
      reqString(file, s, 'analogy', `${sf}.analogy（生活类比，v2 必填）`)
      /* v1.3：deepread 风格 digest */
      const digest = s.digest
      if (!isObj(digest)) err(file, `${sf}.digest（v1.3 必填）必须是对象`)
      else {
        reqString(file, digest, 'oneLine', `${sf}.digest.oneLine`)
        for (const key of ['corePoints', 'argumentChain', 'takeaways', 'pitfalls']) {
          if (!isArr(digest[key]) || digest[key].length === 0) err(file, `${sf}.digest.${key} 必须是非空数组`)
          else digest[key].forEach((item, k) => { if (!nonEmpty(item)) err(file, `${sf}.digest.${key}[${k}] 不能为空`) })
        }
        if (!isArr(digest.pointMap) || digest.pointMap.length === 0) err(file, `${sf}.digest.pointMap 必须是非空数组`)
        else digest.pointMap.forEach((row, k) => {
          if (!isObj(row)) return err(file, `${sf}.digest.pointMap[${k}] 必须是对象`)
          reqString(file, row, 'id', `${sf}.digest.pointMap[${k}].id`)
          reqString(file, row, 'title', `${sf}.digest.pointMap[${k}].title`)
        })
        if (!isObj(digest.connections)) err(file, `${sf}.digest.connections 必须是对象`)
        else {
          reqString(file, digest.connections, 'before', `${sf}.digest.connections.before`)
          reqString(file, digest.connections, 'after', `${sf}.digest.connections.after`)
        }
      }
      reqStringArray(file, s, 'requires')
      if (typeof s.remaining !== 'string') err(file, `${sf}.remaining 必须是字符串（可为空）`)
      if (sectionIds.has(s.id)) err(file, `${sf}.id 重复: ${s.id}`)
      sectionIds.add(s.id)
      exampleTotal += validateExamples(file, s, `${sf}`)
      const points = s.points
      if (!isArr(points) || points.length < 2) return err(file, `${sf}.points 至少 2 个知识点`)
      pointTotal += points.length
      let sectionImportant = 0
      points.forEach((p, j) => {
        const pf = `${sf}.points[${j}]`
        if (!isObj(p)) return err(file, `${pf} 必须是对象`)
        const pid = reqString(file, p, 'id', `${pf}.id`)
        if (pid && !/^\d+(\.\d+)+$/.test(pid)) warn(file, `${pf}.id "${pid}" 不是数字点号格式`)
        if (pid && pointIds.has(pid)) err(file, `${pf}.id 重复: ${pid}`)
        pointIds.add(pid)
        reqString(file, p, 'title', `${pf}.title`)
        reqString(file, p, 'solves', `${pf}.solves`)
        reqString(file, p, 'meaning', `${pf}.meaning`)
        reqString(file, p, 'application', `${pf}.application`)
        reqString(file, p, 'analogy', `${pf}.analogy（生活类比，v2 必填）`)
        analogyTotal += 1
        reqStringArray(file, p, 'prerequisites')
        if (typeof p.formula !== 'string') err(file, `${pf}.formula 必须是字符串（可为空）`)
        if (typeof p.limitation !== 'string') err(file, `${pf}.limitation 必须是字符串（可为空）`)
        if (typeof p.next !== 'string') err(file, `${pf}.next 必须是字符串（可为空）`)
        /* v1.2：重点星标 + 学习型详解 */
        if (typeof p.important !== 'boolean') err(file, `${pf}.important（星标，v1.2 必填）必须是 boolean`)
        if (p.important === true) { importantTotal += 1; sectionImportant += 1 }
        const detailText = reqString(file, p, 'detail', `${pf}.detail（详细讲解，v1.2 必填）`)
        if (detailText) {
          const len = detailText.trim().length
          detailTotal += len
          detailMin = Math.min(detailMin, len)
          detailMax = Math.max(detailMax, len)
          if (len < 200) err(file, `${pf}.detail 过短（${len} 字，要求 ≥350 字）`)
          else if (len < 350 || len > 900) warn(file, `${pf}.detail 建议 350-800 字（当前 ${len}）`)
        }
        const keyPoints = p.keyPoints
        if (!isArr(keyPoints)) err(file, `${pf}.keyPoints（学习要点，v1.2 必填）必须是数组`)
        else {
          if (keyPoints.length < 3 || keyPoints.length > 8) err(file, `${pf}.keyPoints 数量应为 3-6（当前 ${keyPoints.length}）`)
          keyPoints.forEach((item, k) => { if (!nonEmpty(item)) err(file, `${pf}.keyPoints[${k}] 不能为空`) })
        }
        for (const key of ['derivation', 'mistakes', 'examTips']) {
          if (typeof p[key] !== 'string') err(file, `${pf}.${key} 必须是字符串（可为空，v1.2 必填）`)
        }
        if (!nonEmpty(p.mistakes)) warn(file, `${pf}.mistakes 建议非空（易错辨析）`)
        if (!nonEmpty(p.examTips)) warn(file, `${pf}.examTips 建议非空（考试/应用提示）`)
        /* v1.3：结构化定理 + 推导步骤 */
        const math = p.math
        if (!isObj(math)) err(file, `${pf}.math（v1.3 必填）必须是对象`)
        else {
          const theorems = math.theorems
          if (!isArr(theorems)) err(file, `${pf}.math.theorems 必须是数组`)
          else {
            theoremTotal += theorems.length
            theorems.forEach((thm, t) => {
              if (!isObj(thm)) return err(file, `${pf}.math.theorems[${t}] 必须是对象`)
              reqString(file, thm, 'name', `${pf}.math.theorems[${t}].name`)
              reqString(file, thm, 'statement', `${pf}.math.theorems[${t}].statement`)
              if (thm.conditions !== undefined && !isArr(thm.conditions)) err(file, `${pf}.math.theorems[${t}].conditions 必须是数组`)
              if (thm.symbols !== undefined) {
                if (!isArr(thm.symbols)) err(file, `${pf}.math.theorems[${t}].symbols 必须是数组`)
                else thm.symbols.forEach((sym, si) => {
                  if (!isObj(sym)) return err(file, `${pf}.math.theorems[${t}].symbols[${si}] 必须是对象`)
                  reqString(file, sym, 'sym', `${pf}.math.theorems[${t}].symbols[${si}].sym`)
                  reqString(file, sym, 'meaning', `${pf}.math.theorems[${t}].symbols[${si}].meaning`)
                })
              }
            })
            if (p.important === true && theorems.length === 0) warn(file, `${pf}: 重点知识点没有定理`)
          }
          const steps = math.derivationSteps
          if (!isArr(steps)) err(file, `${pf}.math.derivationSteps 必须是数组`)
          else {
            stepTotal += steps.length
            steps.forEach((step, si) => {
              if (!isObj(step)) return err(file, `${pf}.math.derivationSteps[${si}] 必须是对象`)
              reqString(file, step, 'step', `${pf}.math.derivationSteps[${si}].step`)
              /* v1.3.1：保姆级推导——line（纯算式）或 detail（文字说明）至少一项 */
              const hasLine = nonEmpty(step.line)
              const hasDetail = nonEmpty(step.detail)
              if (!hasLine && !hasDetail) err(file, `${pf}.math.derivationSteps[${si}] 需要 line（算式）或 detail（说明）`)
              if (hasLine && typeof step.line !== 'string') err(file, `${pf}.math.derivationSteps[${si}].line 必须是字符串`)
              if (step.why !== undefined && typeof step.why !== 'string') err(file, `${pf}.math.derivationSteps[${si}].why 必须是字符串`)
            })
            if (p.important === true && steps.length === 0) warn(file, `${pf}: 重点知识点没有推导步骤`)
          }
          if (math.image !== null && math.image !== undefined) {
            if (!isObj(math.image)) err(file, `${pf}.math.image 必须是对象或 null`)
            else if (math.image.dataUrl !== undefined) {
              const url = String(math.image.dataUrl)
              if (!url.startsWith('data:image/')) err(file, `${pf}.math.image.dataUrl 必须以 data:image/ 开头`)
              else if (url.length > 200000) err(file, `${pf}.math.image.dataUrl 过长`)
            }
          }
        }
        const ex = p.example
        if (!isObj(ex)) return err(file, `${pf}.example 必须是对象`)
        reqString(file, ex, 'question', `${pf}.example.question`)
        reqString(file, ex, 'answer', `${pf}.example.answer`)
        if (nonEmpty(ex.question) && BAD_ANSWER_RE.test(ex.question)) err(file, `${pf}.example.question 不能是"${ex.question}"`)
      })
      if (sectionImportant === 0) err(file, `${sf}: 本节没有重点知识点（至少 1 个 important=true）`)
    })
  }
  return {
    sections: isArr(sections) ? sections.length : 0,
    points: pointTotal,
    examples: exampleTotal,
    analogies: analogyTotal,
    theorems: theoremTotal,
    steps: stepTotal,
    important: importantTotal,
    detailTotal,
    detailMin: Number.isFinite(detailMin) ? detailMin : 0,
    detailMax,
    sectionIds: [...sectionIds],
  }
}

// ---- main ----
const bookDirs = []
try {
  for (const e of await readdir(booksDir, { withFileTypes: true })) if (e.isDirectory()) bookDirs.push(e.name)
} catch (e) {
  console.error(`无法读取数据目录 ${booksDir}: ${e.message}`)
  process.exit(1)
}
if (bookDirs.length === 0) {
  console.error('data/books 下没有任何教材目录')
  process.exit(1)
}

let totalChapters = 0
let totalSections = 0
let totalPoints = 0
let totalExamples = 0
let totalAnalogies = 0
let totalTheorems = 0
let totalSteps = 0
let totalImportant = 0
let totalDetail = 0
let totalDetailMin = Infinity
let totalDetailMax = 0

for (const dirName of bookDirs.sort()) {
  const dir = path.join(booksDir, dirName)
  const bookFile = path.join(dir, 'book.json')
  const book = await readJson(bookFile)
  if (!book) continue
  validateBook(bookFile, book)
  if (book.id && book.id !== dirName) err(bookFile, `book.id "${book.id}" 与目录名 "${dirName}" 不一致`)
  const chaptersDir = path.join(dir, 'chapters')
  let chapterFiles = []
  try {
    chapterFiles = (await readdir(chaptersDir)).filter((f) => f.endsWith('.json')).sort()
  } catch { err(bookFile, '缺少 chapters/ 目录') }
  if (chapterFiles.length !== 12) err(bookFile, `chapters/ 下应有 12 个章文件，实际 ${chapterFiles.length}`)

  const chapterResults = new Map()
  for (const f of chapterFiles) {
    const file = path.join(chaptersDir, f)
    const ch = await readJson(file)
    if (!ch) continue
    const res = validateChapter(file, ch)
    if (res) chapterResults.set(f.replace(/\.json$/, ''), res)
    const meta = (book.chapters || []).find((c) => c?.id === ch.id)
    if (!meta) err(file, `book.json 中缺少章 ${ch.id}`)
    else {
      for (const k of ['number', 'title', 'solves', 'gain', 'remainingGap', 'analogy']) {
        if (JSON.stringify(meta[k]) !== JSON.stringify(ch[k])) err(file, `章级字段 ${k} 与 book.json 不一致`)
      }
      const metaSecs = new Map((meta.sections || []).map((s) => [s?.id, s]))
      for (const s of (ch.sections || [])) {
        const ms = metaSecs.get(s?.id)
        if (!ms) { err(file, `book.json 中缺少节 ${s?.id}`); continue }
        if (ms.title !== s.title) err(file, `节 ${s.id} title 与 book.json 不一致`)
        if (ms.subProblem !== s.subProblem) err(file, `节 ${s.id} subProblem 与 book.json 不一致`)
        if (ms.pointCount !== (s.points || []).length) err(file, `节 ${s.id} pointCount=${ms.pointCount} 与实际 ${(s.points || []).length} 不一致`)
      }
      for (const id of metaSecs.keys()) if (!(ch.sections || []).some((s) => s?.id === id)) err(file, `章文件缺少节 ${id}`)
    }
  }
  let sections = 0
  let points = 0
  let examples = 0
  let analogies = 0
  let important = 0
  let detailTotal = 0
  let detailMin = Infinity
  let detailMax = 0
  let theorems = 0
  let steps = 0
  for (const r of chapterResults.values()) {
    sections += r.sections
    points += r.points
    examples += r.examples
    analogies += r.analogies
    important += r.important || 0
    detailTotal += r.detailTotal || 0
    theorems += r.theorems || 0
    steps += r.steps || 0
    if (r.detailMin) detailMin = Math.min(detailMin, r.detailMin)
    detailMax = Math.max(detailMax, r.detailMax || 0)
  }
  totalChapters += chapterResults.size
  totalSections += sections
  totalPoints += points
  totalExamples += examples
  totalAnalogies += analogies
  totalTheorems += theorems
  totalSteps += steps
  totalImportant += important
  totalDetail += detailTotal
  if (Number.isFinite(detailMin)) totalDetailMin = Math.min(totalDetailMin, detailMin)
  totalDetailMax = Math.max(totalDetailMax, detailMax)
  const bookRatio = important / Math.max(points, 1)
  if (points > 0 && (bookRatio < 0.30 || bookRatio > 0.55)) {
    warn(bookFile, `重点比例 ${(bookRatio * 100).toFixed(1)}% 不在 30%-55% 区间（每节≥1 重点优先，高数等 2 点/节的书为 50% 属正常）`)
  }
  const expected = { chapters: 12, sections, points }
  if (isObj(book.stats)) {
    for (const k of Object.keys(expected)) {
      if (book.stats[k] !== expected[k]) warn(bookFile, `stats.${k}=${book.stats[k]} 与实际 ${expected[k]} 不一致`)
    }
  }
  if (fixStats) {
    book.stats = expected
    await writeFile(bookFile, JSON.stringify(book, null, 2) + '\n', 'utf8')
    console.log(`已重算 ${bookFile} stats:`, expected)
  }
}

const detailAvg = Math.round(totalDetail / Math.max(totalPoints, 1))
const importantRatio = ((totalImportant / Math.max(totalPoints, 1)) * 100).toFixed(1)
console.log(`\n扫描教材 ${bookDirs.length} 本：章 ${totalChapters}，节 ${totalSections}，知识点 ${totalPoints}，例题 ${totalExamples}（平均 ${(totalExamples / Math.max(totalSections, 1)).toFixed(1)} 道/节），知识点生活类比 ${totalAnalogies}`)
console.log(`v1.2 学习型内容：重点知识点 ${totalImportant}（${importantRatio}%），详解平均 ${detailAvg} 字（${Number.isFinite(totalDetailMin) ? totalDetailMin : 0}-${totalDetailMax}），学习要点/推导/易错/考点字段已校验`)
console.log(`v1.3 定理与汇总：结构化定理 ${totalTheorems} 条，推导步骤 ${totalSteps} 步，每节 digest 六段已校验`)
if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 条：`)
  for (const w of warnings.slice(0, 30)) console.log('  - ' + w)
  if (warnings.length > 30) console.log(`  ... 其余 ${warnings.length - 30} 条省略`)
}
if (errors.length) {
  console.error(`\n✗ 错误 ${errors.length} 条：`)
  for (const e of errors.slice(0, 80)) console.error('  - ' + e)
  if (errors.length > 80) console.error(`  ... 其余 ${errors.length - 80} 条省略`)
  process.exit(1)
}
console.log('\n✓ 数据校验通过')