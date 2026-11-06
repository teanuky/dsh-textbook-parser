/**
 * textbook-parser · Host 存储层
 *
 * 职责：
 * - 解析数据目录：用户目录 <DSH_HOME>/textbook-parser，内置示例 <pkg>/data
 * - 合并读取：用户书覆盖同 id 内置书；写入永远写用户目录
 * - 校验 book.json / chapters/chNN.json（字段、id 格式、唯一性、pointCount 一致性）
 * - v1.1 向后兼容校验：overview/章/节/知识点 analogy、节 summary、节 examples 等新字段
 *   存在时校验类型与形状，缺失时保持旧数据兼容；未知字段原样保留、normalize 不删除
 * - v1.2 向后兼容校验：知识点 important / detail / keyPoints / derivation / mistakes / examTips
 *   （存在时校验；detail 过短只给 warnings 提示，不阻断保存）
 * - 原子写（临时文件 + rename），UTF-8、2 空格缩进、无 BOM
 *
 * 只使用 node: 内置模块，不依赖外部包、不联网、不写 profile / 宿主安装目录。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** 插件包根目录（本文件位于 <pkg>/host/store.js）。 */
export const PKG_DIR = path.resolve(HERE, '..')
/** 用户数据目录名（挂在 DSH_HOME 下）。 */
export const USER_ROOT_NAME = 'textbook-parser'

export const BOOK_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const CHAPTER_ID_RE = /^ch\d{2}$/
export const SECTION_ID_RE = /^\d+(?:\.\d+)+$/
export const POINT_ID_RE = /^\d+(?:\.\d+)+$/

export const BOOK_JSON_INDENT = 2

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')
const isMissingError = (error) => Boolean(error && (error.code === 'ENOENT' || error.code === 'ENOTDIR'))

function describeValue(value) {
  if (value === undefined) return '缺失'
  if (value === null) return 'null'
  if (typeof value === 'string') {
    const shown = value.length > 60 ? `${value.slice(0, 60)}…` : value
    return `"${shown}"`
  }
  if (Array.isArray(value)) return `数组(${value.length} 项)`
  if (typeof value === 'object') return '对象'
  return String(value)
}

function cloneJson(value, label) {
  if (!isPlainObject(value)) {
    throw validationError(`${label} 必须是 JSON 对象`, [`${label} 必须是 JSON 对象（当前：${describeValue(value)}）`])
  }
  try {
    return structuredClone(value)
  } catch (error) {
    throw validationError(`${label} 无法序列化为 JSON`, [`${label} 包含不可序列化的值：${error.message}`])
  }
}

// ---------------------------------------------------------------------------
// 错误辅助
// ---------------------------------------------------------------------------

/**
 * 构造带 `errors` 数组的校验错误；message 里逐条列出，模型可直接照做修正。
 * @param {string} summary
 * @param {string[]} errors
 */
export function validationError(summary, errors) {
  const list = Array.isArray(errors) ? errors.filter((item) => nonEmptyString(item)) : []
  const message = list.length > 0 ? `${summary}（${list.length} 处）：\n- ${list.join('\n- ')}` : summary
  const error = new Error(message)
  error.code = 'TBP_VALIDATION'
  error.errors = list
  return error
}

// ---------------------------------------------------------------------------
// 目录解析
// ---------------------------------------------------------------------------

/**
 * 解析数据目录。
 * - userRoot = config.dataDir（可覆盖）或 <DSH_HOME>/textbook-parser
 * - bundledRoot = config.bundledDir（测试可覆盖）或 <pkg>/data
 * @param {Record<string, unknown>} [config]
 */
export function resolveDirs(config = {}) {
  const cfg = isPlainObject(config) ? config : {}
  if (cfg.dataDir !== undefined && cfg.dataDir !== null && typeof cfg.dataDir !== 'string') {
    throw new TypeError('config.dataDir 必须是字符串路径（或省略以使用 <DSH_HOME>/textbook-parser）')
  }
  if (cfg.bundledDir !== undefined && cfg.bundledDir !== null && typeof cfg.bundledDir !== 'string') {
    throw new TypeError('config.bundledDir 必须是字符串路径')
  }
  const envHome = typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME.trim() : ''
  const home = envHome || path.join(os.homedir(), '.dsh')
  const userRoot = nonEmptyString(cfg.dataDir) ? path.resolve(cfg.dataDir) : path.join(home, USER_ROOT_NAME)
  const bundledRoot = nonEmptyString(cfg.bundledDir) ? path.resolve(cfg.bundledDir) : path.join(PKG_DIR, 'data')
  return {
    home,
    userRoot,
    bundledRoot,
    userBooksDir: path.join(userRoot, 'books'),
    bundledBooksDir: path.join(bundledRoot, 'books'),
  }
}

const isValidBookId = (value) => typeof value === 'string' && BOOK_ID_RE.test(value) && value.length <= 80

// ---------------------------------------------------------------------------
// 文件读写辅助
// ---------------------------------------------------------------------------

async function readDirSafe(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (isMissingError(error)) return []
    throw error
  }
}

async function statSafe(target) {
  try {
    return await fs.stat(target)
  } catch (error) {
    if (isMissingError(error)) return null
    throw error
  }
}

/** 读取 JSON 文件：文件不存在返回 null；解析失败抛出带文件名的错误。 */
async function readJsonFile(file) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (error) {
    if (isMissingError(error)) return null
    throw error
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`JSON 解析失败（${file}）：${error.message}`)
  }
}

/** 原子写 JSON：先写同目录临时文件，再 rename 替换，避免读到半个文件。 */
async function writeJsonAtomic(file, value) {
  const dir = path.dirname(file)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}.tmp`)
  const text = `${JSON.stringify(value, null, BOOK_JSON_INDENT)}\n`
  await fs.writeFile(tmp, text, 'utf8')
  try {
    await fs.rename(tmp, file)
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * 在某个 books 根下定位一本书的目录：先按目录名精确匹配，再回退为扫描
 * book.json 的 id（容忍目录名与 book.id 不一致的历史数据）。
 */
async function findBookDir(booksRoot, bookId) {
  if (!isValidBookId(bookId)) return null
  const direct = path.join(booksRoot, bookId)
  const stat = await statSafe(direct)
  if (stat && stat.isDirectory()) return direct
  for (const entry of await readDirSafe(booksRoot)) {
    if (!entry.isDirectory() || entry.name === bookId) continue
    const candidate = path.join(booksRoot, entry.name)
    try {
      const book = await readJsonFile(path.join(candidate, 'book.json'))
      if (isPlainObject(book) && book.id === bookId) return candidate
    } catch {
      // 损坏的 book.json 已在 listBooks 报警；这里静默跳过，避免挡住按 id 的精确读取
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 统计
// ---------------------------------------------------------------------------

/** 从章对象统计节数 / 知识点数。 */
function summarizeChapterStats(chapter) {
  const sections = isPlainObject(chapter) && Array.isArray(chapter.sections) ? chapter.sections : []
  let points = 0
  for (const section of sections) {
    if (isPlainObject(section) && Array.isArray(section.points)) points += section.points.length
  }
  return { sections: sections.length, points }
}

/** 按 book.json 的章/节骨架估算统计（章文件尚未写入时使用）。 */
function computeEstimatedStats(book) {
  const chapters = isPlainObject(book) && Array.isArray(book.chapters) ? book.chapters : []
  let sections = 0
  let points = 0
  for (const chapter of chapters) {
    if (!isPlainObject(chapter)) continue
    const chapterSections = Array.isArray(chapter.sections) ? chapter.sections : []
    sections += chapterSections.length
    for (const section of chapterSections) {
      if (isPlainObject(section) && Number.isInteger(section.pointCount) && section.pointCount > 0) points += section.pointCount
    }
  }
  return { chapters: chapters.length, sections, points }
}

/** 统计归一化：优先保留 book.json 的估算值，缺失的字段才用骨架估算补齐。 */
function normalizeStats(book) {
  const estimate = computeEstimatedStats(book)
  const raw = isPlainObject(book) && isPlainObject(book.stats) ? book.stats : {}
  const pick = (value, fallback) => (Number.isInteger(value) && value >= 0 ? value : fallback)
  return {
    chapters: pick(raw.chapters, estimate.chapters),
    sections: pick(raw.sections, estimate.sections),
    points: pick(raw.points, estimate.points),
  }
}

/** 已读到的章文件 + 未写入章的骨架估算，算出全书统计。 */
function computeStatsFromChapterMap(book, chapterMap) {
  const chapters = isPlainObject(book) && Array.isArray(book.chapters) ? book.chapters : []
  let sections = 0
  let points = 0
  for (const chapter of chapters) {
    if (!isPlainObject(chapter)) continue
    const file = chapterMap instanceof Map ? chapterMap.get(chapter.id) : undefined
    if (isPlainObject(file)) {
      const chapterStats = summarizeChapterStats(file)
      sections += chapterStats.sections
      points += chapterStats.points
      continue
    }
    const chapterSections = Array.isArray(chapter.sections) ? chapter.sections : []
    sections += chapterSections.length
    for (const section of chapterSections) {
      if (isPlainObject(section) && Number.isInteger(section.pointCount) && section.pointCount > 0) points += section.pointCount
    }
  }
  return { chapters: chapters.length, sections, points }
}

// ---------------------------------------------------------------------------
// 校验：book.json
// ---------------------------------------------------------------------------

function pushNonEmptyString(errors, value, label) {
  if (!nonEmptyString(value)) errors.push(`${label} 必须是非空字符串（当前：${describeValue(value)}）`)
}

function pushOptionalString(errors, value, label) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    errors.push(`${label} 必须是字符串（可为空字符串）（当前：${describeValue(value)}）`)
  }
}

/** v1.1 新增字段用：不存在（undefined）保持兼容；存在就必须是非空字符串。 */
function pushOptionalNonEmptyString(errors, value, label) {
  if (value === undefined) return
  if (!nonEmptyString(value)) {
    errors.push(`${label} 必须是非空字符串（当前：${describeValue(value)}）`)
  }
}

/** v1.2 新增字段用：不存在（undefined）保持兼容；存在就必须是布尔值 true/false。 */
function pushOptionalBoolean(errors, value, label) {
  if (value === undefined) return
  if (typeof value !== 'boolean') {
    errors.push(`${label} 必须是布尔值 true / false（当前：${describeValue(value)}）`)
  }
}

/** v1.2 新增字段用：不存在（undefined）保持兼容；存在就必须是字符串（可为空字符串）。 */
function pushOptionalStringStrict(errors, value, label) {
  if (value === undefined) return
  if (typeof value !== 'string') {
    errors.push(`${label} 必须是字符串（可为空字符串）（当前：${describeValue(value)}）`)
  }
}

function pushStringArray(errors, value, label, { required = true } = {}) {
  if (value === undefined && !required) return
  if (!Array.isArray(value)) {
    errors.push(`${label} 必须是字符串数组（当前：${describeValue(value)}）`)
    return
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string') errors.push(`${label}[${index}] 必须是字符串（当前：${describeValue(item)}）`)
    else if (!item.trim()) errors.push(`${label}[${index}] 不能是空字符串`)
  })
}

function pushChain(errors, chain, label, minItems, itemFields = ['from', 'to', 'label']) {
  if (!Array.isArray(chain)) {
    errors.push(`${label} 必须是数组（至少 ${minItems} 项，用于串联「缺陷 → 修复 → 新缺陷」）`)
    return
  }
  if (chain.length < minItems) {
    errors.push(`${label} 至少需要 ${minItems} 项（当前 ${chain.length} 项）；请改为「上一方案缺陷 → 修复方案 → 新缺陷」的链条`)
  }
  chain.forEach((item, index) => {
    if (!isPlainObject(item)) {
      errors.push(`${label}[${index}] 必须是对象`)
      return
    }
    for (const key of itemFields) pushNonEmptyString(errors, item[key], `${label}[${index}].${key}`)
  })
}

/**
 * 校验 book.json。
 * @param {unknown} input
 * @param {{ chapterFiles?: Map<string, unknown> }} [options] chapterFiles：已存在的章文件
 *   （Map<章id, 章对象>），用于检查 pointCount 与 chapter 文件一致、章号一致等跨文件约束。
 * @returns {{ok: true, errors: []} | {ok: false, errors: string[]}}
 */
export function validateBook(input, options = {}) {
  const errors = []
  if (!isPlainObject(input)) return { ok: false, errors: ['book 必须是 JSON 对象'] }
  const book = input
  const opts = isPlainObject(options) ? options : {}

  if (book.schemaVersion !== undefined && book.schemaVersion !== 1) {
    errors.push(`schemaVersion 必须为 1（当前：${describeValue(book.schemaVersion)}）`)
  }
  if (!isValidBookId(book.id)) {
    errors.push(`id 必须是 kebab-case 字符串（小写字母/数字/连字符，如 signals-systems-zheng），当前：${describeValue(book.id)}`)
  }
  pushNonEmptyString(errors, book.title, 'title')
  pushOptionalString(errors, book.subtitle, 'subtitle')
  pushNonEmptyString(errors, book.subject, 'subject')
  pushStringArray(errors, book.tags, 'tags')
  pushOptionalString(errors, book.updatedAt, 'updatedAt')

  const overview = book.overview
  if (!isPlainObject(overview)) {
    errors.push('overview 必须是对象，包含 goal / pain / mainline / chain')
  } else {
    pushNonEmptyString(errors, overview.goal, 'overview.goal')
    pushNonEmptyString(errors, overview.pain, 'overview.pain')
    pushNonEmptyString(errors, overview.mainline, 'overview.mainline')
    pushChain(errors, overview.chain, 'overview.chain', 1, ['step', 'detail', 'defect'])
    // v1.1：用生活类比讲全书主线/意义（可选扩展；存在时必须非空）
    pushOptionalNonEmptyString(errors, overview.analogy, 'overview.analogy')
  }

  const chapters = book.chapters
  const chapterNumberSeen = new Set()
  const chapterIdSeen = new Set()
  if (!Array.isArray(chapters)) {
    errors.push('chapters 必须是数组（至少 1 章）')
  } else {
    if (chapters.length === 0) errors.push('chapters 至少需要 1 章')
    chapters.forEach((chapter, index) => {
      const label = `chapters[${index}]`
      if (!isPlainObject(chapter)) {
        errors.push(`${label} 必须是对象`)
        return
      }
      if (!CHAPTER_ID_RE.test(String(chapter.id || ''))) {
        errors.push(`${label}.id 必须形如 ch01 / ch02（两位数字），当前：${describeValue(chapter.id)}`)
      } else {
        if (chapterIdSeen.has(chapter.id)) errors.push(`${label}.id 重复：${chapter.id}（全书章 id 必须唯一）`)
        chapterIdSeen.add(chapter.id)
        const expectedNumber = Number.parseInt(chapter.id.slice(2), 10)
        if (chapter.number !== expectedNumber) {
          errors.push(`${label}.number 应为 ${expectedNumber}（与 id ${chapter.id} 对应），当前：${describeValue(chapter.number)}`)
        }
      }
      if (!Number.isInteger(chapter.number) || chapter.number < 1) {
        errors.push(`${label}.number 必须是大于 0 的整数（当前：${describeValue(chapter.number)}）`)
      } else {
        if (chapterNumberSeen.has(chapter.number)) errors.push(`${label}.number 重复：${chapter.number}`)
        chapterNumberSeen.add(chapter.number)
      }
      pushNonEmptyString(errors, chapter.title, `${label}.title`)
      pushNonEmptyString(errors, chapter.solves, `${label}.solves`)
      pushNonEmptyString(errors, chapter.gain, `${label}.gain`)
      pushNonEmptyString(errors, chapter.remainingGap, `${label}.remainingGap`)
      // v1.1：本章的生活类比（可选扩展；存在时必须非空）
      pushOptionalNonEmptyString(errors, chapter.analogy, `${label}.analogy`)
      pushStringArray(errors, chapter.requires, `${label}.requires`)
      if (!Array.isArray(chapter.sections)) {
        errors.push(`${label}.sections 必须是数组（可为空，写章文件后会自动补齐）`)
      } else {
        const sectionIds = new Set()
        chapter.sections.forEach((section, sectionIndex) => {
          const sectionLabel = `${label}.sections[${sectionIndex}]`
          if (!isPlainObject(section)) {
            errors.push(`${sectionLabel} 必须是对象`)
            return
          }
          if (!SECTION_ID_RE.test(String(section.id || ''))) {
            errors.push(`${sectionLabel}.id 必须是教材节号字符串，如 "2.3"（当前：${describeValue(section.id)}）`)
          } else if (sectionIds.has(section.id)) {
            errors.push(`${sectionLabel}.id 重复：${section.id}（同一章内节 id 必须唯一）`)
          } else {
            sectionIds.add(section.id)
          }
          pushNonEmptyString(errors, section.title, `${sectionLabel}.title`)
          pushNonEmptyString(errors, section.subProblem, `${sectionLabel}.subProblem`)
          if (!Number.isInteger(section.pointCount) || section.pointCount < 0) {
            errors.push(`${sectionLabel}.pointCount 必须是非负整数（当前：${describeValue(section.pointCount)}）`)
          }
        })
      }
    })
  }

  if (!isPlainObject(book.stats)) {
    errors.push('stats 必须是对象，包含 chapters / sections / points 三个整数')
  } else {
    for (const key of ['chapters', 'sections', 'points']) {
      if (!Number.isInteger(book.stats[key]) || book.stats[key] < 0) {
        errors.push(`stats.${key} 必须是非负整数（当前：${describeValue(book.stats[key])}）`)
      }
    }
  }

  // 跨文件一致性：book.json 的节 pointCount / 章号 必须与已存在的 chapter 文件一致。
  const chapterFiles = opts.chapterFiles instanceof Map ? opts.chapterFiles : null
  if (chapterFiles && chapterFiles.size > 0 && Array.isArray(chapters)) {
    chapters.forEach((chapter, index) => {
      if (!isPlainObject(chapter)) return
      const file = chapterFiles.get(chapter.id)
      if (!isPlainObject(file)) return
      if (file.number !== chapter.number) {
        errors.push(`章 ${chapter.id}：book.json 的 number=${describeValue(chapter.number)} 与 chapters/${chapter.id}.json 的 number=${describeValue(file.number)} 不一致`)
      }
      const fileSections = Array.isArray(file.sections) ? file.sections : []
      const bookSectionIds = new Set(
        (Array.isArray(chapter.sections) ? chapter.sections : []).filter(isPlainObject).map((section) => section.id),
      )
      fileSections.forEach((section) => {
        if (!isPlainObject(section) || !nonEmptyString(section.id)) return
        const actualCount = Array.isArray(section.points) ? section.points.length : 0
        if (!bookSectionIds.has(section.id)) {
          errors.push(`章 ${chapter.id}：chapters/${chapter.id}.json 的节 ${section.id} 未出现在 book.json 的 chapters[${index}].sections 中（两边的节必须一致）`)
          return
        }
        const bookSection = chapter.sections.find((item) => isPlainObject(item) && item.id === section.id)
        if (bookSection && bookSection.pointCount !== actualCount) {
          errors.push(`章 ${chapter.id}：book.json 的节 ${section.id} 写 pointCount=${describeValue(bookSection.pointCount)}，但 chapters/${chapter.id}.json 实际有 ${actualCount} 个知识点（必须一致）`)
        }
      })
    })
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] }
}

// ---------------------------------------------------------------------------
// 校验：chapters/chNN.json
// ---------------------------------------------------------------------------

function validateExample(example, label, errors) {
  if (!isPlainObject(example)) {
    errors.push(`${label} 必须是对象，包含 question 与 answer`)
    return
  }
  pushNonEmptyString(errors, example.question, `${label}.question`)
  pushNonEmptyString(errors, example.answer, `${label}.answer`)
}

function validatePoint(point, label, errors, seenPointIds, warnings = []) {
  if (!isPlainObject(point)) {
    errors.push(`${label} 必须是对象`)
    return
  }
  if (!nonEmptyString(point.id)) {
    errors.push(`${label}.id 不能为空（格式：章.节.序号，如 1.1.1）`)
  } else if (!POINT_ID_RE.test(point.id)) {
    errors.push(`${label}.id "${point.id}" 格式应为「章.节.序号」，例如 1.1.1`)
  } else if (seenPointIds.has(point.id)) {
    errors.push(`${label}.id "${point.id}" 在本章内重复（知识点 id 必须唯一）`)
  } else {
    seenPointIds.add(point.id)
  }
  pushNonEmptyString(errors, point.title, `${label}.title`)
  pushNonEmptyString(errors, point.solves, `${label}.solves`)
  pushNonEmptyString(errors, point.meaning, `${label}.meaning`)
  pushNonEmptyString(errors, point.application, `${label}.application`)
  pushOptionalString(errors, point.formula, `${label}.formula`)
  pushOptionalString(errors, point.limitation, `${label}.limitation`)
  pushOptionalString(errors, point.next, `${label}.next`)
  // v1.1：知识点的生活类比（可选扩展；存在时必须非空，2-4 句并映射回技术概念由 skill 要求）
  pushOptionalNonEmptyString(errors, point.analogy, `${label}.analogy`)
  // v1.2：重点星标 + 可自学详解（均为“存在时校验”，旧数据缺字段保持兼容；新拆解由 skill 要求写全）
  pushOptionalBoolean(errors, point.important, `${label}.important`)
  if (point.detail !== undefined) {
    if (typeof point.detail !== 'string') {
      errors.push(`${label}.detail 必须是字符串（当前：${describeValue(point.detail)}）`)
    } else if (!point.detail.trim()) {
      errors.push(`${label}.detail 不能是空字符串（应写 350-800 字可自学详解）`)
    } else if (point.detail.trim().length < 50) {
      // 只告警不硬卡：太短不利自学，但旧/简版数据仍可保存。
      warnings.push(`${label}.detail 只有 ${point.detail.trim().length} 字，建议 ≥50 字（完整要求 350-800 字，便于直接自学）`)
    }
  }
  if (point.keyPoints !== undefined) {
    if (!Array.isArray(point.keyPoints)) {
      errors.push(`${label}.keyPoints 必须是字符串数组（建议 3-6 条，每项 20-60 字）（当前：${describeValue(point.keyPoints)}）`)
    } else {
      if (point.keyPoints.length < 1 || point.keyPoints.length > 10) {
        errors.push(`${label}.keyPoints 需要 1-10 项（建议 3-6 项），当前 ${point.keyPoints.length} 项`)
      }
      point.keyPoints.forEach((item, index) => {
        if (typeof item !== 'string') errors.push(`${label}.keyPoints[${index}] 必须是字符串（当前：${describeValue(item)}）`)
        else if (!item.trim()) errors.push(`${label}.keyPoints[${index}] 不能是空字符串`)
      })
    }
  }
  pushOptionalStringStrict(errors, point.derivation, `${label}.derivation`)
  pushOptionalStringStrict(errors, point.mistakes, `${label}.mistakes`)
  pushOptionalStringStrict(errors, point.examTips, `${label}.examTips`)
  pushStringArray(errors, point.prerequisites, `${label}.prerequisites`)
  validateExample(point.example, `${label}.example`, errors)
}

/**
 * v1.1：校验“本节典型例题”数组。
 * 向后兼容：examples 不存在时跳过；存在时至少 1 道，逐项校验 type/question/answer，
 * id 若提供则同一节内唯一；source / note 若提供必须是字符串。
 */
function validateSectionExamples(examples, label, errors) {
  if (examples === undefined) return
  if (!Array.isArray(examples)) {
    errors.push(`${label} 必须是数组，每项含 type/question/answer（当前：${describeValue(examples)}）`)
    return
  }
  if (examples.length === 0) {
    errors.push(`${label} 至少需要 1 道例题（建议 4-6 道，覆盖概念判断/计算/推导证明/综合应用/易错辨析等题型）`)
    return
  }
  const seenIds = new Set()
  examples.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`
    if (!isPlainObject(item)) {
      errors.push(`${itemLabel} 必须是对象，含 type/question/answer`)
      return
    }
    if (item.id !== undefined) {
      if (!nonEmptyString(item.id)) {
        errors.push(`${itemLabel}.id 若提供必须是非空字符串（当前：${describeValue(item.id)}）`)
      } else if (seenIds.has(item.id)) {
        errors.push(`${itemLabel}.id "${item.id}" 在本节例题中重复（同一节内例题 id 必须唯一）`)
      } else {
        seenIds.add(item.id)
      }
    }
    pushNonEmptyString(errors, item.type, `${itemLabel}.type`)
    pushNonEmptyString(errors, item.question, `${itemLabel}.question`)
    pushNonEmptyString(errors, item.answer, `${itemLabel}.answer`)
    pushOptionalString(errors, item.source, `${itemLabel}.source`)
    pushOptionalString(errors, item.note, `${itemLabel}.note`)
  })
}

/**
 * 校验 chapters/chNN.json。
 * @param {unknown} input
 * @param {{ book?: Record<string, unknown> }} [options] book：book.json，用于校验章 id / number 与全书骨架一致。
 */
export function validateChapter(input, options = {}) {
  const errors = []
  const warnings = []
  if (!isPlainObject(input)) return { ok: false, errors: ['chapter 必须是 JSON 对象'], warnings }
  const chapter = input
  const opts = isPlainObject(options) ? options : {}

  if (!CHAPTER_ID_RE.test(String(chapter.id || ''))) {
    errors.push(`id 必须形如 ch01 / ch02（两位数字），当前：${describeValue(chapter.id)}`)
  }
  if (!Number.isInteger(chapter.number) || chapter.number < 1) {
    errors.push(`number 必须是大于 0 的整数（当前：${describeValue(chapter.number)}）`)
  } else if (CHAPTER_ID_RE.test(String(chapter.id || '')) && chapter.number !== Number.parseInt(chapter.id.slice(2), 10)) {
    errors.push(`number=${chapter.number} 与 id=${chapter.id} 不对应（应相等）`)
  }
  pushNonEmptyString(errors, chapter.title, 'title')
  pushNonEmptyString(errors, chapter.solves, 'solves')
  pushNonEmptyString(errors, chapter.gain, 'gain')
  pushNonEmptyString(errors, chapter.remainingGap, 'remainingGap')
  // v1.1：章级生活类比（与 book.json 本章 analogy 保持一致；可选扩展，存在时必须非空）
  pushOptionalNonEmptyString(errors, chapter.analogy, 'analogy')
  pushStringArray(errors, chapter.requires, 'requires')
  pushChain(errors, chapter.chain, 'chain', 2)

  const sections = chapter.sections
  const sectionIds = new Set()
  const pointIds = new Set()
  if (!Array.isArray(sections)) {
    errors.push('sections 必须是数组（至少 1 节）')
  } else {
    if (sections.length === 0) errors.push('sections 至少需要 1 节')
    sections.forEach((section, index) => {
      const label = `sections[${index}]`
      if (!isPlainObject(section)) {
        errors.push(`${label} 必须是对象`)
        return
      }
      if (!SECTION_ID_RE.test(String(section.id || ''))) {
        errors.push(`${label}.id 必须是教材节号字符串，如 "2.3"（当前：${describeValue(section.id)}）`)
      } else if (sectionIds.has(section.id)) {
        errors.push(`${label}.id 重复：${section.id}（同一章内节 id 必须唯一）`)
      } else {
        sectionIds.add(section.id)
      }
      pushNonEmptyString(errors, section.title, `${label}.title`)
      pushNonEmptyString(errors, section.subProblem, `${label}.subProblem`)
      pushStringArray(errors, section.requires, `${label}.requires`)
      pushOptionalString(errors, section.remaining, `${label}.remaining`)
      // v1.1：本节知识点汇总 / 生活类比 / 多题型例题（可选扩展；存在时校验类型与形状）
      pushOptionalNonEmptyString(errors, section.summary, `${label}.summary`)
      pushOptionalNonEmptyString(errors, section.analogy, `${label}.analogy`)
      validateSectionExamples(section.examples, `${label}.examples`, errors)
      const points = section.points
      if (!Array.isArray(points)) {
        errors.push(`${label}.points 必须是数组（至少 1 个知识点）`)
        return
      }
      if (points.length === 0) errors.push(`${label}.points 至少需要 1 个知识点`)
      points.forEach((point, pointIndex) =>
        validatePoint(point, `${label}.points[${pointIndex}]`, errors, pointIds, warnings),
      )
    })
  }

  const book = isPlainObject(opts.book) ? opts.book : null
  if (book && Array.isArray(book.chapters)) {
    const bookChapter = book.chapters.find((item) => isPlainObject(item) && item.id === chapter.id)
    if (!bookChapter) {
      errors.push(`book.json 中没有 id=${describeValue(chapter.id)} 的章；请先调用 textbook_archive(action="save_book") 写入全书章骨架，或检查章 id 是否正确`)
    } else if (Number.isInteger(bookChapter.number) && bookChapter.number !== chapter.number) {
      errors.push(`本章 number=${chapter.number} 与 book.json 中该章的 number=${bookChapter.number} 不一致（两边必须一致）`)
    }
  }

  return errors.length > 0 ? { ok: false, errors, warnings } : { ok: true, errors: [], warnings }
}

// ---------------------------------------------------------------------------
// 归一化（补可选字段默认值，写盘前保证 schema 完整）
// ---------------------------------------------------------------------------

function normalizeChapter(chapter) {
  if (!isPlainObject(chapter)) return chapter
  if (!Array.isArray(chapter.requires)) chapter.requires = []
  if (!Array.isArray(chapter.chain)) chapter.chain = []
  if (!Array.isArray(chapter.sections)) chapter.sections = []
  for (const section of chapter.sections) {
    if (!isPlainObject(section)) continue
    if (!Array.isArray(section.requires)) section.requires = []
    if (typeof section.remaining !== 'string') section.remaining = ''
    if (!Array.isArray(section.points)) section.points = []
    for (const point of section.points) {
      if (!isPlainObject(point)) continue
      if (!Array.isArray(point.prerequisites)) point.prerequisites = []
      for (const key of ['formula', 'limitation', 'next']) {
        if (typeof point[key] !== 'string') point[key] = ''
      }
    }
  }
  return chapter
}

function normalizeBook(book) {
  if (!isPlainObject(book)) return book
  if (book.schemaVersion === undefined) book.schemaVersion = 1
  if (book.subtitle === undefined) book.subtitle = ''
  if (book.tags === undefined) book.tags = []
  if (book.overview !== undefined && isPlainObject(book.overview) && book.overview.chain === undefined) {
    book.overview.chain = []
  }
  if (Array.isArray(book.chapters)) {
    for (const chapter of book.chapters) {
      if (!isPlainObject(chapter)) continue
      if (!Array.isArray(chapter.requires)) chapter.requires = []
      if (!Array.isArray(chapter.sections)) chapter.sections = []
      for (const section of chapter.sections) {
        if (!isPlainObject(section)) continue
        if (section.pointCount === undefined) section.pointCount = 0
      }
    }
  }
  if (!isPlainObject(book.stats)) book.stats = computeEstimatedStats(book)
  if (typeof book.updatedAt !== 'string' || !book.updatedAt) book.updatedAt = new Date().toISOString()
  return book
}

// ---------------------------------------------------------------------------
// 合并读取
// ---------------------------------------------------------------------------

function summarizeBook(book, fallbackId, source) {
  return {
    id: nonEmptyString(book.id) && isValidBookId(book.id) ? book.id : fallbackId,
    title: nonEmptyString(book.title) ? book.title : fallbackId,
    subtitle: typeof book.subtitle === 'string' ? book.subtitle : '',
    subject: typeof book.subject === 'string' ? book.subject : '',
    tags: isStringArray(book.tags) ? [...book.tags] : [],
    updatedAt: typeof book.updatedAt === 'string' ? book.updatedAt : '',
    stats: normalizeStats(book),
    source,
  }
}

async function listBooksFromRoot(booksRoot, source, merged) {
  for (const entry of await readDirSafe(booksRoot)) {
    if (!entry.isDirectory()) continue
    const bookFile = path.join(booksRoot, entry.name, 'book.json')
    try {
      const book = await readJsonFile(bookFile)
      if (!isPlainObject(book)) {
        console.error(`[textbook-parser] 跳过无法识别的 book.json：${bookFile}`)
        continue
      }
      const id = nonEmptyString(book.id) && isValidBookId(book.id) ? book.id : entry.name
      // 内置先合并，用户后合并 → 同 id 用户覆盖内置
      merged.set(id, summarizeBook(book, entry.name, source))
    } catch (error) {
      console.error(`[textbook-parser] 跳过损坏的 book.json：${bookFile}：${error.message}`)
    }
  }
}

async function listBooksImpl(dirs) {
  const merged = new Map()
  await listBooksFromRoot(dirs.bundledBooksDir, 'bundled', merged)
  await listBooksFromRoot(dirs.userBooksDir, 'user', merged)
  return [...merged.values()].sort((left, right) => String(left.title).localeCompare(String(right.title), 'zh-Hans-CN'))
}

async function getBookImpl(dirs, bookId) {
  if (!isValidBookId(bookId)) return null
  for (const [booksRoot, source] of [
    [dirs.userBooksDir, 'user'],
    [dirs.bundledBooksDir, 'bundled'],
  ]) {
    const dir = await findBookDir(booksRoot, bookId)
    if (!dir) continue
    const book = await readJsonFile(path.join(dir, 'book.json'))
    if (!isPlainObject(book)) continue
    return {
      ...book,
      id: nonEmptyString(book.id) ? book.id : bookId,
      stats: normalizeStats(book),
      source,
    }
  }
  return null
}

async function getChapterImpl(dirs, bookId, chapterId) {
  if (!isValidBookId(bookId) || typeof chapterId !== 'string' || !CHAPTER_ID_RE.test(chapterId)) return null
  const chapterName = `${chapterId}.json`
  for (const booksRoot of [dirs.userBooksDir, dirs.bundledBooksDir]) {
    const dir = await findBookDir(booksRoot, bookId)
    if (!dir) continue
    const chapter = await readJsonFile(path.join(dir, 'chapters', chapterName))
    if (isPlainObject(chapter)) return chapter
  }
  return null
}

// ---------------------------------------------------------------------------
// 写入
// ---------------------------------------------------------------------------

async function loadChapterFiles(dirs, bookId) {
  const chapterMap = new Map()
  if (!isValidBookId(bookId)) return chapterMap
  for (const booksRoot of [dirs.bundledBooksDir, dirs.userBooksDir]) {
    const dir = await findBookDir(booksRoot, bookId)
    if (!dir) continue
    const chaptersDir = path.join(dir, 'chapters')
    for (const entry of await readDirSafe(chaptersDir)) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const chapterId = entry.name.slice(0, -'.json'.length)
      if (!CHAPTER_ID_RE.test(chapterId)) continue
      const chapterFile = path.join(chaptersDir, entry.name)
      try {
        const chapter = await readJsonFile(chapterFile)
        if (isPlainObject(chapter)) chapterMap.set(chapterId, chapter)
        else console.error(`[textbook-parser] 跳过无法识别的章文件：${chapterFile}`)
      } catch (error) {
        console.error(`[textbook-parser] 跳过损坏的章文件：${chapterFile}：${error.message}`)
      }
    }
  }
  return chapterMap
}

async function saveBookImpl(dirs, input) {
  const book = normalizeBook(cloneJson(input, 'book'))
  const chapterFiles = await loadChapterFiles(dirs, book.id)
  const result = validateBook(book, { chapterFiles })
  if (!result.ok) throw validationError('book.json 校验未通过', result.errors)

  // 已有章文件时以实际内容重算 stats；否则保留估算值（随后 save_chapter 会继续修正）。
  if (chapterFiles.size > 0) book.stats = computeStatsFromChapterMap(book, chapterFiles)
  else book.stats = normalizeStats(book)
  book.updatedAt = new Date().toISOString()

  const dir = path.join(dirs.userBooksDir, book.id)
  const file = path.join(dir, 'book.json')
  await writeJsonAtomic(file, book)
  return { bookId: book.id, title: book.title, path: file, dir, stats: book.stats }
}

/** 把已保存章的实际节/知识点合并回 book.json 的章骨架，并重算 stats。 */
async function syncBookWithChapter(dirs, bookId, book, chapter) {
  const chapterMap = await loadChapterFiles(dirs, bookId)
  chapterMap.set(chapter.id, chapter)
  const stats = computeStatsFromChapterMap(book, chapterMap)

  const chapters = Array.isArray(book.chapters) ? book.chapters : []
  const chapterMeta = chapters.find((item) => isPlainObject(item) && item.id === chapter.id)
  if (chapterMeta) {
    if (!Array.isArray(chapterMeta.sections)) chapterMeta.sections = []
    const sectionById = new Map(chapterMeta.sections.filter(isPlainObject).map((section) => [section.id, section]))
    const chapterSections = Array.isArray(chapter.sections) ? chapter.sections : []
    for (const section of chapterSections) {
      if (!isPlainObject(section) || !nonEmptyString(section.id)) continue
      const pointCount = Array.isArray(section.points) ? section.points.length : 0
      const existing = sectionById.get(section.id)
      if (existing) {
        existing.pointCount = pointCount
        if (!nonEmptyString(existing.title) && nonEmptyString(section.title)) existing.title = section.title
        if (!nonEmptyString(existing.subProblem) && nonEmptyString(section.subProblem)) existing.subProblem = section.subProblem
        continue
      }
      const created = {
        id: section.id,
        title: nonEmptyString(section.title) ? section.title : section.id,
        subProblem: nonEmptyString(section.subProblem) ? section.subProblem : '',
        pointCount,
      }
      chapterMeta.sections.push(created)
      sectionById.set(section.id, created)
    }
  }

  book.stats = stats
  book.updatedAt = new Date().toISOString()
  return stats
}

async function saveChapterImpl(dirs, bookId, input) {
  if (!isValidBookId(bookId)) {
    throw validationError('bookId 不合法', [
      `bookId 必须是 kebab-case 字符串（小写字母/数字/连字符），当前：${describeValue(bookId)}`,
    ])
  }
  const chapter = normalizeChapter(cloneJson(input, 'chapter'))
  if (!CHAPTER_ID_RE.test(String(chapter.id || ''))) {
    throw validationError('chapter.id 不合法', [
      `chapter.id 必须形如 ch01 / ch02（两位数字），当前：${describeValue(chapter.id)}`,
    ])
  }

  const userBookFile = path.join(dirs.userBooksDir, bookId, 'book.json')
  let userBook = null
  try {
    userBook = await readJsonFile(userBookFile)
  } catch (error) {
    throw new Error(`无法读取已有 book.json（${userBookFile}）：${error.message}`)
  }
  const bundledDir = await findBookDir(dirs.bundledBooksDir, bookId)
  let bundledBook = null
  if (bundledDir) {
    try {
      bundledBook = await readJsonFile(path.join(bundledDir, 'book.json'))
    } catch (error) {
      throw new Error(`无法读取内置 book.json（${path.join(bundledDir, 'book.json')}）：${error.message}`)
    }
  }
  const bookForCheck = isPlainObject(userBook) ? userBook : isPlainObject(bundledBook) ? bundledBook : null
  if (!bookForCheck) {
    throw new Error(
      `未找到 bookId="${bookId}" 对应的 book.json；请先调用 textbook_archive(action="save_book", book={...}) 保存全书总纲与章骨架，再逐章保存。`,
    )
  }

  const result = validateChapter(chapter, { book: bookForCheck })
  if (!result.ok) {
    throw validationError(`第 ${chapter.id} 章数据校验未通过（chapters/${chapter.id}.json）`, result.errors)
  }
  // v1.2：detail 过短等只告警不阻断（建议修正后重存，不影响本次写入）。
  if (Array.isArray(result.warnings) && result.warnings.length > 0) {
    console.warn(`[textbook-parser] 第 ${chapter.id} 章校验提示（不影响保存，建议修正后重存）：\n- ${result.warnings.join('\n- ')}`)
  }

  const chapterFile = path.join(dirs.userBooksDir, bookId, 'chapters', `${chapter.id}.json`)
  await writeJsonAtomic(chapterFile, chapter)
  const chapterStats = summarizeChapterStats(chapter)
  const response = {
    bookId,
    chapterId: chapter.id,
    path: chapterFile,
    chapterStats,
    stats: null,
    bookUpdated: false,
    warnings: result.warnings,
  }

  if (isPlainObject(userBook)) {
    response.stats = await syncBookWithChapter(dirs, bookId, userBook, chapter)
    await writeJsonAtomic(userBookFile, userBook)
    response.bookUpdated = true
  } else {
    response.stats = await computeStatsWithOverride(dirs, bookId, bookForCheck, chapter)
  }
  return response
}

async function computeStatsWithOverride(dirs, bookId, book, overrideChapter) {
  const chapterMap = await loadChapterFiles(dirs, bookId)
  chapterMap.set(overrideChapter.id, overrideChapter)
  return computeStatsFromChapterMap(book, chapterMap)
}

async function deleteBookImpl(dirs, bookId) {
  if (!isValidBookId(bookId)) {
    throw new Error(`bookId 不合法：${describeValue(bookId)}；必须是 kebab-case 字符串（如 signals-systems-zheng）。`)
  }
  const userDir = await findBookDir(dirs.userBooksDir, bookId)
  if (userDir) {
    await fs.rm(userDir, { recursive: true, force: true })
    return { bookId, path: userDir, deleted: true, source: 'user' }
  }
  const bundledDir = await findBookDir(dirs.bundledBooksDir, bookId)
  if (bundledDir) {
    throw new Error(
      `「${bookId}」是内置示例教材，不可删除；如需修改，请用另一个 bookId 另存（save_book + save_chapter），内置示例保持只读。`,
    )
  }
  throw new Error(
    `未找到教材「${bookId}」：用户目录 ${path.join(dirs.userBooksDir, bookId)} 不存在，内置示例中也没有该 id。可先 list_books 查看可用的 bookId。`,
  )
}

// ---------------------------------------------------------------------------
// 工厂
// ---------------------------------------------------------------------------

/**
 * 创建存储实例。
 * @param {{ dataDir?: string, bundledDir?: string }} [config]
 */
export function createStore(config = {}) {
  const dirs = resolveDirs(config)
  const store = {
    ...dirs,
    config: isPlainObject(config) ? { ...config } : {},
    resolveDirs: () => dirs,
    listBooks: () => listBooksImpl(dirs),
    getBook: (bookId) => getBookImpl(dirs, bookId),
    getChapter: (bookId, chapterId) => getChapterImpl(dirs, bookId, chapterId),
    saveBook: (book) => saveBookImpl(dirs, book),
    saveChapter: (bookId, chapter) => saveChapterImpl(dirs, bookId, chapter),
    deleteBook: (bookId) => deleteBookImpl(dirs, bookId),
    validateBook: (book, options) => validateBook(book, options),
    validateChapter: (chapter, options) => validateChapter(chapter, options),
    /** 底层目录对象（只读用途） */
    dirs: () => dirs,
  }
  return store
}