#!/usr/bin/env node
/**
 * textbook-parser · Host 侧单测（node 内置 test runner，无外部依赖）
 *
 * 运行：
 *   node plugin/textbook-parser/test/host.test.mjs
 *   cd plugin/textbook-parser && node test/host.test.mjs
 *
 * 覆盖：store 合并/读写/校验/原子写、routes 状态码与 JSON、textbook_archive 工具
 * （save_book→save_chapter→list_books→路由读取 全链路）、skill 注册、apply 容错（mock ctx）。
 * 所有落盘都写系统临时目录，不依赖、不修改包内 data/ 与用户真实数据。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

import {
  PKG_DIR,
  createStore,
  resolveDirs,
  validateBook,
  validateChapter,
} from '../host/store.js'
import { API_PREFIX, createRoutes } from '../host/routes.js'
import { createTool } from '../host/tool.js'
import { buildSkillRegistration, parseFrontmatter, registerSkill, resolveSkillFile } from '../host/skill.js'
import { apply } from '../index.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEST_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'tbp-host-test-'))

test.after(async () => {
  await fs.rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {})
})

let tempCounter = 0
async function freshDirs() {
  tempCounter += 1
  const root = path.join(TEST_ROOT, `case-${tempCounter}`)
  const dataDir = path.join(root, 'user-data')
  const bundledDir = path.join(root, 'bundled')
  await fs.mkdir(root, { recursive: true })
  return { root, dataDir, bundledDir }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

// ---------------------------------------------------------------------------
// 测试夹具（字段与 SPEC §3 / skills references/schema.md 一致）
// ---------------------------------------------------------------------------

function makePoint(id, title) {
  return {
    id,
    title,
    solves: `解决「${title}」对应的具体缺陷：前一套方案在工程上不能直接算。`,
    meaning: `${title}用统一数学语言描述问题，使不同物理系统可以套用同一套分析方法。`,
    formula: 'y(t)=T[x(t)]',
    application: '用于电路、通信与控制系统的响应分析。',
    example: {
      question: `已知系统 y(t)=2x(t)，输入 x(t)=u(t)，求 ${title} 对应的输出。`,
      answer: '由线性与时不变性直接代入：y(t)=2u(t)。步骤：先确认系统性质，再代入定义，最后写出结果。',
    },
    prerequisites: ['函数'],
    limitation: '',
    next: '',
  }
}

function makeSection(number, index) {
  const id = `${number}.${index}`
  return {
    id,
    title: `第 ${id} 节`,
    subProblem: `本节要解决的子矛盾：如何把第 ${id} 节的对象纳入统一框架。`,
    requires: ['微积分'],
    remaining: '',
    points: [makePoint(`${id}.1`, `${id} 知识点一`), makePoint(`${id}.2`, `${id} 知识点二`)],
  }
}

function makeChapter(number, overrides = {}) {
  const id = `ch${String(number).padStart(2, '0')}`
  const sections = [makeSection(number, 1), makeSection(number, 2)]
  return {
    id,
    number,
    title: number === 1 ? '绪论' : `第 ${number} 章`,
    solves: `解决第 ${number - 1} 章方案遗留的缺陷，建立新的分析工具。`,
    requires: ['微积分'],
    gain: `获得第 ${number} 章的分析能力。`,
    remainingGap: `第 ${number} 章方案仍存在新缺陷，引出下一章。`,
    chain: [
      { from: '上一方案求解繁琐', to: '本章新工具', label: '修复' },
      { from: '新工具要求苛刻条件', to: '后续推广方案', label: '推广' },
    ],
    sections,
    ...overrides,
  }
}

function makeBook(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'demo-book',
    title: '演示教材',
    subtitle: '测试版 · 上册',
    subject: '电子信息',
    tags: ['演示', '测试'],
    updatedAt: '2026-11-04T12:00:00.000Z',
    overview: {
      goal: '演示全书总目标：用统一框架分析线性时不变系统。',
      pain: '演示原始痛点：旧方案逐个激励求解，效率低且看不出频率选择性。',
      mainline: '时域卷积 → 傅里叶变换 → 拉普拉斯变换，逐层修复缺陷。',
      chain: [
        { step: '初代方案：时域卷积', detail: '用冲激响应卷积求响应。', defect: '解微分方程繁琐。' },
        { step: '修复方案：频域变换', detail: '用傅里叶变换把卷积变乘法。', defect: '增长信号不收敛。' },
      ],
    },
    chapters: [
      {
        id: 'ch01',
        number: 1,
        title: '绪论',
        solves: '解决如何统一描述信号与系统。',
        requires: ['微积分'],
        gain: '能建立激励—响应框架。',
        remainingGap: '时域分析难以处理频率特性。',
        sections: [
          { id: '1.1', title: '第 1.1 节', subProblem: '如何统一描述。', pointCount: 2 },
          { id: '1.2', title: '第 1.2 节', subProblem: '如何分类系统。', pointCount: 2 },
        ],
      },
      {
        id: 'ch02',
        number: 2,
        title: '第 2 章',
        solves: '解决第 1 章遗留的时域求解问题。',
        requires: ['ch01'],
        gain: '会做卷积。',
        remainingGap: '卷积难以直接看频响。',
        sections: [
          { id: '2.1', title: '第 2.1 节', subProblem: '如何求响应。', pointCount: 2 },
          { id: '2.2', title: '第 2.2 节', subProblem: '如何判稳定。', pointCount: 2 },
        ],
      },
    ],
    stats: { chapters: 2, sections: 4, points: 8 },
    ...overrides,
  }
}

function makeBundledBook(id = 'bundled-book', title = '内置演示书') {
  return makeBook({
    id,
    title,
    chapters: [
      {
        id: 'ch01',
        number: 1,
        title: '绪论',
        solves: '解决内置示例的描述问题。',
        requires: [],
        gain: '内置示例能力。',
        remainingGap: '内置示例的遗留短板。',
        sections: [
          { id: '1.1', title: '第 1.1 节', subProblem: '内置子问题。', pointCount: 2 },
          { id: '1.2', title: '第 1.2 节', subProblem: '内置子问题二。', pointCount: 2 },
        ],
      },
    ],
    stats: { chapters: 1, sections: 2, points: 4 },
  })
}

// ---------------------------------------------------------------------------
// mock ctx / 假 req-res
// ---------------------------------------------------------------------------

function makeMockCtx(options = {}) {
  const calls = { effects: [], skills: [], tools: [], webServer: [] }
  const ctx = {
    effect(register, label) {
      calls.effects.push({ label, register })
      const disposer = register()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
    get(name) {
      if (Array.isArray(options.missing) && options.missing.includes(name)) return undefined
      return ctx[name]
    },
  }
  ctx.skills =
    options.skills === null
      ? undefined
      : {
          register(definition) {
            if (options.throwSkills) throw new Error('mock skills.register 失败')
            calls.skills.push(definition)
            return () => {}
          },
        }
  ctx.tools =
    options.tools === null
      ? undefined
      : {
          register(definition) {
            if (options.throwTools) throw new Error('mock tools.register 失败')
            calls.tools.push(definition)
            return () => {}
          },
        }
  ctx.webServer =
    options.webServer === null
      ? undefined
      : {
          register(route) {
            if (options.throwWebServer) throw new Error('mock webServer.register 失败')
            calls.webServer.push(route)
            return () => {}
          },
        }
  return { ctx, calls }
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    headersSent: false,
    finished: false,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode
      this.headersSent = true
      for (const [key, value] of Object.entries(headers || {})) this.headers[key.toLowerCase()] = value
    },
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value
    },
    end(body) {
      this.finished = true
      this.body = body === undefined || body === null ? '' : String(body)
    },
  }
}

async function request(handler, method, url) {
  const req = { method, url, headers: { host: '127.0.0.1:53090' } }
  const res = fakeRes()
  await handler(req, res)
  let json = null
  try {
    json = res.body ? JSON.parse(res.body) : null
  } catch {
    json = null
  }
  return { res, json }
}

// ---------------------------------------------------------------------------
// v1.1 新字段夹具：在旧字段上补 analogy / summary / examples（旧夹具保持无新字段，
// 以持续验证向后兼容）
// ---------------------------------------------------------------------------

function makeSectionExamples(sectionId) {
  return [
    {
      id: `${sectionId}-e1`,
      type: '概念判断',
      source: '教材例题改编',
      question: `${sectionId}：判断「${sectionId} 的结论对所有系统都成立」是否正确。`,
      answer: '步骤：举反例，非 LTI 系统不满足该结论。结论：说法错误。',
      note: '注意定义前提。',
    },
    {
      id: `${sectionId}-e2`,
      type: '计算',
      source: '课后习题改编',
      question: `${sectionId}：已知输入 x(t)=e^{-t}u(t)，求输出 y(t)=2x(t)。`,
      answer: '步骤：由线性代入 y(t)=2e^{-t}u(t)。答案：y(t)=2e^{-t}u(t)。',
    },
    {
      id: `${sectionId}-e3`,
      type: '推导证明',
      source: '教材例题改编',
      question: `${sectionId}：证明线性系统 T[0]=0。`,
      answer: '步骤：由齐次性 T[0]=0·T[x]=0。结论得证。',
    },
    {
      id: `${sectionId}-e4`,
      type: '易错辨析',
      source: '典型题',
      question: `${sectionId}：判断 y(t)=t·x(t) 是否时不变。`,
      answer: '步骤：比较 T[x(t-t0)] 与 y(t-t0)，两者不等。结论：时变系统。',
      note: '显含 t 的系数是常见反例。',
    },
  ]
}

function makeEnrichedSection(number, index) {
  const section = makeSection(number, index)
  section.summary = `本节总览：第 ${section.id} 节讲清楚如何描述问题并计算响应。\n① ${section.points[0].title}：说明它解决什么问题。\n② ${section.points[1].title}：说明它怎么用于计算。`
  section.analogy = `本节像分两步整理行李：先把物品分类（知识点拆分），再按清单装箱（方法串起来）。`
  section.examples = makeSectionExamples(section.id)
  for (const point of section.points) {
    point.analogy = `「${point.title}」像快递单号：先给对象一个统一标识，才能在后续流程里查询和计算它。`
  }
  return section
}

function makeEnrichedChapter(number, overrides = {}) {
  const chapter = makeChapter(number, overrides)
  chapter.analogy = `第 ${number} 章像从手算升级到用计算器：先承认旧办法低效，再引入本章的新工具。`
  chapter.sections = chapter.sections.map((section) => makeEnrichedSection(number, Number(section.id.split('.')[1])))
  return chapter
}

function makeEnrichedBook(overrides = {}) {
  const book = makeBook(overrides)
  book.overview.analogy = '整本书像给公路做体检：先认车辆（信号）和路面规则（系统），再换不同镜头（时域/频域/复频域）看车流。'
  book.chapters = book.chapters.map((chapter) => ({
    ...chapter,
    analogy: `第 ${chapter.number} 章像从手算升级到用计算器：先承认旧办法低效，再引入本章的新工具。`,
  }))
  return book
}

// -- v1.2 知识点详解/星标字段夹具 --------------------------------------------
// detail 写够 50 字以上，避免测试因“过短告警”产生噪声；真实内容要求 350-800 字。
function makeDeepPoint(point, important = false) {
  return {
    ...point,
    important,
    detail: `${point.title}：它出现在上一方案无法直接计算的场景。核心结论是它把抽象定义变成可计算工具；使用步骤是先判断系统性质，再代入定义求响应，最后检查边界条件与物理意义。与前后知识点的关系是：它承接前一节的抽象，又为下一节的方法提供输入。`,
    keyPoints: [
      `记住「${point.title}」的定义与适用条件`,
      '计算套路：先判性质，再代定义，最后检查边界',
      '易错：忽略前提条件会导致结论不成立',
    ],
    derivation: '推导思路：从定义出发，设输入为 x(t)，代入系统算子化简，得到与教材一致的结论。',
    mistakes: '易错辨析：常见错误是把时变系统当成时不变处理；判断时要检查系数是否显含 t，以及输入延迟与输出延迟是否一致。',
    examTips: '常见考法：概念判断 + 简单计算；解题入口是回到定义。工程上用于滤波器与传输线分析。',
  }
}

function makeDeepChapter(number) {
  const chapter = makeEnrichedChapter(number)
  chapter.sections = chapter.sections.map((section) => ({
    ...section,
    points: section.points.map((point, index) => makeDeepPoint(point, index === 0)),
  }))
  return chapter
}

// ---------------------------------------------------------------------------
// 1. 目录解析
// ---------------------------------------------------------------------------

test('resolveDirs：默认走 DSH_HOME；dataDir / bundledDir 可覆盖；非法类型抛错', async () => {
  const { root, dataDir, bundledDir } = await freshDirs()
  const envHome = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() ? process.env.DSH_HOME.trim() : path.join(os.homedir(), '.dsh')
  const defaults = resolveDirs()
  assert.equal(defaults.userRoot, path.join(envHome, 'textbook-parser'))
  assert.equal(defaults.userBooksDir, path.join(envHome, 'textbook-parser', 'books'))
  assert.equal(defaults.bundledRoot, path.join(PKG_DIR, 'data'))

  const custom = resolveDirs({ dataDir, bundledDir })
  assert.equal(custom.userRoot, dataDir)
  assert.equal(custom.userBooksDir, path.join(dataDir, 'books'))
  assert.equal(custom.bundledRoot, bundledDir)
  assert.equal(custom.bundledBooksDir, path.join(bundledDir, 'books'))
  assert.ok(root)

  assert.throws(() => resolveDirs({ dataDir: 42 }), /dataDir/)
  assert.throws(() => resolveDirs({ bundledDir: {} }), /bundledDir/)
})

// ---------------------------------------------------------------------------
// 2. 校验器
// ---------------------------------------------------------------------------

test('validateBook：合法 book 通过，坏数据逐条报字段路径', () => {
  const good = validateBook(makeBook())
  assert.equal(good.ok, true, JSON.stringify(good.errors))
  assert.deepEqual(good.errors, [])

  const badId = validateBook(makeBook({ id: 'Bad_ID' }))
  assert.equal(badId.ok, false)
  assert.ok(badId.errors.some((item) => item.includes('kebab-case')), badId.errors.join('\n'))

  const missingTitle = validateBook(makeBook({ title: '   ' }))
  assert.equal(missingTitle.ok, false)
  assert.ok(missingTitle.errors.some((item) => item.includes('title')))

  const emptyChain = validateBook(makeBook({ overview: { ...makeBook().overview, chain: [] } }))
  assert.equal(emptyChain.ok, false)
  assert.ok(emptyChain.errors.some((item) => item.includes('overview.chain')))

  const book = makeBook()
  book.chapters.push(structuredClone(book.chapters[0]))
  const duplicate = validateBook(book)
  assert.equal(duplicate.ok, false)
  assert.ok(duplicate.errors.some((item) => item.includes('重复')), duplicate.errors.join('\n'))

  const badPointCount = makeBook()
  badPointCount.chapters[0].sections[0].pointCount = '2'
  const firstChapter = badPointCount.chapters[0]
  const badPoint = validateBook(badPointCount)
  assert.equal(badPoint.ok, false)
  assert.ok(badPoint.errors.some((item) => item.includes('pointCount')), `${firstChapter.sections[0].pointCount}`)

  const noStats = makeBook({ stats: undefined })
  const statsResult = validateBook(noStats)
  assert.equal(statsResult.ok, false)
  assert.ok(statsResult.errors.some((item) => item.includes('stats')))
})

test('validateBook：已有章文件时校验 pointCount / 章号跨文件一致', () => {
  const book = makeBook()
  const chapterFiles = new Map([['ch01', makeChapter(1)]])
  assert.equal(validateBook(book, { chapterFiles }).ok, true)

  const wrongCount = makeBook()
  wrongCount.chapters[0].sections[0].pointCount = 3
  const result = validateBook(wrongCount, { chapterFiles })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.includes('pointCount')), result.errors.join('\n'))

  const wrongNumber = makeBook()
  wrongNumber.chapters[0].number = 9
  const numberResult = validateBook(wrongNumber, { chapterFiles: new Map([['ch01', makeChapter(1)]]) })
  assert.equal(numberResult.ok, false)
  assert.ok(numberResult.errors.some((item) => item.includes('number')))
})

test('validateChapter：合法章通过，缺字段 / 重复 id / 坏 example 拒绝', () => {
  const good = validateChapter(makeChapter(1))
  assert.equal(good.ok, true, JSON.stringify(good.errors))

  const missingSolves = makeChapter(1, { solves: '' })
  const missingResult = validateChapter(missingSolves)
  assert.equal(missingResult.ok, false)
  assert.ok(missingResult.errors.some((item) => item.includes('solves')))

  const shortChain = makeChapter(1, { chain: [{ from: 'a', to: 'b', label: '修复' }] })
  const chainResult = validateChapter(shortChain)
  assert.equal(chainResult.ok, false)
  assert.ok(chainResult.errors.some((item) => item.includes('chain') && item.includes('至少')))

  const duplicatePoint = makeChapter(1)
  duplicatePoint.sections[0].points[1].id = duplicatePoint.sections[0].points[0].id
  const duplicateResult = validateChapter(duplicatePoint)
  assert.equal(duplicateResult.ok, false)
  assert.ok(duplicateResult.errors.some((item) => item.includes('重复')))

  const badExample = makeChapter(1)
  badExample.sections[0].points[0].example = { question: '求输出', answer: '' }
  const exampleResult = validateChapter(badExample)
  assert.equal(exampleResult.ok, false)
  assert.ok(exampleResult.errors.some((item) => item.includes('example.answer')))

  const badNumber = makeChapter(1, { number: 5 })
  const numberResult = validateChapter(badNumber)
  assert.equal(numberResult.ok, false)
  assert.ok(numberResult.errors.some((item) => item.includes('number')))
})

test('validateChapter：与 book.json 交叉校验（章必须存在、number 一致）', () => {
  const book = makeBook()
  assert.equal(validateChapter(makeChapter(1), { book }).ok, true)

  const missingInBook = validateChapter(makeChapter(3), { book })
  assert.equal(missingInBook.ok, false)
  assert.ok(missingInBook.errors.some((item) => item.includes('book.json')))

  const wrongNumber = makeChapter(1, { number: 2 })
  const numberResult = validateChapter(wrongNumber, { book })
  assert.equal(numberResult.ok, false)
  assert.ok(numberResult.errors.some((item) => item.includes('number')))
})

// -- v1.1 新字段：overview/chapter analogy -----------------------------------

test('validateBook v1.1：overview.analogy / chapter.analogy 存在时校验，旧数据保持兼容', () => {
  // 旧数据（无任何 analogy）仍然通过
  const legacy = validateBook(makeBook())
  assert.equal(legacy.ok, true, JSON.stringify(legacy.errors))

  // 合法新字段通过
  const enriched = validateBook(makeEnrichedBook())
  assert.equal(enriched.ok, true, JSON.stringify(enriched.errors))

  // overview.analogy 空串 / 非字符串被拒
  const emptyOverview = makeEnrichedBook()
  emptyOverview.overview.analogy = '   '
  const emptyOverviewResult = validateBook(emptyOverview)
  assert.equal(emptyOverviewResult.ok, false)
  assert.ok(emptyOverviewResult.errors.some((item) => item.includes('overview.analogy')), emptyOverviewResult.errors.join('\n'))

  const badOverviewType = makeEnrichedBook()
  badOverviewType.overview.analogy = 42
  const badOverviewResult = validateBook(badOverviewType)
  assert.equal(badOverviewResult.ok, false)
  assert.ok(badOverviewResult.errors.some((item) => item.includes('overview.analogy')))

  const nullOverview = makeEnrichedBook()
  nullOverview.overview.analogy = null
  assert.equal(validateBook(nullOverview).ok, false)
  assert.ok(validateBook(nullOverview).errors.some((item) => item.includes('overview.analogy')))

  // chapter.analogy 空串 / 非字符串被拒
  const emptyChapter = makeEnrichedBook()
  emptyChapter.chapters[1].analogy = ''
  const emptyChapterResult = validateBook(emptyChapter)
  assert.equal(emptyChapterResult.ok, false)
  assert.ok(emptyChapterResult.errors.some((item) => item.includes('chapters[1].analogy')))

  const badChapterType = makeEnrichedBook()
  badChapterType.chapters[0].analogy = { text: '类比' }
  const badChapterResult = validateBook(badChapterType)
  assert.equal(badChapterResult.ok, false)
  assert.ok(badChapterResult.errors.some((item) => item.includes('chapters[0].analogy')))
})

test('validateBook：schemaVersion 仍只接受 1 / undefined（v1.1 新字段不升版本）', () => {
  const undefinedVersion = makeBook({ schemaVersion: undefined })
  assert.equal(validateBook(undefinedVersion).ok, true, 'schemaVersion 缺省（旧数据）必须继续通过')

  const versionTwo = makeBook({ schemaVersion: 2 })
  const result = validateBook(versionTwo)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.includes('schemaVersion')))

  // 带 v1.1 新字段的旧版本数据同样可校验（不因新字段被迫升版本）
  const enriched = makeEnrichedBook()
  assert.equal(enriched.schemaVersion, 1)
  assert.equal(validateBook(enriched).ok, true)
})

// -- v1.1 新字段：chapter/section/point --------------------------------------

test('validateChapter v1.1：chapter.analogy / section.summary/analogy / point.analogy 合法通过', () => {
  assert.equal(validateChapter(makeEnrichedChapter(1)).ok, true, JSON.stringify(validateChapter(makeEnrichedChapter(1)).errors))
  assert.equal(validateChapter(makeChapter(1)).ok, true, '旧数据（无新字段）必须继续通过')

  // 缺失新字段是允许的（向后兼容）：逐项删除仍通过
  const noChapterAnalogy = makeEnrichedChapter(1)
  delete noChapterAnalogy.analogy
  assert.equal(validateChapter(noChapterAnalogy).ok, true)

  const noSectionFields = makeEnrichedChapter(1)
  delete noSectionFields.sections[0].summary
  delete noSectionFields.sections[0].analogy
  delete noSectionFields.sections[0].examples
  assert.equal(validateChapter(noSectionFields).ok, true)

  const noPointAnalogy = makeEnrichedChapter(1)
  delete noPointAnalogy.sections[0].points[0].analogy
  assert.equal(validateChapter(noPointAnalogy).ok, true)

  // 不同节使用相同例题 id 是允许的（唯一性只在节内）
  const crossSection = makeEnrichedChapter(1)
  crossSection.sections[1].examples = [
    { ...makeSectionExamples('1.2')[0], id: crossSection.sections[0].examples[0].id },
  ]
  const crossResult = validateChapter(crossSection)
  assert.equal(crossResult.ok, true, JSON.stringify(crossResult.errors))
})

test('validateChapter v1.1：analogy / summary 存在但为空串或非字符串被拒', () => {
  const emptyChapterAnalogy = makeEnrichedChapter(1)
  emptyChapterAnalogy.analogy = '  '
  const r1 = validateChapter(emptyChapterAnalogy)
  assert.equal(r1.ok, false)
  assert.ok(r1.errors.some((item) => item.includes('analogy')))

  const badSectionSummary = makeEnrichedChapter(1)
  badSectionSummary.sections[0].summary = 123
  const r2 = validateChapter(badSectionSummary)
  assert.equal(r2.ok, false)
  assert.ok(r2.errors.some((item) => item.includes('sections[0].summary')))

  const emptySectionAnalogy = makeEnrichedChapter(1)
  emptySectionAnalogy.sections[0].analogy = ''
  const r3 = validateChapter(emptySectionAnalogy)
  assert.equal(r3.ok, false)
  assert.ok(r3.errors.some((item) => item.includes('sections[0].analogy')))

  const badPointAnalogy = makeEnrichedChapter(1)
  badPointAnalogy.sections[0].points[0].analogy = 0
  const r4 = validateChapter(badPointAnalogy)
  assert.equal(r4.ok, false)
  assert.ok(r4.errors.some((item) => item.includes('points[0].analogy')))

  const emptyPointAnalogy = makeEnrichedChapter(1)
  emptyPointAnalogy.sections[0].points[1].analogy = '   '
  const r5 = validateChapter(emptyPointAnalogy)
  assert.equal(r5.ok, false)
  assert.ok(r5.errors.some((item) => item.includes('points[1].analogy')))
})

test('validateChapter v1.1：section.examples 形状校验（数组、逐项字段、id 节内唯一）', () => {
  const base = () => makeEnrichedChapter(1)

  // 不是数组
  const notArray = base()
  notArray.sections[0].examples = '4 道'
  const r1 = validateChapter(notArray)
  assert.equal(r1.ok, false)
  assert.ok(r1.errors.some((item) => item.includes('sections[0].examples') && item.includes('数组')))

  // 空数组
  const emptyArray = base()
  emptyArray.sections[0].examples = []
  const r2 = validateChapter(emptyArray)
  assert.equal(r2.ok, false)
  assert.ok(r2.errors.some((item) => item.includes('至少需要 1 道例题')))

  // 项不是对象
  const notObject = base()
  notObject.sections[0].examples = [null]
  const r3 = validateChapter(notObject)
  assert.equal(r3.ok, false)
  assert.ok(r3.errors.some((item) => item.includes('examples[0]') && item.includes('必须是对象')))

  // 缺 type / question / answer
  const missingType = base()
  delete missingType.sections[0].examples[0].type
  const r4 = validateChapter(missingType)
  assert.equal(r4.ok, false)
  assert.ok(r4.errors.some((item) => item.includes('examples[0].type')))

  const missingQuestion = base()
  delete missingQuestion.sections[0].examples[1].question
  const r5 = validateChapter(missingQuestion)
  assert.equal(r5.ok, false)
  assert.ok(r5.errors.some((item) => item.includes('examples[1].question')))

  const emptyAnswer = base()
  emptyAnswer.sections[0].examples[2].answer = ''
  const r6 = validateChapter(emptyAnswer)
  assert.equal(r6.ok, false)
  assert.ok(r6.errors.some((item) => item.includes('examples[2].answer')))

  // id 在节内重复
  const duplicateIds = base()
  duplicateIds.sections[0].examples[1].id = duplicateIds.sections[0].examples[0].id
  const r7 = validateChapter(duplicateIds)
  assert.equal(r7.ok, false)
  assert.ok(r7.errors.some((item) => item.includes('在本节例题中重复')))

  // id 非法类型 / source / note 类型
  const badId = base()
  badId.sections[0].examples[0].id = 5
  const r8 = validateChapter(badId)
  assert.equal(r8.ok, false)
  assert.ok(r8.errors.some((item) => item.includes('id 若提供必须是非空字符串')))

  const badSource = base()
  badSource.sections[0].examples[0].source = 42
  const r9 = validateChapter(badSource)
  assert.equal(r9.ok, false)
  assert.ok(r9.errors.some((item) => item.includes('source')))

  const badNote = base()
  badNote.sections[0].examples[0].note = {}
  const r10 = validateChapter(badNote)
  assert.equal(r10.ok, false)
  assert.ok(r10.errors.some((item) => item.includes('note')))
})

// -- v1.2 新字段：important / detail / keyPoints / derivation / mistakes / examTips

test('validateChapter v1.2：详解/星标字段合法通过，旧数据与 v1.1 数据保持兼容', () => {
  const deep = validateChapter(makeDeepChapter(1))
  assert.equal(deep.ok, true, JSON.stringify(deep.errors))
  assert.deepEqual(deep.warnings, [], 'detail 足够长时不应有告警')

  // 旧数据（无 v1.2 字段）与 v1.1 数据继续通过
  assert.equal(validateChapter(makeChapter(1)).ok, true)
  const v11 = validateChapter(makeEnrichedChapter(1))
  assert.equal(v11.ok, true, JSON.stringify(v11.errors))

  // 只出现部分新字段也通过（存在时校验）
  const partial = makeChapter(1)
  partial.sections[0].points[0].important = true
  partial.sections[0].points[1].derivation = ''
  const partialResult = validateChapter(partial)
  assert.equal(partialResult.ok, true, JSON.stringify(partialResult.errors))

  // important 两种取值都合法；空字符串 derivation/mistakes/examTips 合法
  const values = makeDeepChapter(1)
  values.sections[0].points[0].important = false
  values.sections[0].points[1].important = true
  values.sections[0].points[1].derivation = ''
  values.sections[0].points[1].mistakes = ''
  values.sections[0].points[1].examTips = ''
  const valuesResult = validateChapter(values)
  assert.equal(valuesResult.ok, true, JSON.stringify(valuesResult.errors))
})

test('validateChapter v1.2：important / detail 类型与空值校验，短 detail 只告警不硬卡', () => {
  const base = () => makeDeepChapter(1)
  const pointLabel = 'sections[0].points[0]'

  for (const [value, label] of [
    ['true', 'important 字符串'],
    [1, 'important 数字'],
    [null, 'important null'],
  ]) {
    const bad = base()
    bad.sections[0].points[0].important = value
    const result = validateChapter(bad)
    assert.equal(result.ok, false, label)
    assert.ok(result.errors.some((item) => item.includes(`${pointLabel}.important`)), `${label}: ${result.errors.join('\n')}`)
  }

  const detailNumber = base()
  detailNumber.sections[0].points[0].detail = 42
  const detailNumberResult = validateChapter(detailNumber)
  assert.equal(detailNumberResult.ok, false)
  assert.ok(detailNumberResult.errors.some((item) => item.includes(`${pointLabel}.detail`)))

  const detailEmpty = base()
  detailEmpty.sections[0].points[0].detail = '   '
  const detailEmptyResult = validateChapter(detailEmpty)
  assert.equal(detailEmptyResult.ok, false)
  assert.ok(detailEmptyResult.errors.some((item) => item.includes(`${pointLabel}.detail`)))

  // 短 detail（≥1 但 <50 字）：仍然合法，只产生 warnings
  const shortDetail = base()
  shortDetail.sections[0].points[0].detail = '太短了，只有几个字。'
  const shortResult = validateChapter(shortDetail)
  assert.equal(shortResult.ok, true, JSON.stringify(shortResult.errors))
  assert.ok(Array.isArray(shortResult.warnings) && shortResult.warnings.length >= 1, '短 detail 应产生告警')
  assert.ok(shortResult.warnings.some((item) => item.includes(`${pointLabel}.detail`) && item.includes('建议')))

  // 缺失 detail 保持兼容（旧数据）
  const noDetail = base()
  delete noDetail.sections[0].points[0].detail
  assert.equal(validateChapter(noDetail).ok, true)
})

test('validateChapter v1.2：keyPoints 数组形状，derivation/mistakes/examTips 类型校验', () => {
  const base = () => makeDeepChapter(1)

  // keyPoints 非数组
  const notArray = base()
  notArray.sections[0].points[0].keyPoints = '三条要点'
  const r1 = validateChapter(notArray)
  assert.equal(r1.ok, false)
  assert.ok(r1.errors.some((item) => item.includes('.keyPoints') && item.includes('数组')))

  // 空数组 / 超过 10 项
  const emptyArray = base()
  emptyArray.sections[0].points[0].keyPoints = []
  const r2 = validateChapter(emptyArray)
  assert.equal(r2.ok, false)
  assert.ok(r2.errors.some((item) => item.includes('.keyPoints') && item.includes('1-10')))

  const tooMany = base()
  tooMany.sections[0].points[0].keyPoints = Array.from({ length: 11 }, (_, i) => `要点 ${i + 1}`)
  const r3 = validateChapter(tooMany)
  assert.equal(r3.ok, false)
  assert.ok(r3.errors.some((item) => item.includes('.keyPoints') && item.includes('1-10')))

  // 数组元素必须是字符串且非空
  const badItems = base()
  badItems.sections[0].points[0].keyPoints = ['有效要点', '', 3]
  const r4 = validateChapter(badItems)
  assert.equal(r4.ok, false)
  assert.ok(r4.errors.some((item) => item.includes('.keyPoints[1]') && item.includes('空字符串')))
  assert.ok(r4.errors.some((item) => item.includes('.keyPoints[2]') && item.includes('字符串')))

  // 1 项 / 6 项 / 10 项均合法（任务要求 1-10，skill 建议 3-6）
  const oneItem = base()
  oneItem.sections[0].points[0].keyPoints = ['唯一要点']
  assert.equal(validateChapter(oneItem).ok, true)

  const sixItems = base()
  sixItems.sections[0].points[0].keyPoints = Array.from({ length: 6 }, (_, i) => `要点 ${i + 1}`)
  assert.equal(validateChapter(sixItems).ok, true)

  const tenItems = base()
  tenItems.sections[0].points[0].keyPoints = Array.from({ length: 10 }, (_, i) => `要点 ${i + 1}`)
  assert.equal(validateChapter(tenItems).ok, true)

  // derivation / mistakes / examTips：存在时必须是字符串（可为 ""），null/数字被拒
  for (const field of ['derivation', 'mistakes', 'examTips']) {
    const badString = base()
    badString.sections[0].points[1][field] = null
    const badResult = validateChapter(badString)
    assert.equal(badResult.ok, false, `${field} null`)
    assert.ok(badResult.errors.some((item) => item.includes(`.${field}`) && item.includes('字符串')), badResult.errors.join('\n'))

    const badNumber = base()
    badNumber.sections[0].points[1][field] = 12
    assert.equal(validateChapter(badNumber).ok, false, `${field} number`)

    const emptyString = base()
    emptyString.sections[0].points[1][field] = ''
    assert.equal(validateChapter(emptyString).ok, true, `${field} 空字符串应允许`)
  }

  // keyPoints 缺失保持兼容（旧数据）
  const noKeyPoints = base()
  delete noKeyPoints.sections[0].points[0].keyPoints
  assert.equal(validateChapter(noKeyPoints).ok, true)
})

// ---------------------------------------------------------------------------
// 3. 存储层：合并读取 / 写入 / 原子写 / 统计 / 删除
// ---------------------------------------------------------------------------

test('store：save_book → save_chapter 落盘用户目录，合并 listBooks 且用户覆盖内置', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  // 内置示例数据（只读侧）
  const bundled = makeBundledBook('bundled-book', '内置演示书')
  await writeJson(path.join(bundledDir, 'books', 'bundled-book', 'book.json'), bundled)
  await writeJson(path.join(bundledDir, 'books', 'bundled-book', 'chapters', 'ch01.json'), makeChapter(1))

  const store = createStore({ dataDir, bundledDir })
  assert.equal(store.userRoot, dataDir)
  assert.equal(store.bundledRoot, bundledDir)

  // 写入用户书
  const saved = await store.saveBook(makeBook())
  assert.equal(saved.bookId, 'demo-book')
  assert.equal(saved.path, path.join(dataDir, 'books', 'demo-book', 'book.json'))
  const raw = await fs.readFile(saved.path, 'utf8')
  assert.match(raw, /^\{\n {2}"schemaVersion": 1,/)
  assert.ok(!raw.includes('\t'))

  // book.json 所在目录里没有残留的临时文件
  const entries = await fs.readdir(path.join(dataDir, 'books', 'demo-book'))
  assert.deepEqual(entries.filter((name) => name.endsWith('.tmp')), [])

  // 写章 → 自动同步 book.json stats / updatedAt / pointCount
  const chapterSaved = await store.saveChapter('demo-book', makeChapter(1))
  assert.equal(chapterSaved.bookId, 'demo-book')
  assert.equal(chapterSaved.chapterId, 'ch01')
  assert.equal(chapterSaved.bookUpdated, true)
  assert.equal(chapterSaved.chapterStats.sections, 2)
  assert.equal(chapterSaved.chapterStats.points, 4)
  assert.deepEqual(chapterSaved.stats, { chapters: 2, sections: 4, points: 8 })

  const bookAfter = await store.getBook('demo-book')
  assert.equal(bookAfter.source, 'user')
  assert.notEqual(bookAfter.updatedAt, '2026-11-04T12:00:00.000Z')
  assert.deepEqual(bookAfter.stats, { chapters: 2, sections: 4, points: 8 })

  const chapter = await store.getChapter('demo-book', 'ch01')
  assert.equal(chapter.id, 'ch01')
  assert.equal(chapter.sections.length, 2)
  assert.equal(chapter.sections[0].points.length, 2)

  // 合并列表：内置 + 用户
  let books = await store.listBooks()
  assert.deepEqual(books.map((book) => book.id).sort(), ['bundled-book', 'demo-book'])
  const bundledSummary = books.find((book) => book.id === 'bundled-book')
  assert.equal(bundledSummary.source, 'bundled')
  const userSummary = books.find((book) => book.id === 'demo-book')
  assert.equal(userSummary.source, 'user')
  assert.equal(userSummary.title, '演示教材')

  // 用户同 id 覆盖内置
  await store.saveBook({ ...makeBundledBook('bundled-book', '用户覆盖同名'), title: '用户覆盖同名' })
  books = await store.listBooks()
  const overridden = books.find((book) => book.id === 'bundled-book')
  assert.equal(overridden.title, '用户覆盖同名')
  assert.equal(overridden.source, 'user')

  // 删除用户副本 → 回落到内置
  const deleted = await store.deleteBook('bundled-book')
  assert.equal(deleted.deleted, true)
  books = await store.listBooks()
  const restored = books.find((book) => book.id === 'bundled-book')
  assert.equal(restored.title, '内置演示书')
  assert.equal(restored.source, 'bundled')

  // 内置书不可删；不存在的书报「未找到」
  await assert.rejects(() => store.deleteBook('bundled-book'), /内置示例/)
  await assert.rejects(() => store.deleteBook('no-such-book'), /未找到/)
  await assert.rejects(() => store.deleteBook('Bad_ID'), /不合法/)
})

test('store：saveChapter 用章文件实际内容同步 book.json 的 pointCount 与 stats', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const store = createStore({ dataDir, bundledDir })
  await store.saveBook(makeBook())

  // 让 1.1 节有 3 个知识点（book 骨架里写的是 2）
  const chapter = makeChapter(1)
  chapter.sections[0].points.push(makePoint('1.1.3', '1.1 知识点三'))
  const saved = await store.saveChapter('demo-book', chapter)
  assert.equal(saved.chapterStats.points, 5)

  const book = await store.getBook('demo-book')
  assert.equal(book.chapters[0].sections[0].pointCount, 3)
  assert.equal(book.chapters[0].sections[1].pointCount, 2)
  // 1 章实际 5 点 + 第 2 章按骨架估算 4 点
  assert.deepEqual(book.stats, { chapters: 2, sections: 4, points: 9 })

  // 章文件存在后，save_book 校验必须对齐 pointCount；对齐后 stats 按实际重算
  const mismatchBook = makeBook()
  await assert.rejects(
    () => store.saveBook({ ...mismatchBook, stats: { chapters: 2, sections: 4, points: 8 } }),
    /pointCount/,
  )
  const aligned = makeBook()
  aligned.chapters[0].sections[0].pointCount = 3
  aligned.stats = { chapters: 2, sections: 4, points: 999 }
  const result = await store.saveBook(aligned)
  assert.deepEqual(result.stats, { chapters: 2, sections: 4, points: 9 })
})

test('store v1.1：saveBook/saveChapter 保留新字段与未知字段（normalize 不删字段）', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const store = createStore({ dataDir, bundledDir })

  // book.json：overview.analogy、章 analogy、未知字段全部原样保留
  const book = makeEnrichedBook()
  book.unknownTop = { keep: true }
  book.overview.unknownOverview = 'keep-overview-unknown'
  await store.saveBook(book)

  const storedBook = await store.getBook('demo-book')
  assert.equal(storedBook.overview.analogy, book.overview.analogy)
  assert.equal(storedBook.chapters[0].analogy, book.chapters[0].analogy)
  assert.deepEqual(storedBook.unknownTop, { keep: true })
  assert.equal(storedBook.overview.unknownOverview, 'keep-overview-unknown')

  // chapter 文件：章 analogy、节 summary/analogy/examples、点 analogy、未知字段全部保留
  const chapter = makeEnrichedChapter(1)
  chapter.unknownChapter = 'keep-chapter-unknown'
  chapter.sections[0].unknownSection = 'keep-section-unknown'
  chapter.sections[0].points[0].unknownPoint = { keep: true }
  await store.saveChapter('demo-book', chapter)

  const storedChapter = await store.getChapter('demo-book', 'ch01')
  assert.equal(storedChapter.analogy, chapter.analogy)
  assert.equal(storedChapter.sections[0].summary, chapter.sections[0].summary)
  assert.equal(storedChapter.sections[0].analogy, chapter.sections[0].analogy)
  assert.deepEqual(storedChapter.sections[0].examples, chapter.sections[0].examples)
  assert.equal(storedChapter.sections[0].points[0].analogy, chapter.sections[0].points[0].analogy)
  assert.equal(storedChapter.unknownChapter, 'keep-chapter-unknown')
  assert.equal(storedChapter.sections[0].unknownSection, 'keep-section-unknown')
  assert.deepEqual(storedChapter.sections[0].points[0].unknownPoint, { keep: true })

  // 磁盘上的 JSON 也必须保留新字段/未知字段（不是只在内存里）
  const rawChapter = JSON.parse(await fs.readFile(path.join(dataDir, 'books', 'demo-book', 'chapters', 'ch01.json'), 'utf8'))
  assert.equal(rawChapter.sections[0].summary, chapter.sections[0].summary)
  assert.equal(rawChapter.sections[0].examples.length, 4)
  assert.deepEqual(rawChapter.sections[0].points[0].unknownPoint, { keep: true })

  // 已存在章文件时再次 save_book：跨文件 pointCount 校验不受新字段影响，stats 按实际重算
  const refreshed = makeEnrichedBook()
  const reSave = await store.saveBook(refreshed)
  assert.deepEqual(reSave.stats, { chapters: 2, sections: 4, points: 8 })
  const rawBook = JSON.parse(await fs.readFile(path.join(dataDir, 'books', 'demo-book', 'book.json'), 'utf8'))
  assert.equal(rawBook.overview.analogy, refreshed.overview.analogy)
  assert.equal(rawBook.chapters[0].analogy, refreshed.chapters[0].analogy)

  // 路由原样返回新字段（Host 只读路由不需要为 v1.1 改代码）
  const handler = createRoutes(store, () => ({}))
  const chapterResponse = await request(handler, 'GET', `${API_PREFIX}/books/demo-book/chapters/ch01`)
  assert.equal(chapterResponse.res.statusCode, 200)
  assert.equal(chapterResponse.json.chapter.analogy, chapter.analogy)
  assert.equal(chapterResponse.json.chapter.sections[0].summary, chapter.sections[0].summary)
  assert.equal(chapterResponse.json.chapter.sections[0].examples.length, 4)
  assert.equal(chapterResponse.json.chapter.sections[0].points[0].analogy, chapter.sections[0].points[0].analogy)
  const bookResponse = await request(handler, 'GET', `${API_PREFIX}/books/demo-book`)
  assert.equal(bookResponse.res.statusCode, 200)
  assert.equal(bookResponse.json.book.overview.analogy, refreshed.overview.analogy)
  assert.equal(bookResponse.json.book.chapters[0].analogy, refreshed.chapters[0].analogy)
})

test('store v1.2：saveChapter 保留详解/星标字段与未知字段；短 detail 只告警不阻断', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const store = createStore({ dataDir, bundledDir })
  await store.saveBook(makeEnrichedBook())

  // 正常 detail（≥50 字）：保存成功且无告警；新字段与未知字段都落盘保留
  const chapter = makeDeepChapter(1)
  chapter.unknownChapterV12 = 'keep-chapter-v12'
  chapter.sections[0].points[0].unknownPointV12 = { keep: true }
  const saved = await store.saveChapter('demo-book', chapter)
  assert.deepEqual(saved.warnings, [])
  assert.equal(saved.chapterId, 'ch01')

  const stored = await store.getChapter('demo-book', 'ch01')
  const storedPoint = stored.sections[0].points[0]
  assert.equal(storedPoint.important, true)
  assert.equal(storedPoint.detail, chapter.sections[0].points[0].detail)
  assert.deepEqual(storedPoint.keyPoints, chapter.sections[0].points[0].keyPoints)
  assert.equal(storedPoint.derivation, chapter.sections[0].points[0].derivation)
  assert.equal(storedPoint.mistakes, chapter.sections[0].points[0].mistakes)
  assert.equal(storedPoint.examTips, chapter.sections[0].points[0].examTips)
  assert.equal(stored.sections[0].points[1].important, false)
  assert.equal(stored.unknownChapterV12, 'keep-chapter-v12')
  assert.deepEqual(storedPoint.unknownPointV12, { keep: true })

  const rawChapter = JSON.parse(await fs.readFile(path.join(dataDir, 'books', 'demo-book', 'chapters', 'ch01.json'), 'utf8'))
  assert.equal(rawChapter.sections[0].points[0].important, true)
  assert.equal(rawChapter.sections[0].points[0].detail, chapter.sections[0].points[0].detail)
  assert.deepEqual(rawChapter.sections[0].points[0].unknownPointV12, { keep: true })

  // 路由原样返回 v1.2 字段（Host 路由无需改动）
  const handler = createRoutes(store, () => ({}))
  const chapterResponse = await request(handler, 'GET', `${API_PREFIX}/books/demo-book/chapters/ch01`)
  assert.equal(chapterResponse.res.statusCode, 200)
  const routedPoint = chapterResponse.json.chapter.sections[0].points[0]
  assert.equal(routedPoint.important, true)
  assert.equal(routedPoint.detail.length, chapter.sections[0].points[0].detail.length)
  assert.equal(routedPoint.keyPoints.length, 3)

  // 短 detail：只告警不阻断；console.warn 有提示，文件照常写入
  const shortChapter = makeDeepChapter(1)
  shortChapter.sections[0].points[1].detail = '太短，仅演示告警。'
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args.map(String).join(' '))
  }
  try {
    const savedShort = await store.saveChapter('demo-book', shortChapter)
    assert.ok(Array.isArray(savedShort.warnings) && savedShort.warnings.length >= 1, '应返回 warnings')
    assert.ok(savedShort.warnings.some((item) => item.includes('detail') && item.includes('建议')))
  } finally {
    console.warn = originalWarn
  }
  assert.ok(warnings.some((text) => text.includes('[textbook-parser]') && text.includes('校验提示')), 'console.warn 应记录提示')
  assert.ok(warnings.some((text) => text.includes('detail')))
  const shortStored = await store.getChapter('demo-book', 'ch01')
  assert.equal(shortStored.sections[0].points[1].detail, shortChapter.sections[0].points[1].detail, '短 detail 仍然写入')

  // 已有章文件后再次 save_book：跨文件 pointCount/stats 不受 v1.2 字段影响
  const reSave = await store.saveBook(makeEnrichedBook())
  assert.deepEqual(reSave.stats, { chapters: 2, sections: 4, points: 8 })
})

test('store：内置书只读但允许写入用户章覆盖；listBooks 容忍损坏的 book.json', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const bundled = makeBundledBook('bundled-book', '内置演示书')
  await writeJson(path.join(bundledDir, 'books', 'bundled-book', 'book.json'), bundled)
  await writeJson(path.join(bundledDir, 'books', 'bundled-book', 'chapters', 'ch01.json'), makeChapter(1))

  const store = createStore({ dataDir, bundledDir })
  const result = await store.saveChapter('bundled-book', makeChapter(1))
  assert.equal(result.bookUpdated, false) // 内置 book.json 不复制、不改写
  assert.deepEqual(result.stats, { chapters: 1, sections: 2, points: 4 })
  const userChapterFile = path.join(dataDir, 'books', 'bundled-book', 'chapters', 'ch01.json')
  assert.equal(JSON.parse(await fs.readFile(userChapterFile, 'utf8')).id, 'ch01')
  // 用户章覆盖内置章
  const chapter = await store.getChapter('bundled-book', 'ch01')
  assert.equal(chapter.sections.length, 2)

  // 损坏的 book.json 不影响其它书列表
  await fs.mkdir(path.join(dataDir, 'books', 'broken-book'), { recursive: true })
  await fs.writeFile(path.join(dataDir, 'books', 'broken-book', 'book.json'), '{ not json', 'utf8')
  const books = await store.listBooks()
  assert.ok(books.some((book) => book.id === 'bundled-book'))
  assert.ok(!books.some((book) => book.id === 'broken-book'))

  // 直接读损坏书 → 抛带文件名的 JSON 解析错误
  await assert.rejects(() => store.getBook('broken-book'), /JSON 解析失败/)
})

// ---------------------------------------------------------------------------
// 4. routes.js
// ---------------------------------------------------------------------------

test('routes：health/books/book/chapter 返回 JSON + no-store，404/405 正确', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const bundled = makeBundledBook('bundled-book', '内置演示书')
  await writeJson(path.join(bundledDir, 'books', 'bundled-book', 'book.json'), bundled)
  const store = createStore({ dataDir, bundledDir })
  await store.saveBook(makeBook())
  await store.saveChapter('demo-book', makeChapter(1))

  const handler = createRoutes(store, () => ({ skillRegistered: true, toolRegistered: true, routesRegistered: true }), {
    version: '9.9.9',
  })

  const health = await request(handler, 'GET', `${API_PREFIX}/health`)
  assert.equal(health.res.statusCode, 200)
  assert.equal(health.res.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(health.res.headers['cache-control'], 'no-store')
  assert.equal(health.json.ok, true)
  assert.equal(health.json.plugin, 'dsh-textbook-parser')
  assert.equal(health.json.version, '9.9.9')
  assert.equal(health.json.skillRegistered, true)
  assert.equal(health.json.toolRegistered, true)
  assert.equal(health.json.dataDir, dataDir)
  assert.equal(health.json.books, 2)

  const books = await request(handler, 'GET', `${API_PREFIX}/books`)
  assert.equal(books.res.statusCode, 200)
  assert.equal(books.json.ok, true)
  assert.equal(books.json.books.length, 2)

  const book = await request(handler, 'GET', `${API_PREFIX}/books/demo-book`)
  assert.equal(book.res.statusCode, 200)
  assert.equal(book.json.book.id, 'demo-book')
  assert.equal(book.json.book.source, 'user')
  assert.equal(book.json.book.chapters.length, 2)

  const chapter = await request(handler, 'GET', `${API_PREFIX}/books/demo-book/chapters/ch01`)
  assert.equal(chapter.res.statusCode, 200)
  assert.equal(chapter.json.chapter.id, 'ch01')

  const missingBook = await request(handler, 'GET', `${API_PREFIX}/books/nope-book`)
  assert.equal(missingBook.res.statusCode, 404)
  assert.equal(missingBook.json.ok, false)
  assert.match(missingBook.json.error, /未找到教材/)

  const missingChapter = await request(handler, 'GET', `${API_PREFIX}/books/demo-book/chapters/ch09`)
  assert.equal(missingChapter.res.statusCode, 404)
  assert.equal(missingChapter.json.ok, false)

  const missingChapterFile = await request(handler, 'GET', `${API_PREFIX}/books/demo-book/chapters/ch02`)
  assert.equal(missingChapterFile.res.statusCode, 404)

  const methodNotAllowed = await request(handler, 'POST', `${API_PREFIX}/health`)
  assert.equal(methodNotAllowed.res.statusCode, 405)
  assert.equal(methodNotAllowed.res.headers.allow, 'GET, HEAD')
  assert.equal(methodNotAllowed.json.ok, false)

  const unknown = await request(handler, 'GET', `${API_PREFIX}/anything/else`)
  assert.equal(unknown.res.statusCode, 404)
  assert.match(unknown.json.error, /未知接口|可用接口/)

  const badEncoding = await request(handler, 'GET', `${API_PREFIX}/%E0%A4%A`)
  assert.equal(badEncoding.res.statusCode, 400)

  const head = await request(handler, 'HEAD', `${API_PREFIX}/health`)
  assert.equal(head.res.statusCode, 200)
  assert.equal(head.res.body, '')
})

test('routes：数据损坏时 500 且不向响应泄漏堆栈', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  await fs.mkdir(path.join(dataDir, 'books', 'broken-book'), { recursive: true })
  await fs.writeFile(path.join(dataDir, 'books', 'broken-book', 'book.json'), '{ broken json', 'utf8')
  const store = createStore({ dataDir, bundledDir })
  const handler = createRoutes(store, () => ({}))
  const response = await request(handler, 'GET', `${API_PREFIX}/books/broken-book`)
  assert.equal(response.res.statusCode, 500)
  assert.equal(response.json.ok, false)
  assert.match(response.json.error, /JSON 解析失败/)
  assert.ok(!/\n\s+at /.test(response.json.error), '响应不应包含堆栈')
  assert.ok(!response.json.error.includes('stack'))
})

// ---------------------------------------------------------------------------
// 5. tool.js：textbook_archive
// ---------------------------------------------------------------------------

test('tool：definition 结构符合当前 ToolDefinition（名称/参数/output）', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const tool = createTool(createStore({ dataDir, bundledDir }))
  assert.equal(tool.name, 'textbook_archive')
  assert.equal(typeof tool.description, 'string')
  assert.ok(tool.description.length > 80)
  assert.match(tool.description, /save_book/)
  assert.deepEqual(tool.parameters.required, ['action'])
  assert.deepEqual(tool.parameters.properties.action.enum, ['save_book', 'save_chapter', 'list_books', 'get_book', 'delete_book'])
  assert.equal(tool.parameters.additionalProperties, false)
  assert.equal(typeof tool.execute, 'function')
  assert.equal(tool.output.schema.type, 'object')
  assert.equal(tool.output.schema.additionalProperties, true)
  assert.equal(typeof tool.output.render, 'function')
  assert.equal(tool.isConcurrencySafe(), false)

  const args = { action: 'list_books' }
  const value = await tool.execute(args)
  const blocks = tool.output.render(args, value)
  assert.ok(Array.isArray(blocks))
  assert.ok(blocks.length >= 1 && blocks.length <= 3)
  for (const block of blocks) {
    assert.equal(block.type, 'text')
    assert.equal(typeof block.text, 'string')
    assert.ok(block.text.length > 0)
  }
  assert.ok(blocks.some((block) => block.text.includes('暂无教材')))
})

test('tool：save_book → save_chapter → list_books → get_book → delete_book 全链路与中文摘要', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const store = createStore({ dataDir, bundledDir })
  const tool = createTool(store)

  const saveBookValue = await tool.execute({ action: 'save_book', book: makeBook() })
  assert.equal(saveBookValue.ok, true)
  assert.equal(saveBookValue.action, 'save_book')
  assert.equal(saveBookValue.bookId, 'demo-book')
  assert.equal(saveBookValue.chapterCount, 2)
  assert.equal(saveBookValue.path, path.join(dataDir, 'books', 'demo-book', 'book.json'))
  const saveBookBlocks = tool.output.render({ action: 'save_book' }, saveBookValue)
  assert.ok(saveBookBlocks.length >= 1 && saveBookBlocks.length <= 3)
  assert.ok(saveBookBlocks[0].text.includes('已保存'))
  assert.ok(saveBookBlocks[0].text.includes('演示教材'))
  assert.ok(saveBookBlocks.some((block) => block.text.includes('save_chapter')))

  const chapter = makeChapter(1)
  const saveChapterValue = await tool.execute({ action: 'save_chapter', bookId: 'demo-book', chapter })
  assert.equal(saveChapterValue.ok, true)
  assert.equal(saveChapterValue.chapterId, 'ch01')
  assert.equal(saveChapterValue.sections, 2)
  assert.equal(saveChapterValue.points, 4)
  assert.deepEqual(saveChapterValue.stats, { chapters: 2, sections: 4, points: 8 })
  const saveChapterBlocks = tool.output.render({ action: 'save_chapter', chapter }, saveChapterValue)
  assert.ok(saveChapterBlocks[0].text.includes('已保存第 1 章'))
  assert.ok(saveChapterBlocks.some((block) => block.text.includes('全书进度')))

  const listValue = await tool.execute({ action: 'list_books' })
  assert.equal(listValue.count, 1)
  assert.equal(listValue.books[0].source, 'user')
  const listBlocks = tool.output.render({ action: 'list_books' }, listValue)
  assert.ok(listBlocks.some((block) => block.text.includes('共 1 本教材')))
  assert.ok(listBlocks.some((block) => block.text.includes('id=demo-book')))

  const getValue = await tool.execute({ action: 'get_book', bookId: 'demo-book' })
  assert.equal(getValue.ok, true)
  assert.equal(getValue.book.chapters.length, 2)
  assert.equal(getValue.chapter, undefined)

  const getChapterValue = await tool.execute({ action: 'get_book', bookId: 'demo-book', chapterId: 'ch01' })
  assert.equal(getChapterValue.chapter.id, 'ch01')
  const getBlocks = tool.output.render({ action: 'get_book', bookId: 'demo-book' }, getChapterValue)
  assert.ok(getBlocks.length >= 1 && getBlocks.length <= 3)
  assert.ok(getBlocks.some((block) => block.text.includes('章 ch01')))

  const deleteValue = await tool.execute({ action: 'delete_book', bookId: 'demo-book' })
  assert.equal(deleteValue.ok, true)
  assert.equal(deleteValue.deleted, true)
  const deleteBlocks = tool.output.render({ action: 'delete_book' }, deleteValue)
  assert.ok(deleteBlocks[0].text.includes('已删除'))

  const afterDelete = await store.listBooks()
  assert.equal(afterDelete.length, 0)
})

test('tool：校验失败 / 参数缺失 / 未知 action 给出可执行的中文错误', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const tool = createTool(createStore({ dataDir, bundledDir }))

  await assert.rejects(() => tool.execute({ action: 'save_book', book: makeBook({ id: 'Bad_ID' }) }), /校验未通过/)
  await assert.rejects(() => tool.execute({ action: 'save_book', book: null }), /book 参数/)
  await assert.rejects(() => tool.execute({ action: 'save_book', book: makeBook(), bookId: 'other-book' }), /不一致/)
  await assert.rejects(() => tool.execute({ action: 'save_chapter', chapter: makeChapter(1) }), /bookId/)
  await assert.rejects(
    () => tool.execute({ action: 'save_chapter', bookId: 'demo-book', chapter: makeChapter(1) }),
    /未找到 bookId|请先调用 textbook_archive/,
  )
  await tool.execute({ action: 'save_book', book: makeBook() })
  const broken = makeChapter(1)
  broken.sections[0].points[0].solves = ''
  await assert.rejects(() => tool.execute({ action: 'save_chapter', bookId: 'demo-book', chapter: broken }), /校验未通过/)
  await assert.rejects(() => tool.execute({ action: 'get_book' }), /bookId/)
  await assert.rejects(() => tool.execute({ action: 'get_book', bookId: 'nope' }), /未找到教材/)
  await assert.rejects(() => tool.execute({ action: 'get_book', bookId: 'demo-book', chapterId: 'ch01' }), /没有章/)
  await assert.rejects(() => tool.execute({ action: 'delete_book' }), /bookId/)
  const deletedUserBook = await tool.execute({ action: 'delete_book', bookId: 'demo-book' })
  assert.equal(deletedUserBook.deleted, true)
  await assert.rejects(() => tool.execute({ action: 'delete_book', bookId: 'demo-book' }), /未找到/)
  await assert.rejects(() => tool.execute({ action: 'explode' }), /未知 action/)
  await assert.rejects(() => tool.execute(null), /JSON 对象/)

  // render 对未知/缺失 value 也必须安全返回 text block
  const safeBlocks = tool.output.render({ action: 'unknown' }, {})
  assert.ok(Array.isArray(safeBlocks) && safeBlocks.length >= 1)
  assert.equal(safeBlocks[0].type, 'text')
})

// ---------------------------------------------------------------------------
// 6. skill.js
// ---------------------------------------------------------------------------

test('skill：解析真实 SKILL.md，注册参数符合 ctx.skills.register 契约', async () => {
  const registration = buildSkillRegistration(PKG_DIR)
  assert.equal(registration.name, 'textbook-parser')
  assert.match(registration.description, /问题驱动迭代/)
  assert.match(registration.description, /理工科教材拆解/)
  assert.match(registration.whenToUse, /梳理课本|教材/)
  assert.ok(registration.content.length > 2000)
  assert.match(registration.content, /textbook_archive/)
  assert.match(registration.content, /问题驱动/)
  assert.equal(registration.path, resolveSkillFile(PKG_DIR))
  assert.equal(registration.source, 'custom')
  assert.equal(registration.provider, 'textbook-parser')
  assert.deepEqual(registration.resourceBase, { kind: 'directory', path: path.join(PKG_DIR, 'skills', 'textbook-parser') })
  assert.deepEqual(registration.invocation, { modelInvocable: true, userInvocable: true })

  // 资源目录与 schema 参考确实存在
  await fs.access(path.join(registration.resourceBase.path, 'references', 'schema.md'))
})

test('skill：frontmatter 解析（引号、trigger 兼容、无 frontmatter）与读取失败', async () => {
  const parsed = parseFrontmatter('---\nname: demo\ndescription: "含: 冒号的描述"\nwhenToUse: \'单引号触发\'\ntrigger: 兼容触发\n---\n\n# 正文\n内容')
  assert.equal(parsed.meta.name, 'demo')
  assert.equal(parsed.meta.description, '含: 冒号的描述')
  assert.equal(parsed.meta.whenToUse, '单引号触发')
  assert.equal(parsed.meta.trigger, '兼容触发')
  assert.equal(parsed.body, '# 正文\n内容')

  const noFrontmatter = parseFrontmatter('# 只有正文\n没有 frontmatter')
  assert.deepEqual(noFrontmatter.meta, {})
  assert.equal(noFrontmatter.body, '# 只有正文\n没有 frontmatter')

  const { root } = await freshDirs()
  assert.throws(() => buildSkillRegistration(root), /读取 skill 正文失败/)

  const skillDir = path.join(root, 'skills', 'textbook-parser')
  await fs.mkdir(skillDir, { recursive: true })
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: demo\n---\n\n', 'utf8')
  assert.throws(() => buildSkillRegistration(root), /正文为空/)

  const { ctx, calls } = makeMockCtx()
  const disposer = registerSkill(ctx, { pkgDir: PKG_DIR })
  assert.equal(typeof disposer, 'function')
  assert.equal(calls.skills.length, 1)
  assert.equal(calls.skills[0].name, 'textbook-parser')
})

test('skill：SKILL.md 里的 json 示例可解析，且能通过 validateBook / validateChapter', async () => {
  const raw = await fs.readFile(path.join(PKG_DIR, 'skills', 'textbook-parser', 'SKILL.md'), 'utf8')
  const blocks = [...raw.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((match) => match[1].trim())
  assert.ok(blocks.length >= 2, `SKILL.md 应至少包含 2 个 json 示例代码块，实际 ${blocks.length}`)

  const parsed = blocks.map((code, index) => {
    try {
      return JSON.parse(code)
    } catch (error) {
      assert.fail(`SKILL.md 第 ${index + 1} 个 json 示例解析失败：${error.message}`)
      return null
    }
  })
  const bookExample = parsed.find((value) => value && value.schemaVersion === 1 && Array.isArray(value.chapters) && value.overview)
  const chapterExample = parsed.find((value) => value && typeof value.id === 'string' && Array.isArray(value.sections) && value.schemaVersion === undefined)
  assert.ok(bookExample, 'SKILL.md 缺少 book.json 示例')
  assert.ok(chapterExample, 'SKILL.md 缺少 chapter 示例')

  const bookResult = validateBook(bookExample)
  assert.equal(bookResult.ok, true, `SKILL.md 的 book 示例校验失败：${JSON.stringify(bookResult.errors)}`)
  const chapterResult = validateChapter(chapterExample, { book: bookExample })
  assert.equal(chapterResult.ok, true, `SKILL.md 的 chapter 示例校验失败：${JSON.stringify(chapterResult.errors)}`)

  // v1.1：示例必须展示新字段（analogy / summary / examples），否则模型会漏写
  assert.ok(typeof bookExample.overview.analogy === 'string' && bookExample.overview.analogy.length > 10, 'book 示例缺 overview.analogy')
  assert.ok(bookExample.chapters.every((chapter) => typeof chapter.analogy === 'string' && chapter.analogy.length > 10), 'book 示例缺 chapter.analogy')
  assert.ok(typeof chapterExample.analogy === 'string' && chapterExample.analogy.length > 10, 'chapter 示例缺 analogy')
  const exampleSection = chapterExample.sections[0]
  assert.ok(typeof exampleSection.summary === 'string' && exampleSection.summary.includes('\n'), 'chapter 示例的 summary 应为多行汇总')
  assert.ok(typeof exampleSection.analogy === 'string' && exampleSection.analogy.length > 10, 'chapter 示例缺 section.analogy')
  assert.ok(Array.isArray(exampleSection.examples) && exampleSection.examples.length >= 3, 'chapter 示例的 examples 至少 3 道')
  assert.ok(
    exampleSection.examples.every((item) => typeof item.type === 'string' && typeof item.question === 'string' && typeof item.answer === 'string'),
    'chapter 示例的 examples 项必须含 type/question/answer',
  )
  assert.ok(
    new Set(exampleSection.examples.map((item) => item.type)).size >= 3,
    'chapter 示例的 examples 应覆盖至少 3 类题型',
  )
  assert.ok(
    exampleSection.points.every((point) => typeof point.analogy === 'string' && point.analogy.length > 10),
    'chapter 示例的知识点缺 analogy',
  )

  // v1.2：示例必须展示 important/detail/keyPoints/derivation/mistakes/examTips，且重要的比例/字段长度符合 skill 要求
  for (const point of exampleSection.points) {
    assert.equal(typeof point.important, 'boolean', `chapter 示例知识点 ${point.id} 缺 boolean important`)
    assert.ok(typeof point.detail === 'string' && point.detail.length >= 350, `chapter 示例知识点 ${point.id} 的 detail 应 ≥350 字`)
    assert.ok(Array.isArray(point.keyPoints) && point.keyPoints.length >= 3 && point.keyPoints.length <= 6, `chapter 示例知识点 ${point.id} 的 keyPoints 应为 3-6 条`)
    assert.ok(point.keyPoints.every((item) => typeof item === 'string' && item.trim().length > 0), 'keyPoints 每项必须是非空字符串')
    assert.equal(typeof point.derivation, 'string', 'derivation 必须是字符串（可为 ""）')
    assert.ok(typeof point.mistakes === 'string' && point.mistakes.length > 0, 'mistakes 必须是非空字符串')
    assert.ok(typeof point.examTips === 'string' && point.examTips.length > 0, 'examTips 必须是非空字符串')
  }
  assert.ok(
    exampleSection.points.some((point) => point.important === true),
    '每节至少应有 1 个 important: true 的重点知识点',
  )

  // 文档同步：schema.md / README 必须提到 v1.1/v1.2 新字段与能力
  const schemaDoc = await fs.readFile(path.join(PKG_DIR, 'skills', 'textbook-parser', 'references', 'schema.md'), 'utf8')
  for (const field of ['overview.analogy', 'summary', 'examples', 'analogy', 'schemaVersion', 'important', 'detail', 'keyPoints', 'derivation', 'mistakes', 'examTips']) {
    assert.ok(schemaDoc.includes(field), `references/schema.md 缺少字段说明：${field}`)
  }
  const skillDoc = await fs.readFile(path.join(PKG_DIR, 'skills', 'textbook-parser', 'SKILL.md'), 'utf8')
  for (const keyword of ['important', 'detail', 'keyPoints', 'derivation', 'mistakes', 'examTips', '30%', '45%', '★']) {
    assert.ok(skillDoc.includes(keyword), `SKILL.md 缺少 v1.2 要求：${keyword}`)
  }
  const readme = await fs.readFile(path.join(PKG_DIR, 'README.md'), 'utf8')
  for (const keyword of ['生活类比', '知识点汇总', '多题型', '导出', 'Word', 'PDF', 'v1.2', '星标', '详细讲解', '学习要点', '交互式', '易错辨析', '考试·应用提示']) {
    assert.ok(readme.includes(keyword), `README.md 缺少 v1.2 功能说明：${keyword}`)
  }
})

// ---------------------------------------------------------------------------
// 7. index.js：apply 装配 + 容错
// ---------------------------------------------------------------------------

test('apply：mock ctx 下注册 routes/tool/skill，health 反映注册状态', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const { ctx, calls } = makeMockCtx()
  assert.equal(apply(ctx, { dataDir, bundledDir }), undefined, 'apply 不应返回非标准值')

  assert.equal(calls.effects.length, 3)
  assert.equal(calls.webServer.length, 1)
  assert.equal(calls.tools.length, 1)
  assert.equal(calls.skills.length, 1)
  assert.equal(calls.webServer[0].kind, 'prefix')
  assert.equal(calls.webServer[0].path, '/dsh-textbook-parser/api')
  assert.equal(typeof calls.webServer[0].handler, 'function')
  assert.equal(calls.tools[0].name, 'textbook_archive')

  // 路由可用，health 已反映 skill/tool 注册状态
  const health = await request(calls.webServer[0].handler, 'GET', `${API_PREFIX}/health`)
  assert.equal(health.res.statusCode, 200)
  assert.equal(health.json.ok, true)
  assert.equal(health.json.dataDir, dataDir)
  assert.equal(health.json.skillRegistered, true)
  assert.equal(health.json.toolRegistered, true)
  assert.equal(health.json.routesRegistered, true)
  assert.equal(health.json.books, 0)

  // 注册的 tool 已接到同一个 store 上
  const listValue = await calls.tools[0].execute({ action: 'list_books' })
  assert.equal(listValue.ok, true)
  assert.equal(listValue.count, 0)
})

test('apply：webServer 缺失时仍注册 tool/skill，不抛错', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const { ctx, calls } = makeMockCtx({ webServer: null })
  assert.doesNotThrow(() => apply(ctx, { dataDir, bundledDir }))
  assert.equal(calls.webServer.length, 0)
  assert.equal(calls.tools.length, 1)
  assert.equal(calls.skills.length, 1)
})

test('apply：单个注册抛错时其它部分继续（routes/tool/skill 各自独立容错）', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const config = { dataDir, bundledDir }

  const webFail = makeMockCtx({ throwWebServer: true })
  assert.doesNotThrow(() => apply(webFail.ctx, config))
  assert.equal(webFail.calls.webServer.length, 0)
  assert.equal(webFail.calls.tools.length, 1)
  assert.equal(webFail.calls.skills.length, 1)

  const toolFail = makeMockCtx({ throwTools: true })
  assert.doesNotThrow(() => apply(toolFail.ctx, config))
  assert.equal(toolFail.calls.webServer.length, 1)
  assert.equal(toolFail.calls.tools.length, 0)
  assert.equal(toolFail.calls.skills.length, 1)

  const skillFail = makeMockCtx({ throwSkills: true })
  assert.doesNotThrow(() => apply(skillFail.ctx, config))
  assert.equal(skillFail.calls.webServer.length, 1)
  assert.equal(skillFail.calls.tools.length, 1)
  assert.equal(skillFail.calls.skills.length, 0)

  const missingAll = makeMockCtx({ skills: null, tools: null, webServer: null })
  assert.doesNotThrow(() => apply(missingAll.ctx, config))
  assert.equal(missingAll.calls.webServer.length, 0)
  assert.equal(missingAll.calls.tools.length, 0)
  assert.equal(missingAll.calls.skills.length, 0)
})

test('apply：store 初始化失败 / 空 ctx 都不抛错', async () => {
  const { ctx, calls } = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, { dataDir: 42 }))
  assert.equal(calls.effects.length, 0, '存储层失败时不应注册任何东西')

  const noServices = { get: () => undefined }
  assert.doesNotThrow(() => apply(noServices, {}))
})

// ---------------------------------------------------------------------------
// 8. 全链路：真实 JSON 走 save_book → save_chapter → listBooks → 路由读取
// ---------------------------------------------------------------------------

test('全链路：save_book → save_chapter(ch01,ch02) → listBooks → routes 读取', async () => {
  const { dataDir, bundledDir } = await freshDirs()
  const store = createStore({ dataDir, bundledDir })
  const tool = createTool(store)

  await tool.execute({ action: 'save_book', book: makeBook() })
  await tool.execute({ action: 'save_chapter', bookId: 'demo-book', chapter: makeChapter(1) })
  await tool.execute({ action: 'save_chapter', bookId: 'demo-book', chapter: makeChapter(2) })

  const books = await store.listBooks()
  assert.equal(books.length, 1)
  assert.equal(books[0].id, 'demo-book')
  assert.deepEqual(books[0].stats, { chapters: 2, sections: 4, points: 8 })

  const handler = createRoutes(store, () => ({}))
  const bookResponse = await request(handler, 'GET', `${API_PREFIX}/books/demo-book`)
  assert.equal(bookResponse.res.statusCode, 200)
  assert.equal(bookResponse.json.book.id, 'demo-book')
  assert.deepEqual(bookResponse.json.book.stats, { chapters: 2, sections: 4, points: 8 })
  assert.equal(bookResponse.json.book.chapters.length, 2)

  const chapterResponse = await request(handler, 'GET', `${API_PREFIX}/books/demo-book/chapters/ch02`)
  assert.equal(chapterResponse.res.statusCode, 200)
  assert.equal(chapterResponse.json.chapter.id, 'ch02')
  assert.equal(chapterResponse.json.chapter.sections.length, 2)
  assert.equal(chapterResponse.json.chapter.sections[0].points.length, 2)

  const health = await request(handler, 'GET', `${API_PREFIX}/health`)
  assert.equal(health.json.books, 1)

  // book.json 最终 stats 与实际一致
  const finalBook = await store.getBook('demo-book')
  assert.deepEqual(finalBook.stats, { chapters: 2, sections: 4, points: 8 })
  const allFiles = await fs.readdir(path.join(dataDir, 'books', 'demo-book', 'chapters'))
  assert.deepEqual(allFiles.sort(), ['ch01.json', 'ch02.json'])
})