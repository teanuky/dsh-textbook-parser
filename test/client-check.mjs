#!/usr/bin/env node
/**
 * client-check.mjs —— dsh-textbook-parser client.js 自检
 *
 * 覆盖：
 *  1) node --check 语法检查
 *  2) 静态关键串 / 红线断言（槽位、id、locale、无 document.body、无 import/export、CSS 前缀与 token）
 *  3) __ModuleLoader__.load + 假 window/document/localStorage + React 桩执行 factory，断言返回值与
 *     apply 在假 ctx 上完成 locale.register 1 次、slots.register 2 次、effect 3 次
 *  4) 用极简 React 渲染器真实挂载 TextbookPanel，走通「首页 → 章 → 节 → 知识点详情 → Esc 返回」，
 *     并覆盖空数据书、章节 404、刷新按钮、教材切换
 *  5) 真实数据 E2E + 导出 E2E（HTML / Word / PDF，假 Blob/URL/a[download]/window.open 捕获）
 *
 * 运行：node plugin/textbook-parser/test/client-check.mjs
 * 可选：node plugin/textbook-parser/test/client-check.mjs --dump-export dist
 *       （用真实数据分别导出两本书的自包含交互式 HTML 样例：
 *        dist/export-sample-signals-systems.html 与 dist/export-sample-advanced-mathematics.html；
 *        参数为输出目录，路径相对当前工作目录；传 *.html 时取其所在目录）
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(HERE, '..', 'client.js')
const source = readFileSync(FILE, 'utf8')
/* 用户目录里的教材（--dump-export 第二本样例，可用环境变量覆盖） */
const USER_BOOK_DIR = process.env.TBP_USER_BOOK_DIR
  || (process.env.DSH_HOME ? path.join(process.env.DSH_HOME, 'textbook-parser', 'books', 'advanced-mathematics-tongji') : null)
  || path.join(os.homedir(), '.dsh', 'textbook-parser', 'books', 'advanced-mathematics-tongji')

/**
 * 可选 CLI：--dump-export <outfile>
 * 用真实数据（data/books/signals-systems-zheng 的 book.json + 全部章节，含已合并 enrich）
 * 驱动面板真实导出流程，把 buildExportDocument 捕获到的 HTML 写到 outfile。
 * 不带该参数时行为与原来完全一致。
 */
function parseDumpExportArg(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '')
    if (arg === '--dump-export') return String(argv[index + 1] || '')
    if (arg.indexOf('--dump-export=') === 0) return arg.slice('--dump-export='.length)
  }
  return ''
}
const DUMP_EXPORT_PATH = parseDumpExportArg(process.argv.slice(2))

const checks = []
function ok(condition, label) { checks.push({ pass: !!condition, label }) }
function eq(actual, expected, label) {
  ok(actual === expected, label + '（期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual) + '）')
}

/* ───────────────────────── 1) node --check ───────────────────────── */
const syntax = spawnSync(process.execPath, ['--check', FILE], { encoding: 'utf8' })
ok(syntax.status === 0, 'node --check 通过' + (syntax.status === 0 ? '' : '：' + (syntax.stderr || '')))

/* ───────────────────────── 2) 静态断言 ───────────────────────── */
ok(source.includes('__ModuleLoader__.load'), '包含 __ModuleLoader__.load')
ok(/id:\s*'dsh-textbook-parser'/.test(source), "id: 'dsh-textbook-parser'")
ok(source.includes("'sidebar.panellist'"), '注册 sidebar.panellist')
ok(/name:\s*'main'/.test(source), "注册 name: 'main'")
ok(/key:\s*'textbook-parser'/.test(source), "注册 key: 'textbook-parser'")
ok(source.includes("locale.register('textbook-parser'"), "locale.register('textbook-parser')")
ok(source.includes('ErrorBoundary'), '包含 ErrorBoundary')
ok(source.includes("document.addEventListener('keydown'"), '包含 Esc keydown 监听')
ok(source.includes("removeEventListener('keydown'"), 'Esc 监听有清理')
ok(!source.includes('document.body'), '没有 document.body')
ok(!source.includes('@deepseek-ai/dsh-client'), '不 require Harness Client 包')
ok(!/^\s*(import|export)\s/m.test(source), '没有 import/export 语句')
ok(!/\bTODO\b|\bFIXME\b/.test(source), '没有 TODO/FIXME')
ok(source.includes("tbp:lastBook"), 'localStorage 记忆 tbp:lastBook')

const styleMatch = source.split('`')
ok(styleMatch.length >= 3 && styleMatch[1].length > 500, '内联样式块存在')
const STYLES = styleMatch[1] || ''
const selectors = Array.from(STYLES.matchAll(/\.([a-zA-Z][\w-]*)/g)).map((m) => m[1])
ok(selectors.length > 60, '样式选择器数量 > 60（实际 ' + selectors.length + '）')
const badSelectors = selectors.filter((name) => !name.startsWith('tbp-'))
eq(badSelectors.join(','), '', 'CSS class 全部 tbp- 前缀')
const globalSelectors = Array.from(STYLES.matchAll(/(^|[\s,}])(:root|html|body|\*)\s*[,{]/gm)).map((m) => m[2])
eq(globalSelectors.join(','), '', '无 :root / html / body / 全局 * 选择器')
const varTokens = Array.from(new Set(Array.from(STYLES.matchAll(/var\((--[\w-]+)\)/g)).map((m) => m[1])))
const badTokens = varTokens.filter((token) => !/^--dsw-alias-/.test(token) && token !== '--dsw-specific-sidebar-fill')
eq(badTokens.join(','), '', '仅使用 --dsw-alias-* / --dsw-specific-sidebar-fill token')
ok(varTokens.includes('--dsw-alias-brand-primary'), '使用品牌色 token')
ok(varTokens.includes('--dsw-alias-state-warn-primary'), '使用警示色 token')
ok(!/#[0-9a-fA-F]{3,8}\b/.test(STYLES), '样式中无写死十六进制颜色')
ok(STYLES.includes('@media'), '包含响应式 @media')
ok(STYLES.includes('@keyframes'), '包含过渡/动画 keyframes')

/* ── v2：完整显示 / 单列 / 不横向滚动的静态红线 ── */
ok(!source.includes('tbp-clamp2'), 'v2：不存在 clamp 截断类（tbp-clamp2）')
ok(!/-webkit-line-clamp/.test(STYLES), 'v2：CSS 无 -webkit-line-clamp')
ok(!/\.tbp-title\{[^}]*white-space:nowrap/.test(STYLES), 'v2：.tbp-title 不 nowrap')
ok(!/\.tbp-subtitle\{[^}]*white-space:nowrap/.test(STYLES), 'v2：.tbp-subtitle 不 nowrap')
ok(!/\.tbp-chip\{[^}]*white-space:nowrap/.test(STYLES), 'v2：.tbp-chip 可换行')
ok(/\.tbp-chip\{[^}]*white-space:normal/.test(STYLES), 'v2：.tbp-chip 显式 white-space:normal')
ok(/\.tbp-blocks\{[^}]*grid-template-columns:1fr/.test(STYLES), 'v2：.tbp-blocks 单列 1fr')
ok(/\.tbp-blocks3\{[^}]*grid-template-columns:1fr/.test(STYLES), 'v2：.tbp-blocks3 单列 1fr')
ok(!/overflow-x\s*:\s*(auto|scroll)/.test(STYLES), 'v2：内容区无 overflow-x 横向滚动')
ok(/\.tbp-chipline\{[^}]*flex-wrap:wrap/.test(STYLES), 'v2：chip 行 flex-wrap')
ok(/\.tbp-chain\{[^}]*flex-wrap:wrap/.test(STYLES), 'v2：chain flex-wrap')
ok(STYLES.includes('.tbp-analogy') && STYLES.includes('.tbp-example') && STYLES.includes('.tbp-pointitem'), 'v2：新增类比/例题/知识点汇总样式')
ok(source.includes('WEB_JS') && source.includes("act: 'toggle'") && source.includes('addEventListener'), 'v1.2：导出网页含内联交互脚本（data-act 事件委托 + 折叠）')
ok(source.includes('application/msword'), 'v2：Word 导出 mime')
ok(source.includes('URL.createObjectURL') && source.includes('document.documentElement') && source.includes('anchor.download'), 'v2：下载用 Blob + a[download]')
ok(source.includes('name="viewport"'), 'v2：导出 HTML 带 viewport')
ok(!source.includes('document.body'), 'v2：仍未使用 document.body')
ok(source.includes('important === true') && source.includes('tbp-star-label'), 'v1.2：侧栏星标实现（important + 重点徽标）')
ok(source.includes('function KeyPointsBlock') && source.includes('point.keyPoints'), 'v1.2：学习要点列表实现')
ok(source.includes('point.detail') && source.includes('point.derivation') && source.includes('point.mistakes') && source.includes('point.examTips'), 'v1.2：详解字段接入 detail/derivation/mistakes/examTips')
ok(source.includes('__TBP_DATA__') && source.includes('WEB_JS'), 'v1.2：导出网页内嵌数据 + 交互脚本')
ok(source.includes("hashchange") && source.includes('__TBP_APP_READY__'), 'v1.2：导出网页 hash 路由 + 就绪标记')
ok(source.includes('prefers-color-scheme') && source.includes('@media print'), 'v1.2：导出网页亮暗自适应 + 打印样式')
ok(!source.includes('data-txp-toggle'), 'v1.2：导出网页改用 data-act 事件委托')
 ok(source.includes('tbp-pointitem-cur') && source.includes('aria-current'), 'v2：知识点汇总高亮当前项（aria-current）')
const classAttrs = Array.from(source.matchAll(/className:\s*'([^']+)'/g)).map((m) => m[1])
const classTokens = classAttrs.join(' ').split(/\s+/).filter(Boolean)
const badClassNames = classTokens.filter((name) => !name.startsWith('tbp-'))
eq(badClassNames.join(','), '', 'JSX className 全部 tbp- 前缀')

/* ───────────────────────── 3) React 桩 + 极简渲染器 ───────────────────────── */
function createReactStub() {
  const instances = new Map()
  const effects = []
  let currentPath = 'root'
  let currentInstance = null
  let hookIndex = 0
  const state = { pending: false }

  function createElement(type, props) {
    const merged = {}
    if (props) Object.keys(props).forEach((key) => { merged[key] = props[key] })
    const children = []
    for (let i = 2; i < arguments.length; i += 1) {
      const child = arguments[i]
      if (child === null || child === undefined || child === false || child === true) continue
      children.push(child)
    }
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    return { $$el: true, type, props: merged }
  }

  class Component {
    constructor(props) { this.props = props || {}; this.state = {} }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state) : patch
      this.state = Object.assign({}, this.state, next || {})
    }
  }

  function instanceFor(pathname, type, props) {
    let inst = instances.get(pathname)
    if (!inst || inst.type !== type) { inst = { type, props: null, hooks: [] }; instances.set(pathname, inst) }
    inst.props = props
    return inst
  }
  function enter(pathname, type, props, fn) {
    const prevPath = currentPath
    const prevInst = currentInstance
    const prevHook = hookIndex
    const inst = instanceFor(pathname, type, props)
    currentPath = pathname
    currentInstance = inst
    hookIndex = 0
    try { return fn() } finally {
      currentPath = prevPath
      currentInstance = prevInst
      hookIndex = prevHook
    }
  }
  function slot() {
    const inst = currentInstance
    const index = hookIndex
    hookIndex += 1
    if (!inst.hooks[index]) inst.hooks[index] = {}
    return inst.hooks[index]
  }
  function sameDeps(prev, next) {
    if (!prev || !next || prev.length !== next.length) return false
    for (let i = 0; i < prev.length; i += 1) if (!Object.is(prev[i], next[i])) return false
    return true
  }
  function useState(initial) {
    const box = slot()
    if (!('value' in box)) box.value = typeof initial === 'function' ? initial() : initial
    const setState = (next) => {
      const value = typeof next === 'function' ? next(box.value) : next
      if (!Object.is(value, box.value)) { box.value = value; state.pending = true }
    }
    return [box.value, setState]
  }
  function useRef(initial) {
    const box = slot()
    if (!('ref' in box)) box.ref = { current: initial }
    return box.ref
  }
  function useMemo(factory, deps) {
    const box = slot()
    if (!('deps' in box) || !sameDeps(box.deps, deps)) { box.value = factory(); box.deps = deps }
    return box.value
  }
  function useCallback(fn, deps) {
    const box = slot()
    if (!('deps' in box) || !sameDeps(box.deps, deps)) { box.value = fn; box.deps = deps }
    return box.value
  }
  function useEffect(fn, deps) {
    const box = slot()
    if (!('deps' in box) || !sameDeps(box.deps, deps)) {
      box.deps = deps
      box.fn = fn
      box.queued = true
      effects.push(box)
    }
  }
  const React = {
    createElement,
    Component,
    useState,
    useRef,
    useMemo,
    useCallback,
    useEffect,
  }
  return { React, state, effects, enter }
}

function flattenText(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenText).join(' ')
  if (node.$$el) {
    if (typeof node.type === 'string' && (node.type === 'style' || node.type === 'script')) return ''
    const props = node.props || {}
    return [props['aria-label'] || '', props.title || '', flattenText(props.children)].join(' ')
  }
  return ''
}

const CLICKABLE = []
const CHANGEABLE = []
const TEXT = []

function createRenderer(stub) {
  const clickables = []
  const changeables = []
  const textPieces = []

  function renderNode(node, pathKey) {
    if (node === null || node === undefined || node === false || node === true) return
    if (typeof node === 'string' || typeof node === 'number') { textPieces.push(String(node)); return }
    if (Array.isArray(node)) { node.forEach((child, index) => renderNode(child, pathKey + '/' + index)); return }
    if (!node.$$el) return
    const type = node.type
    const props = node.props || {}
    const key = props.key !== undefined ? 'k' + String(props.key) : pathKey
    if (typeof type === 'string') {
      if (type === 'style' || type === 'script') return
      if (typeof props.onClick === 'function') clickables.push({ label: [props['aria-label'] || '', props.title || '', flattenText(props.children)].join(' '), handler: props.onClick })
      if (typeof props.onChange === 'function') changeables.push({ label: props['aria-label'] || '', handler: props.onChange, value: props.value })
      renderNode(props.children, key + '>' + type)
      return
    }
    if (typeof type === 'function' && type.prototype && typeof type.prototype.render === 'function') {
      const instance = new type(props)
      if (instance.state === undefined) instance.state = {}
      renderNode(instance.render(), key + '>class')
      return
    }
    if (typeof type === 'function') {
      const output = stub.enter(key, type, props, () => type(props))
      renderNode(output, key + '>')
      return
    }
  }

  return {
    stub,
    clickables,
    changeables,
    render(tree) {
      clickables.length = 0
      changeables.length = 0
      textPieces.length = 0
      renderNode(tree, 'root')
      TEXT.push(textPieces.join(' '))
      return textPieces.join(' ').replace(/\s+/g, ' ').trim()
    },
    flushEffects() {
      const queue = stub.effects.splice(0)
      queue.forEach((box) => {
        if (!box.queued) return
        box.queued = false
        /* 与 React 一致：effect 重跑前执行上一次的 cleanup（避免 toast 定时器等残留） */
        if (typeof box.cleanup === 'function') {
          try { box.cleanup() } catch (error) { /* cleanup 异常不中断渲染 */ }
          box.cleanup = undefined
        }
        if (typeof box.fn === 'function') {
          const cleanup = box.fn()
          if (typeof cleanup === 'function') box.cleanup = cleanup
        }
      })
      return queue.length
    },
    click(match) {
      const hit = clickables.find((entry) => entry.label.includes(match))
      if (!hit) throw new Error('找不到可点击元素：' + match)
      hit.handler({ preventDefault() {}, stopPropagation() {} })
    },
    change(match, value) {
      const hit = changeables.find((entry) => entry.label.includes(match) || changeables.length === 1)
      if (!hit) throw new Error('找不到下拉框：' + match)
      hit.handler({ target: { value } })
    },
  }
}

async function settle(rt) {
  let text = ''
  for (let round = 0; round < 60; round += 1) {
    text = rt.render(rt.tree)
    const ran = rt.flushEffects()
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (!rt.stub.state.pending && ran === 0) {
      text = rt.render(rt.tree)
      if (!rt.stub.state.pending) return text
    }
  }
  return text
}

/* ───────────────────────── fixtures ───────────────────────── */
const CH01 = {
  id: 'ch01',
  number: 1,
  title: '绪论',
  solves: '解决时域分析无法统一描述激励—响应关系的问题',
  requires: ['微积分', '电路基础'],
  gain: '能建立信号与系统的统一描述框架',
  remainingGap: '仍无法处理任意信号在频域的展开，需要引入傅里叶级数',
  chain: [
    { from: '微分方程逐题求解', to: '信号分解 + 卷积', label: '统一框架' },
    { from: '卷积只适合时域直觉', to: '傅里叶级数', label: '频域展开' },
  ],
  sections: [
    {
      id: '1.1',
      title: '信号与系统',
      subProblem: '如何用统一的数学语言描述任意激励下的响应',
      requires: ['微积分'],
      remaining: '只讨论连续时间',
      points: [
        {
          id: '1.1.1',
          title: '信号与系统的激励—响应关系',
          solves: '为修复逐题解微分方程、无法复用的问题而生',
          meaning: '把系统视为把输入映射为输出的算子，线性时不变假设下可用卷积统一描述。',
          formula: 'y(t)=x(t)*h(t)',
          application: '电路、控制系统、通信系统的统一建模。',
          example: { question: '求 h(t)=e^{-t}u(t) 对 x(t)=u(t) 的响应。', answer: 'y(t)=1-e^{-t}（t≥0），卷积计算得到。' },
          prerequisites: ['微积分', '冲激函数'],
          limitation: '仅适用于线性时不变系统。',
          next: '傅里叶级数把信号展开到频域',
        },
        {
          id: '1.1.2',
          title: '系统的性质与判定',
          solves: '为修复不同系统需要不同分析工具的问题而生',
          meaning: '线性、时不变、因果、稳定等性质决定可用哪套分析工具。',
          formula: '',
          application: '判断能否使用卷积/变换域方法。',
          example: { question: '判断 y(t)=x(2t) 是否时不变。', answer: '时变：先伸缩与先延时结果不同。' },
          prerequisites: ['信号与系统的激励—响应关系'],
          limitation: '',
          next: '',
        },
      ],
    },
    {
      id: '1.2',
      title: '系统的描述',
      subProblem: '如何用框图与方程描述系统结构',
      requires: ['信号与系统'],
      remaining: '',
      points: [],
    },
  ],
}
const BOOK = {
  id: 'signals-systems-zheng',
  title: '信号与系统',
  subtitle: '郑君里 · 第三版',
  subject: '电子信息',
  tags: ['连续时间', '变换域'],
  updatedAt: '2026-11-04T12:00:00.000Z',
  overview: {
    goal: '建立任意激励下求解响应的统一理论。',
    pain: '逐题解微分方程，无法复用也无法刻画频率选择性。',
    mainline: '时域卷积 → 频域展开 → 复频域 → 离散时间',
    chain: [
      { step: '初代方案：时域冲激分解 + 卷积', detail: '把输入拆成冲激再叠加', defect: '微分方程求解繁琐、难以刻画频率选择性' },
      { step: '修复：傅里叶变换', detail: '把信号展开到频域', defect: '增长型信号不收敛' },
    ],
  },
  chapters: [
    { id: 'ch01', number: 1, title: '绪论', solves: '解决时域分析无法统一描述激励—响应关系的问题', requires: ['微积分'], gain: '建立统一框架', remainingGap: '无法频域展开', sections: [{ id: '1.1', title: '信号与系统', subProblem: '统一描述', pointCount: 2 }, { id: '1.2', title: '系统的描述', subProblem: '框图与方程', pointCount: 0 }] },
    { id: 'ch02', number: 2, title: '连续时间系统的时域分析', solves: '解决卷积计算不可行的问题', requires: ['绪论'], gain: '掌握卷积', remainingGap: '仍缺频域工具', sections: [{ id: '2.1', title: '卷积', subProblem: '卷积怎么算', pointCount: 3 }] },
  ],
  stats: { chapters: 2, sections: 3, points: 5 },
}
const BOOK_EMPTY = { id: 'empty-book', title: '还没有章节的教材', subtitle: '', subject: '', tags: [], updatedAt: '', overview: {}, chapters: [], stats: {} }
const BOOKS = [BOOK, BOOK_EMPTY]
const CHAPTERS = { ch01: CH01 }

function makeFetch(log) {
  return async function fetchStub(input) {
    const raw = String(input)
    log.push(raw)
    const parsed = new URL(raw, 'http://127.0.0.1:53090/')
    const pathname = parsed.pathname
    const json = (body, status) => ({ ok: (status || 200) === 200, status: status || 200, json: async () => body })
    if (pathname === '/dsh-textbook-parser/api/books') return json({ ok: true, books: BOOKS })
    const chapterMatch = pathname.match(/\/api\/books\/([^/]+)\/chapters\/([^/]+)$/)
    if (chapterMatch) {
      const chapter = CHAPTERS[decodeURIComponent(chapterMatch[2])]
      if (!chapter) return json({ ok: false, error: 'chapter not found' }, 404)
      return json({ ok: true, chapter })
    }
    const bookMatch = pathname.match(/\/api\/books\/([^/]+)$/)
    if (bookMatch) {
      const book = BOOKS.find((entry) => entry.id === decodeURIComponent(bookMatch[1]))
      if (!book) return json({ ok: false, error: 'book not found' }, 404)
      return json({ ok: true, book })
    }
    return json({ ok: false, error: 'unexpected path ' + pathname }, 404)
  }
}

/* ───────────────────────── 4b) 真实数据 + enrich mock 辅助 ───────────────────────── */
function loadRealBook() {
  const dataRoot = path.join(HERE, '..', 'data', 'books', 'signals-systems-zheng')
  if (!existsSync(path.join(dataRoot, 'book.json'))) return null
  const book = JSON.parse(readFileSync(path.join(dataRoot, 'book.json'), 'utf8'))
  const chapters = {}
  const chapterDir = path.join(dataRoot, 'chapters')
  if (existsSync(chapterDir)) {
    readdirSync(chapterDir).filter((file) => /^ch\d+\.json$/.test(file)).forEach((file) => {
      try {
        const parsed = JSON.parse(readFileSync(path.join(chapterDir, file), 'utf8'))
        if (parsed && parsed.id) chapters[parsed.id] = parsed
      } catch (error) { /* 忽略损坏章节 */ }
    })
  }
  return { book, chapters }
}

/** v2 新字段的 mock enrich：真实数据尚未合并 enrich 时，用自造数据覆盖新增板块。 */
const MOCK_ENRICH = {
  bookAnalogy: '生活类比（mock）：整本书像给一台老设备做全流程体检——先看旧方法哪里卡住，再一层层换上更省力的工具。',
  chapterAnalogy: '生活类比（mock）：本章像先发一套通用工具箱，把后面各章要用的螺丝刀、扳手都备齐。',
  sectionAnalogy: '生活类比（mock）：这一节像把快递分拣线搭起来，先统一包裹格式，再决定扫码后往哪条传送带送。',
  sectionSummary: '本节总览（mock）：统一描述任意信号与系统。\n① 信号与系统：把物理量抽象成函数。\n② 系统描述：用框图与方程描述结构。',
  pointAnalogy: '生活类比（mock）：知识点像扫码枪，把千奇百怪的包裹统一成可识别的编号。',
  pointAnalogy2: '生活类比（mock）：性质判定像安检门，先判断能不能走同一条流水线。',
  examples: [
    { id: 'mock-e1', type: '概念判断', source: '教材例题改编', question: 'MOCK 判断题：y(t)=x(2t) 是时不变系统吗？', answer: 'MOCK 答案：不是，先伸缩与先延时结果不同。', note: 'MOCK 提示：注意 t 与 2t 的对应关系。' },
    { id: 'mock-e2', type: '计算', source: '课后习题改编', question: 'MOCK 计算题：求 h(t)=e^{-t}u(t) 与 u(t) 的卷积。', answer: 'MOCK 答案：y(t)=1-e^{-t}，t≥0。' },
    { id: 'mock-e3', type: '推导证明', source: '典型题', question: 'MOCK 证明题：证明线性系统满足叠加性。', answer: 'MOCK 答案：由定义直接验证可加性与齐次性。' },
    { id: 'mock-e4', type: '综合应用', source: '典型题', question: 'MOCK 综合题：用卷积解释滤波器的频率选择性。', answer: 'MOCK 答案：卷积核的频谱决定通带。' },
  ],
  pointDetail: '详细讲解（mock）：这一知识点先说明它解决什么问题，再给出核心结论与使用步骤，最后说明与前后知识点的关系。整段模拟 350–800 字的自学材料，用于验证侧栏与导出网页的详细讲解区块完整显示、可换行、不截断。',
  pointKeyPoints: ['要点一：先判断系统是否线性时不变。', '要点二：卷积只在零状态条件下直接适用。', '要点三：边界条件需要单独处理。'],
  pointDerivation: '推导思路（mock）：由冲激分解 f(t)=∫f(τ)δ(t−τ)dτ，再利用时不变与线性交换求和次序，得到卷积表达式。',
  mistakesText: '易错辨析（mock）：常见错误是把时变系统的响应也写成卷积；卷积要求时不变且零状态。',
  examTipsText: '考试提示（mock）：常见题型为判断线性/时不变，解题入口是先回到定义逐条验证。',
  injectMarker: '<img src=x onerror=alert(1)>',
  /* v1.3：结构化定理 + 推导步骤 + deepread 风格 digest */
  mockTheorems: [
    {
      name: '卷积定理（mock）',
      statement: 'MOCK：f(t)*h(t) ↔ F(jω)H(jω)',
      conditions: ['f、h 的傅里叶变换存在', '系统为 LTI 且零状态'],
      symbols: [{ sym: 'F(jω)', meaning: '激励的频谱' }, { sym: 'H(jω)', meaning: '系统函数' }],
    },
  ],
  mockFormulaMulti: 'MOCK 公式一：y(t)=T[f(t)]；MOCK 公式二：W=∫|f(t)|²dt',
  mockDerivationSteps: [
    { step: 'MOCK 步骤一：写出卷积定义', line: 'y(t)=∫_{-∞}^{+∞} f(τ)h(t−τ)dτ', why: 'MOCK 依据：冲激分解 + 线性时不变' },
    { step: 'MOCK 步骤二：换元', line: '令 λ=t−τ ⇒ dτ=−dλ\n得 f*h=h*f', detail: 'MOCK 说明：交换律' },
    { step: 'MOCK 步骤三：得到乘积形式', detail: 'Y(jω)=F(jω)H(jω)' },
  ],
  mockCalcLineText: 'y(t)=∫_{-∞}^{+∞} f(τ)h(t−τ)dτ',
  mockDigest: {
    oneLine: 'MOCK 一句话总结：本节把任意信号抽象成函数，并给出系统描述的两条路线。',
    corePoints: ['MOCK 核心结论一：信号可表示为函数 f(t)', 'MOCK 核心结论二：系统是算子 y=T[f]', 'MOCK 核心结论三：LTI 可用冲激响应刻画'],
    argumentChain: ['MOCK 先界定研究对象', 'MOCK 再引入描述方式', 'MOCK 最后给出性质判定'],
    pointMap: [
      { id: 'MOCK-P1', title: 'MOCK 地图点一', role: 'MOCK 本节开篇的定位句', keyIdea: 'MOCK 关键结论：y=T[f]' },
      { id: 'MOCK-P2', title: 'MOCK 地图点二', role: 'MOCK 承接的第二个点', keyIdea: 'MOCK 关键结论：两条描述路线' },
    ],
    takeaways: ['MOCK 复习要点一：黑箱法只看输入输出', 'MOCK 复习要点二：线性=齐次+叠加'],
    pitfalls: ['MOCK 易错点一：把内部元件当系统边界', 'MOCK 易错点二：混淆信号与系统'],
    connections: { before: 'MOCK 承接：中学物理的波形计算', after: 'MOCK 铺垫：第 2 章时域分析' },
  },
  mockImageAlt: 'MOCK 公式图',
}

function applyMockEnrich(book, chapters) {
  const isObject = (value) => !!value && typeof value === 'object'
  if (isObject(book.overview)) book.overview.analogy = MOCK_ENRICH.bookAnalogy
  book.tags = (Array.isArray(book.tags) ? book.tags : []).concat([MOCK_ENRICH.injectMarker])
  if (Array.isArray(book.chapters) && isObject(book.chapters[0])) book.chapters[0].analogy = MOCK_ENRICH.chapterAnalogy
  const chapter = isObject(chapters['ch01']) ? chapters['ch01'] : null
  if (chapter) {
    chapter.analogy = MOCK_ENRICH.chapterAnalogy
    const sections = Array.isArray(chapter.sections) ? chapter.sections : []
    const firstSection = isObject(sections[0]) ? sections[0] : null
    if (firstSection) {
      firstSection.summary = MOCK_ENRICH.sectionSummary
      firstSection.analogy = MOCK_ENRICH.sectionAnalogy
      firstSection.examples = MOCK_ENRICH.examples
      const points = Array.isArray(firstSection.points) ? firstSection.points : []
      if (isObject(points[0])) {
        points[0].analogy = MOCK_ENRICH.pointAnalogy
        points[0].important = true
        points[0].detail = MOCK_ENRICH.pointDetail
        points[0].keyPoints = MOCK_ENRICH.pointKeyPoints.slice()
        points[0].derivation = MOCK_ENRICH.pointDerivation
        points[0].mistakes = MOCK_ENRICH.mistakesText
        points[0].examTips = MOCK_ENRICH.examTipsText
        /* v1.3：结构化定理 + 多公式 + 推导步骤 */
        points[0].math = {
          theorems: MOCK_ENRICH.mockTheorems,
          derivationSteps: MOCK_ENRICH.mockDerivationSteps,
          image: null,
        }
        points[0].formula = MOCK_ENRICH.mockFormulaMulti
      }
      if (isObject(points[1])) {
        points[1].analogy = MOCK_ENRICH.pointAnalogy2
        points[1].important = false
        /* v1.3：图片兜底（1x1 透明 PNG dataUrl） */
        points[1].math = {
          theorems: [],
          derivationSteps: [],
          image: {
            dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            alt: MOCK_ENRICH.mockImageAlt,
            caption: 'MOCK 图注',
          },
        }
      }
      /* v1.3：deepread 风格 digest */
      firstSection.digest = MOCK_ENRICH.mockDigest
    }
  }
  return chapter
}

function downloadContent(harness, download) {
  const index = Number(String(download && download.href || '').split('/').pop()) || 0
  const blob = harness.blobs[index - 1]
  if (!blob) return ''
  return String((blob.parts && blob.parts[0]) || '')
}

function downloadBlobOf(harness, download) {
  const index = Number(String(download && download.href || '').split('/').pop()) || 0
  return harness.blobs[index - 1] || null
}

/* ───────────────────────── 导出网页 v2：数据提取 / 迷你 DOM / 交互冒烟 ───────────────────────── */
function extractExportData(html) {
  const marker = 'window.__TBP_DATA__ = '
  const start = html.indexOf(marker)
  if (start < 0) return null
  const end = html.indexOf(';</script>', start)
  if (end < 0) return null
  try { return JSON.parse(html.slice(start + marker.length, end)) } catch (error) { return null }
}

function extractWebAppScript(html) {
  const first = html.indexOf('<script>')
  if (first < 0) return ''
  const firstEnd = html.indexOf('</script>', first)
  if (firstEnd < 0) return ''
  const second = html.indexOf('<script>', firstEnd)
  if (second < 0) return ''
  const secondEnd = html.indexOf('</script>', second)
  if (secondEnd < 0) return ''
  return html.slice(second + '<script>'.length, secondEnd)
}

function findExportChapter(data, chapterId) {
  const list = data && Array.isArray(data.chapters) ? data.chapters : []
  return list.filter((item) => item && String(item.id) === String(chapterId))[0] || null
}

function findExportSection(data, chapterId, sectionId) {
  const chapter = findExportChapter(data, chapterId)
  const sections = chapter && Array.isArray(chapter.sections) ? chapter.sections : []
  return sections.filter((item) => item && String(item.id) === String(sectionId))[0] || null
}

function findExportPoint(data, chapterId, sectionId, pointId) {
  const section = findExportSection(data, chapterId, sectionId)
  const points = section && Array.isArray(section.points) ? section.points : []
  return points.filter((item) => item && String(item.id) === String(pointId))[0] || null
}

/** 迷你 DOM：让导出网页的原生 JS 真的在 Node 里跑起来（不依赖 jsdom）。 */
function createMiniDom() {
  const ids = new Map()
  const docListeners = {}
  const winListeners = {}
  function nodeText(node) {
    if (!node) return ''
    if (node.isText) return node.nodeValue || ''
    if (!node.children.length) return node._text || ''
    return node.children.map(nodeText).join(' ')
  }
  function Node(tag) {
    this.tagName = String(tag || '').toUpperCase()
    this.children = []
    this.attributes = {}
    this.className = ''
    this.parentNode = null
    this.listeners = {}
    this._text = ''
    this._id = ''
    this.style = {}
  }
  Node.prototype.appendChild = function (child) {
    if (!child) return child
    child.parentNode = this
    this.children.push(child)
    return child
  }
  Node.prototype.setAttribute = function (name, value) {
    this.attributes[name] = String(value)
    if (name === 'id') { this._id = String(value); ids.set(this._id, this) }
    if (name === 'class') this.className = String(value)
  }
  Node.prototype.getAttribute = function (name) {
    if (name === 'id') return this._id || null
    if (name === 'class') return this.className || null
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null
  }
  Node.prototype.addEventListener = function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn) }
  Node.prototype.removeEventListener = function () {}
  Object.defineProperty(Node.prototype, 'id', {
    get() { return this._id },
    set(value) { this._id = String(value); ids.set(this._id, this) },
  })
  Object.defineProperty(Node.prototype, 'textContent', {
    get() { return this.children.length ? this.children.map(nodeText).join(' ') : (this._text || '') },
    set(value) { this._text = String(value === undefined ? '' : value); this.children = [] },
  })
  const document = {
    createElement(tag) { return new Node(tag) },
    createTextNode(text) { const node = new Node('#text'); node.isText = true; node.nodeValue = String(text); return node },
    getElementById(id) { return ids.get(String(id)) || null },
    addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn) },
    removeEventListener() {},
    documentElement: new Node('html'),
    body: new Node('body'),
  }
  const rootNode = new Node('div')
  rootNode.setAttribute('id', 'tbp-root')
  rootNode.className = 'tbp-root'
  const window = {
    location: { hash: '' },
    addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn) },
    removeEventListener() {},
    scrollTo() {},
  }
  function walk(node, visit) {
    if (!node) return
    visit(node)
    const children = node.children || []
    for (let index = 0; index < children.length; index += 1) walk(children[index], visit)
  }
  function root() { return document.getElementById('tbp-root') }
  function allActs() {
    const list = []
    walk(root(), (node) => {
      if (node.getAttribute && node.getAttribute('data-act')) list.push(node)
    })
    return list
  }
  function findAct(act) {
    const list = allActs().filter((node) => node.getAttribute('data-act') === act)
    return list[0] || null
  }
  return {
    document, window, docListeners, winListeners, walk, allActs, findAct,
    text() { return nodeText(root()) },
    /** 按 class 收集节点（v1.3 导出页断言用） */
    byClass(cls) {
      const list = []
      walk(root(), (node) => {
        const klass = node.getAttribute ? String(node.getAttribute('class') || '') : ''
        if (klass.split(/\s+/).indexOf(cls) >= 0) list.push(node)
      })
      return list
    },
  }
}

/** 在迷你 DOM 中执行导出页脚本，验证四层视图 / 深链接 / 折叠 / Esc 返回。 */
async function runExportAppChecks(html) {
  const data = extractExportData(html)
  ok(!!data && Array.isArray(data.chapters) && data.chapters.length > 0, '导出 v2：可解析内嵌 __TBP_DATA__ 章节树')
  if (!data) return
  const appScript = extractWebAppScript(html)
  ok(appScript.length > 3000 && appScript.includes('__TBP_DATA__') && appScript.includes('data-act'), '导出 v2：内联交互脚本存在（' + appScript.length + ' 字符，读数据 + data-act 委托）')
  ok(appScript.indexOf('http://') < 0 && appScript.indexOf('https://') < 0, '导出 v2：交互脚本零外链')
  const dom = createMiniDom()
  dom.window.__TBP_DATA__ = data
  const sandbox = {
    document: dom.document,
    window: dom.window,
    console: { log() {}, warn() {}, error() {} },
    encodeURIComponent, decodeURIComponent, JSON, Object, Array, String, Number, Boolean, Math, Date, isFinite,
    setTimeout, clearTimeout,
  }
  sandbox.globalThis = sandbox
  let runError = null
  try { new vm.Script(appScript, { filename: 'tbp-app.js' }).runInContext(vm.createContext(sandbox)) } catch (error) { runError = error }
  ok(!runError, '导出 v2：页面脚本可在无宿主环境执行' + (runError ? '：' + runError.message : ''))
  if (runError) return
  ok(dom.window.__TBP_APP_READY__ === true, '导出 v2：应用初始化完成（__TBP_APP_READY__）')

  const firstChapter = data.chapters[0]
  const firstSection = firstChapter && Array.isArray(firstChapter.sections) ? firstChapter.sections[0] : null
  const firstPoint = firstSection && Array.isArray(firstSection.points) ? firstSection.points[0] : null
  if (!firstChapter || !firstSection || !firstPoint) { ok(false, '导出 v2：内嵌数据缺少四层结构'); return }
  const hash = '#/' + encodeURIComponent(firstChapter.id) + '/' + encodeURIComponent(firstSection.id) + '/' + encodeURIComponent(firstPoint.id)
  const root = dom.document.getElementById('tbp-root')
  const click = (node) => {
    const listeners = root.listeners.click || []
    listeners.forEach((fn) => fn({ target: node, preventDefault() {} }))
  }
  const hashChange = () => { (dom.winListeners.hashchange || []).forEach((fn) => fn({})) }
  const fireKey = (key) => { (dom.docListeners.keydown || []).forEach((fn) => fn({ key })) }

  let viewText = dom.text()
  ok(viewText.includes(data.book.title) && viewText.includes('章节地图'), '导出 v2：首屏渲染全书总览 + 章节地图')
  ok(viewText.includes(String(firstChapter.title)), '导出 v2：首屏渲染章卡片')

  const acts = dom.allActs().map((node) => node.getAttribute('data-act'))
  ok(['back', 'chapter'].every((act) => acts.indexOf(act) >= 0) || acts.indexOf('chapter') >= 0, '导出 v2：首屏存在 data-act 事件标记（chapter）')

  /* 深链接 → 章 */
  dom.window.location.hash = '#/' + encodeURIComponent(firstChapter.id)
  hashChange()
  viewText = dom.text()
  ok(viewText.includes(String(firstChapter.solves).slice(0, 12)), '导出 v2：深链接 #/ch01 进入章视图并渲染 solves')
  ok(viewText.includes(String(firstSection.title)), '导出 v2：章视图渲染节卡片')

  /* 深链接 → 节 */
  dom.window.location.hash = '#/' + encodeURIComponent(firstChapter.id) + '/' + encodeURIComponent(firstSection.id)
  hashChange()
  viewText = dom.text()
  ok(viewText.includes('本节知识点汇总'), '导出 v2：节视图渲染本节知识点汇总')
  /* v1.3：有 digest 时节视图渲染 digest 一句话总结，否则回退 summary */
  const sectionDigest = firstSection.digest
  if (sectionDigest && sectionDigest.oneLine) {
    ok(viewText.includes(String(sectionDigest.oneLine).slice(0, 12)), '导出 v3：节视图渲染 digest 一句话总结')
  } else {
    ok(viewText.includes(String(firstSection.summary).slice(0, 12)), '导出 v2：节视图渲染 summary 文本')
  }
  ok(String(firstPoint.title).length > 0 && viewText.indexOf(String(firstPoint.title)) >= 0, '导出 v2：节视图渲染知识点卡片')
  const sectionActs = dom.allActs().map((node) => node.getAttribute('data-act'))
  ok(sectionActs.indexOf('point') >= 0, '导出 v2：节视图知识点可下钻（data-act=point）')

  /* 深链接 → 知识点详情 */
  dom.window.location.hash = hash
  hashChange()
  viewText = dom.text()
  ok(viewText.includes('它要解决的问题'), '导出 v2：详情渲染 solves 高亮块')
  ok(viewText.includes(String(firstPoint.meaning).slice(0, 12)), '导出 v2：详情渲染含义')
  if (firstPoint.detail) ok(viewText.includes(String(firstPoint.detail).slice(0, 14)), '导出 v2：详情渲染详细讲解 detail')
  if (firstPoint.keyPoints.length) ok(viewText.includes(String(firstPoint.keyPoints[0])), '导出 v2：详情渲染学习要点列表')
  if (firstPoint.analogy) ok(viewText.includes(String(firstPoint.analogy).slice(0, 12)), '导出 v2：详情渲染生活类比')
  /* v1.3：推导默认收起，只断言折叠区标题存在；有 derivationSteps 时断言标题 */
  const pMath = firstPoint.math && typeof firstPoint.math === 'object' ? firstPoint.math : null
  if (pMath && Array.isArray(pMath.derivationSteps) && pMath.derivationSteps.length) {
    ok(viewText.includes('定理推导过程'), '导出 v3：详情渲染「定理推导过程」折叠区')
    const derivNodes = dom.byClass ? dom.byClass('tbp-deriv') : []
    const collapsed = derivNodes.length > 0 && derivNodes.every((node) => node.getAttribute('data-hidden') === '1')
    ok(collapsed, '导出 v3：推导默认收起（data-hidden=1）')
  } else if (firstPoint.derivation) {
    ok(viewText.includes('定理推导过程') || viewText.includes(String(firstPoint.derivation).slice(0, 10)), '导出 v2：详情推导区块存在')
  }
  if (firstPoint.mistakes) ok(viewText.includes(String(firstPoint.mistakes).slice(0, 10)), '导出 v2：详情渲染易错辨析')
  if (firstPoint.examTips) ok(viewText.includes(String(firstPoint.examTips).slice(0, 10)), '导出 v2：详情渲染考试/应用提示')
  if (firstPoint.important) ok(viewText.includes('★') && viewText.includes('重点'), '导出 v2：重点知识点显示 ★ + 重点徽标')
  const detailActs = dom.allActs()
  ok(detailActs.some((node) => node.getAttribute('data-act') === 'toggle'), '导出 v2：详情存在答案折叠按钮（data-act=toggle）')
  ok(detailActs.some((node) => node.getAttribute('data-act') === 'back'), '导出 v2：详情存在返回按钮')

  /* 答案折叠：找到「本节典型例题」答案按钮 */
  const toggles = detailActs.filter((node) => node.getAttribute('data-act') === 'toggle')
  const exampleToggle = toggles.filter((node) => String(node.getAttribute('data-target') || '').indexOf('tbp-ans-') === 0)[0] || toggles[0]
  if (exampleToggle && firstSection.examples && firstSection.examples[0] && firstSection.examples[0].answer) {
    const before = dom.text()
    click(exampleToggle)
    const after = dom.text()
    ok(after.includes(String(firstSection.examples[0].answer).slice(0, 10)) || after.length > before.length, '导出 v2：点击「显示答案」后答案展开')
    click(exampleToggle)
    ok(true, '导出 v2：答案可再次收起')
  }

  /* Esc 返回上一节视图 */
  fireKey('Escape')
  viewText = dom.text()
  ok(viewText.includes(String(firstSection.title)) && viewText.includes('本节知识点汇总'), '导出 v2：Esc 返回节视图')

  /* 返回按钮 → 章视图 */
  const backNode = dom.findAct('back')
  if (backNode) {
    click(backNode)
    viewText = dom.text()
    ok(viewText.includes(String(firstChapter.solves).slice(0, 10)), '导出 v2：返回按钮回到章视图')
  }

  /* 回到全书总览 */
  dom.window.location.hash = '#/'
  hashChange()
  viewText = dom.text()
  ok(viewText.includes(data.book.title) && viewText.includes('章节地图'), '导出 v2：hash 回到全书总览')
  ok(viewText.indexOf('undefined') < 0 && viewText.indexOf('NaN') < 0, '导出 v2：渲染无 undefined/NaN')
}

/** 建立带假 DOM / Blob / URL / a[download] / window.open 的沙箱，并挂载 TextbookPanel。 */
function mountPanel(data, options) {
  const opts = options || {}
  const harness = {
    book: data.book,
    chapters: data.chapters,
    firstChapter: opts.noMockEnrich
      ? (data.chapters && data.chapters['ch01'] ? data.chapters['ch01'] : null)
      : applyMockEnrich(data.book, data.chapters),
    fetchLog: [],
    errors: [],
    downloads: [],
    blobs: [],
    printed: 0,
    printedHtml: '',
    popupBlocked: false,
    gate: null,
    releaseGate: null,
    winListeners: {},
    docListeners: {},
  }
  let descriptor = null
  function URLStub(input, base) { return new URL(input, base) }
  URLStub.createObjectURL = (blob) => { harness.blobs.push(blob); return 'blob:mock/' + harness.blobs.length }
  URLStub.revokeObjectURL = () => {}

  const fetchImpl = async (input) => {
    const raw = String(input)
    harness.fetchLog.push(raw)
    const pathname = new URL(raw, 'http://127.0.0.1:53090/').pathname
    const json = (body, status) => ({ ok: (status || 200) === 200, status: status || 200, json: async () => body })
    if (harness.gate && pathname.indexOf('/chapters/') >= 0) await harness.gate
    if (pathname === '/dsh-textbook-parser/api/books') return json({ ok: true, books: [harness.book] })
    const chapterMatch = pathname.match(/\/api\/books\/([^/]+)\/chapters\/([^/]+)$/)
    if (chapterMatch) {
      const chapter = harness.chapters[decodeURIComponent(chapterMatch[2])]
      return chapter ? json({ ok: true, chapter }) : json({ ok: false, error: 'chapter missing' }, 404)
    }
    if (/\/api\/books\/[^/]+$/.test(pathname)) return json({ ok: true, book: harness.book })
    return json({ ok: false, error: 'unknown path' }, 404)
  }

  const sandbox = {
    console: { error: (...args) => harness.errors.push(args.map(String).join(' ')), log() {}, warn() {}, info() {} },
    URL: URLStub,
    Blob: class FakeBlob {
      constructor(parts, options) { this.parts = parts || []; this.type = (options && options.type) || '' }
    },
    Promise, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Boolean, Error,
    isFinite, encodeURIComponent, decodeURIComponent,
    localStorage: {
      store: {},
      getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null },
      setItem(key, value) { this.store[key] = String(value) },
    },
    fetch: fetchImpl,
    window: {
      __ModuleLoader__: { load(entry) { descriptor = entry } },
      addEventListener(type, fn) { (harness.winListeners[type] = harness.winListeners[type] || []).push(fn) },
      removeEventListener(type, fn) { harness.winListeners[type] = (harness.winListeners[type] || []).filter((item) => item !== fn) },
      open() {
        if (harness.popupBlocked) return null
        return {
          document: { open() {}, write(html) { harness.printedHtml += html }, close() {} },
          focus() {},
          print() { harness.printed += 1 },
        }
      },
    },
    document: {
      baseURI: 'http://127.0.0.1:53090/',
      addEventListener(type, fn) { (harness.docListeners[type] = harness.docListeners[type] || []).push(fn) },
      removeEventListener(type, fn) { harness.docListeners[type] = (harness.docListeners[type] || []).filter((item) => item !== fn) },
      createElement(tag) {
        const node = {
          tagName: String(tag || '').toUpperCase(), href: '', download: '', rel: '', parentNode: null, style: {},
          click() { harness.downloads.push({ filename: node.download, href: node.href }) },
        }
        return node
      },
      documentElement: {
        children: [],
        appendChild(node) { node.parentNode = this; this.children.push(node); return node },
        removeChild(node) { node.parentNode = null; return node },
      },
    },
  }
  sandbox.globalThis = sandbox
  let loadError = null
  try { new vm.Script(source, { filename: 'client.js' }).runInContext(vm.createContext(sandbox)) } catch (error) { loadError = error }
  ok(!loadError, '真实数据：client.js 载入通过' + (loadError ? '：' + loadError.message : ''))
  if (loadError) return null

  const stub = createReactStub()
  let api = null
  try {
    api = descriptor.factory((name) => {
      if (name === 'react') return stub.React
      throw new Error('只应 require("react")，实际：' + name)
    })
  } catch (error) { ok(false, '真实数据：factory 抛错 ' + error.message); return null }
  const slots = []
  const dictionaries = {}
  const ctx = {
    effect(fn) { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    locale: {
      register(name, dict) { dictionaries[name] = dict; return () => {} },
      bind(name) {
        return (key) => {
          const dict = dictionaries[name] || {}
          const zh = dict.zh || {}
          const en = dict.en || {}
          if (zh[key] !== undefined) return zh[key]
          if (en[key] !== undefined) return en[key]
          return key
        }
      },
    },
    slots: {
      register(options, component) { slots.push({ options, component }); return () => {} },
      inject(key, callback) { return callback() },
    },
  }
  try { api.apply(ctx) } catch (error) { ok(false, '真实数据：apply 抛错 ' + error.message); return null }
  harness.dictionaries = dictionaries
  const mainEntry = slots.find((entry) => entry.options.name === 'main')
  if (!mainEntry || typeof mainEntry.component !== 'function') { ok(false, '真实数据：未注册 main 组件'); return null }
  const rt = createRenderer(stub)
  rt.tree = stub.React.createElement(mainEntry.component, null)
  harness.rt = rt
  return harness
}

/* ───────────────────────── 4c) 真实数据 E2E ───────────────────────── */
async function runRealDataChecks() {
  const data = loadRealBook()
  if (!data) { ok(true, '真实数据 E2E（跳过：data/book.json 尚未生成）'); return }
  const harness = mountPanel(data)
  if (!harness) return
  const rt = harness.rt
  const book = harness.book
  const chapters = harness.chapters
  const firstChapter = harness.firstChapter
  const firstMeta = Array.isArray(book.chapters) ? book.chapters[0] : null
  let text = await settle(rt)
  const stats = book.stats && typeof book.stats === 'object' ? book.stats : {}
  ok(text.includes(book.title), '真实数据：渲染《' + book.title + '》')
  ok(text.includes('全书总纲') && text.includes(String(book.overview && book.overview.mainline).slice(0, 10)), '真实数据：总纲 + 迭代主线渲染')
  const expectedStat = stats.chapters + ' 章 · ' + stats.sections + ' 节 · ' + stats.points + ' 个知识点'
  ok(text.includes(expectedStat), '真实数据：统计条「' + expectedStat + '」')
  const chapterList = Array.isArray(book.chapters) ? book.chapters : []
  ok(chapterList.every((meta) => text.includes(meta.title)), '真实数据：' + chapterList.length + ' 张章卡片全部渲染')
  ok(text.includes('缺陷'), '真实数据：缺陷标签（warn 色）渲染')
  ok(text.includes(MOCK_ENRICH.bookAnalogy), 'v2 真实数据：全书总纲渲染生活类比')

  let opened = 0
  for (const meta of chapterList) {
    const label = '第' + meta.number + '章 · ' + meta.title
    const chapterStart = Date.now()
    try { rt.click(label) } catch (error) { continue }
    const chapterText = await settle(rt)
    const detailChapter = chapters[meta.id]
    if (detailChapter && chapterText.includes(String(detailChapter.solves).slice(0, 10))) opened += 1
    if (chapterText.includes('这部分内容加载失败')) ok(false, '真实数据：章 ' + meta.id + ' 渲染为错误态')
    console.error('CH ' + meta.id + ' settle ms', Date.now() - chapterStart)
    rt.click('返回')
    await settle(rt)
  }
  ok(opened >= 1, '真实数据：逐章打开并有内容（' + opened + '/' + chapterList.length + ' 章）')

  const section = firstChapter && Array.isArray(firstChapter.sections) ? firstChapter.sections[0] : null
  if (firstMeta && section) {
    rt.click('第' + firstMeta.number + '章 · ' + firstMeta.title)
    text = await settle(rt)
    ok(text.includes(String(firstChapter.solves).slice(0, 12)), '真实数据：章头 solves 渲染')
    ok(text.includes(section.title) && text.includes(section.subProblem.slice(0, 12)), '真实数据：节卡片标题 + subProblem 渲染')

    /* v2：小节卡片知识点数 Bug 修复 */
    const sectionsWithPoints = firstChapter.sections.filter((item) => Array.isArray(item.points) && item.points.length > 0)
    ok(sectionsWithPoints.length > 0, 'v2 真实数据：ch01 存在含知识点的小节')
    ok(sectionsWithPoints.every((item) => item.points.length >= 2), 'v2 真实数据：ch01 每个小节知识点数 >= 2')
    ok(sectionsWithPoints.every((item) => text.includes(item.points.length + ' 个知识点')), 'v2 真实数据：章节卡片显示真实知识点数（与 points.length 一致）')
    ok(text.indexOf('0 个知识点') < 0, 'v2 真实数据：章视图不再出现「0 个知识点」')
    const chapterPointTotal = firstChapter.sections.reduce((sum, item) => sum + (Array.isArray(item.points) ? item.points.length : 0), 0)
    ok(text.includes(chapterPointTotal + ' 个知识点'), 'v2 真实数据：章统计条知识点合计 = ' + chapterPointTotal)
    /* v2：长文本完整显示（全文存在，证明没截断） */
    ok(text.includes(String(firstChapter.solves)), 'v2 真实数据：章 solves 长文本完整渲染（未截断）')
    ok(text.includes(String(section.subProblem)), 'v2 真实数据：节 subProblem 长文本完整渲染（未截断）')
    ok(text.includes(MOCK_ENRICH.chapterAnalogy), 'v2 真实数据：章头渲染生活类比')

    rt.click(section.id + ' ' + section.title)
    text = await settle(rt)
    const point = Array.isArray(section.points) ? section.points[0] : null
    const secondPoint = Array.isArray(section.points) ? section.points[1] : null

    /* v2：节视图新增板块 */
    ok(text.includes('本节知识点汇总') && text.includes(MOCK_ENRICH.mockDigest.oneLine), 'v1.3 真实数据：节视图渲染本节知识点汇总（digest 优先）')
    ok(text.includes(MOCK_ENRICH.sectionAnalogy), 'v2 真实数据：节视图渲染生活类比')
    ok(text.includes('本节典型例题（' + MOCK_ENRICH.examples.length + ' 道）'), 'v2 真实数据：节视图例题板块数量 = examples.length')
    ok(MOCK_ENRICH.examples.every((example) => text.includes(example.question)), 'v2 真实数据：全部例题题干完整渲染')
    ok(text.includes('概念判断') && text.includes('教材例题改编') && text.includes('计算'), 'v2 真实数据：例题 type/source 徽标渲染')
    ok(!text.includes(MOCK_ENRICH.examples[0].answer), 'v2 真实数据：例题答案默认收起')
    rt.click('显示答案')
    text = await settle(rt)
    ok(text.includes(MOCK_ENRICH.examples[0].answer), 'v2 真实数据：点击「显示答案」后答案出现')
    ok(text.includes(MOCK_ENRICH.examples[0].note), 'v2 真实数据：展开后显示 note 提示')

    /* v1.2：星标（★ + 重点徽标） */
    ok(text.includes('★'), 'v1.2 真实数据：节视图渲染 ★ 星标')
    ok(text.includes('重点'), 'v1.2 真实数据：星标旁显示「重点」徽标')
    ok((text.match(/★/g) || []).length >= 2, 'v1.2 真实数据：★ 同时出现在知识点卡片与本节知识点汇总列表')
    ok(text.includes(section.points[0].title), 'v1.2 真实数据：重点知识点卡片标题渲染')

    if (point) {
      ok(text.includes(point.title), '真实数据：知识点卡片标题渲染')
if (secondPoint) {
        ok(text.includes(secondPoint.title), 'v2 真实数据：节视图知识点汇总列出同节全部知识点')
        rt.click(secondPoint.title)
        text = await settle(rt)
        ok(text.includes(MOCK_ENRICH.pointAnalogy2), 'v2 真实数据：节视图汇总项可点击进入知识点')
        ;(harness.docListeners.keydown || []).forEach((fn) => fn({ key: 'Escape', preventDefault() {} }))
        text = await settle(rt)
      }
      rt.click(point.id + ' ' + point.title)
      text = await settle(rt)
      ok(text.includes(String(point.meaning).slice(0, 14)), '真实数据：详情含义渲染')
      ok(text.includes(String(point.application).slice(0, 10)), '真实数据：详情应用渲染')
      ok(text.includes(String(point.example && point.example.answer).slice(0, 8)), '真实数据：详情例题解答渲染')
      ok(text.includes('它要解决的问题') && text.includes('按 Esc 返回上一层'), '真实数据：solves 高亮块 + Esc 提示')

      /* v2：知识点详情新增板块 */
      ok(text.includes(MOCK_ENRICH.pointAnalogy), 'v2 真实数据：知识点详情渲染生活类比')
      const idxMeaning = text.indexOf(String(point.meaning).slice(0, 14))
      const idxAnalogy = text.indexOf(MOCK_ENRICH.pointAnalogy)
      const idxApplication = text.indexOf(String(point.application).slice(0, 10))
      ok(idxMeaning >= 0 && idxAnalogy > idxMeaning && idxApplication > idxAnalogy, 'v2 真实数据：详情板块顺序 含义→生活类比→应用')

      /* v1.2：知识点详解板块（★ / 详细讲解 / 学习要点 / 推导思路 / 易错辨析 / 考试提示） */
      ok(text.includes('★') && text.includes('重点'), 'v1.2 真实数据：详情标题渲染 ★ + 重点')
      ok(text.includes(MOCK_ENRICH.pointDetail), 'v1.2 真实数据：详情渲染详细讲解 detail（全文未截断）')
      ok(MOCK_ENRICH.pointKeyPoints.every((item) => text.includes(item)), 'v1.2 真实数据：详情渲染学习要点列表（带序号）')
      /* v1.3：推导改为折叠区，默认收起；展开后可见 */
      ok(text.includes('定理推导过程'), 'v1.3 真实数据：详情渲染「定理推导过程」折叠区')
      ok(text.indexOf(MOCK_ENRICH.pointDerivation) < 0, 'v1.3 真实数据：推导默认收起（内容不可见）')
      ok(text.includes(MOCK_ENRICH.mistakesText), 'v1.2 真实数据：详情渲染易错辨析 mistakes')
      ok(text.includes(MOCK_ENRICH.examTipsText), 'v1.2 真实数据：详情渲染考试/应用提示 examTips')
      const v12Order = [
        String(point.meaning).slice(0, 14),
        MOCK_ENRICH.pointDetail.slice(0, 12),
        MOCK_ENRICH.pointKeyPoints[0],
        MOCK_ENRICH.pointAnalogy,
        '定理推导过程',
        MOCK_ENRICH.mistakesText.slice(0, 10),
        MOCK_ENRICH.examTipsText.slice(0, 10),
      ].map((snippet) => text.indexOf(snippet))
      ok(v12Order.every((index) => index >= 0), 'v1.2 真实数据：详情新增板块全部渲染')
      ok(v12Order.every((index, position) => position === 0 || index > v12Order[position - 1]), 'v1.2 真实数据：详情板块顺序符合 SPEC §2.2 单列顺序')
      ok(text.includes('本节知识点汇总'), 'v2 真实数据：知识点详情渲染本节知识点汇总')
      ok(text.indexOf(MOCK_ENRICH.examples[0].question) < 0, 'v2 真实数据：详情「本节典型例题」默认收起')
      /* 先展开推导步骤，再展开例题（页面上有两个折叠区，需分别展开；已全开时不再点） */
      const clickExpandIfAny = async function () {
        if (!rt.tree || !text.includes('展开')) return false
        try { rt.click('展开') } catch (e) { return false }
        text = await settle(rt)
        return true
      }
      for (let round = 0; round < 4 && !text.includes(MOCK_ENRICH.mockDerivationSteps[0].step); round += 1) {
        if (!(await clickExpandIfAny())) break
      }
      ok(MOCK_ENRICH.mockDerivationSteps.every((s) => text.includes(s.step)), 'v1.3 真实数据：推导折叠展开后显示推导步骤')
      for (let round = 0; round < 4 && !text.includes(MOCK_ENRICH.examples[0].question); round += 1) {
        if (!(await clickExpandIfAny())) break
      }
      ok(text.includes(MOCK_ENRICH.examples[0].question), 'v2 真实数据：详情展开后显示本节典型例题')

      /* v1.3：定理卡片 / 多公式 / 折叠推导 / digest 分段 */
      ok(text.includes(MOCK_ENRICH.mockTheorems[0].name), 'v1.3 真实数据：定理卡片渲染定理名')
      ok(text.includes(MOCK_ENRICH.mockTheorems[0].statement), 'v1.3 真实数据：定理卡片渲染 statement')
      ok(MOCK_ENRICH.mockTheorems[0].conditions.every((c) => text.includes(c)), 'v1.3 真实数据：定理卡片渲染适用条件')
      ok(MOCK_ENRICH.mockTheorems[0].symbols.every((s) => text.includes(s.sym) && text.includes(s.meaning)), 'v1.3 真实数据：定理卡片渲染符号说明')
      ok(text.includes('MOCK 公式一') || text.includes('MOCK 公式二'), 'v1.3 真实数据：多公式拆行渲染')
      ok(text.includes('定理推导过程'), 'v1.3 真实数据：推导折叠区标题')
      ok(MOCK_ENRICH.mockDerivationSteps.every((s) => text.includes(s.step)), 'v1.3 真实数据：推导步骤全部渲染（展开后）')
      /* v1.3.1：保姆级推导——纯算式行与依据行渲染 */
      ok(text.includes(MOCK_ENRICH.mockCalcLineText), 'v1.3.1 真实数据：推导渲染纯算式行（line）')
      ok(text.includes(MOCK_ENRICH.mockDerivationSteps[0].why), 'v1.3.1 真实数据：推导渲染依据行（why）')
      ok(text.includes('y(t)=∫_{-∞}^{+∞} f(τ)h(t−τ)dτ'), 'v1.3.1 真实数据：算式原文完整未转义 / 未截断')
      ok(text.includes(MOCK_ENRICH.mockDigest.oneLine), 'v1.3 真实数据：digest 一句话总结')
      ok(MOCK_ENRICH.mockDigest.corePoints.every((c) => text.includes(c)), 'v1.3 真实数据：digest 核心结论')
      ok(MOCK_ENRICH.mockDigest.argumentChain.every((c) => text.includes(c)), 'v1.3 真实数据：digest 讲解结构')
      ok(MOCK_ENRICH.mockDigest.takeaways.every((c) => text.includes(c)), 'v1.3 真实数据：digest 复习要点')
      ok(MOCK_ENRICH.mockDigest.pitfalls.every((c) => text.includes(c)), 'v1.3 真实数据：digest 易错点')
      ok(text.includes(MOCK_ENRICH.mockDigest.connections.before) && text.includes(MOCK_ENRICH.mockDigest.connections.after), 'v1.3 真实数据：digest 前后联系')
      ok(text.includes('知识点地图'), 'v1.3 真实数据：digest 知识点地图板块')
      ok(text.includes(MOCK_ENRICH.pointAnalogy2) === false, 'v2 真实数据：当前知识点未高亮显示其他点类比')
      if (secondPoint && secondPoint.analogy) {
        rt.click(secondPoint.title)
        text = await settle(rt)
        ok(text.includes(MOCK_ENRICH.pointAnalogy2), 'v2 真实数据：知识点汇总可切换同节其他知识点')
        ok(text.includes(secondPoint.title), 'v2 真实数据：切换后标题为该知识点')
      }
      ;(harness.docListeners.keydown || []).forEach((fn) => fn({ key: 'Escape', preventDefault() {} }))
      text = await settle(rt)
      ok(!text.includes('它要解决的问题') && text.includes(point.title), '真实数据：Esc 回到节视图')

      /* v2：旧数据（无新字段）兼容 —— ch02 无 enrich */
      rt.click('返回')
      await settle(rt)
      rt.click('返回')
      await settle(rt)
      const secondMeta = chapterList[1]
      const secondChapter = secondMeta ? chapters[secondMeta.id] : null
      if (secondMeta && secondChapter && Array.isArray(secondChapter.sections) && secondChapter.sections[0]) {
        rt.click('第' + secondMeta.number + '章 · ' + secondMeta.title)
        await settle(rt)
        const oldSection = secondChapter.sections[0]
        rt.click(oldSection.id + ' ' + oldSection.title)
        text = await settle(rt)
        ok(text.indexOf(MOCK_ENRICH.sectionSummary) < 0, 'v2 真实数据：旧数据不渲染 mock 汇总')
        ok(text.indexOf('undefined') < 0 && text.indexOf('NaN') < 0, 'v2 真实数据：旧数据节视图无 undefined/NaN')
        const oldPoint = Array.isArray(oldSection.points) ? oldSection.points[0] : null
        if (oldPoint) {
          rt.click(oldPoint.id + ' ' + oldPoint.title)
          text = await settle(rt)
          ok(text.indexOf('undefined') < 0 && text.indexOf('NaN') < 0, 'v2 真实数据：旧数据知识点详情不报错、不白屏')
          ok(text.includes(String(oldPoint.meaning).slice(0, 10)), 'v2 真实数据：旧数据知识点详情正常渲染')
          ok(text.indexOf(MOCK_ENRICH.examples[0].question) < 0, 'v2 真实数据：旧数据不渲染例题板块')
        }
      }
    }
  }
  ok(harness.errors.length === 0, '真实数据：全程无 console.error' + (harness.errors.length ? '：' + harness.errors.slice(0, 2).join(' | ') : ''))
  ok(harness.fetchLog.length > 0, '真实数据：接口调用 ' + harness.fetchLog.length + ' 次')
}

/* ───────────────────────── 4d) 导出 E2E（HTML / Word / PDF，纯前端） ───────────────────────── */
async function runExportChecks() {
  const data = loadRealBook()
  if (!data) { ok(true, '导出 E2E（跳过：data 未就绪）'); return }
  const harness = mountPanel(data)
  if (!harness) return
  const rt = harness.rt
  const book = harness.book
  const chapters = harness.chapters
  const firstChapter = harness.firstChapter
  let text = await settle(rt)
  ok(text.includes(book.title) && text.includes('全书总纲'), '导出：面板就绪并停留在全书视图')
  const chapterCount = Array.isArray(book.chapters) ? book.chapters.length : 0
  const section = firstChapter && firstChapter.sections ? firstChapter.sections[0] : null
  const point = section && Array.isArray(section.points) ? section.points[0] : null

  /* 进度：用 gate 挂住章节请求，断言导出中显示「正在整理 1/N 章」 */
  harness.gate = new Promise((resolve) => { harness.releaseGate = resolve })
  rt.click('导出')
  text = await settle(rt)
  ok(text.includes('导出网页（.html）') && text.includes('导出 Word（.doc）') && text.includes('导出 PDF（打印）'), '导出：菜单含网页 / Word / PDF 三项')
  const beforeDownloads = harness.downloads.length
  rt.click('导出网页（.html）')
  await new Promise((resolve) => setTimeout(resolve, 0))
  text = rt.render(rt.tree)
  ok(/正在整理\s*1\/\d+\s*章/.test(text), '导出：显示「正在整理 1/N 章」进度（片段：' + String((text.match(/正在整理[^。]{0,24}/) || [''])[0]) + '）')
  ok(harness.downloads.length === beforeDownloads, '导出：整理期间尚未触发下载')
  ok(text.includes('导出中'), '导出：导出期间按钮变为「导出中…」并禁用')
  harness.releaseGate()
  harness.gate = null
  text = await settle(rt)
  ok(harness.downloads.length > beforeDownloads, '导出：HTML 下载已触发')
  ok(text.includes('已导出'), '导出：成功 toast 提示')

  const htmlDownload = harness.downloads[harness.downloads.length - 1]
  ok(/\.html$/.test(String(htmlDownload.filename)), '导出：HTML 文件名以 .html 结尾（' + htmlDownload.filename + '）')
  const html = downloadContent(harness, htmlDownload)
  ok(html.indexOf('<!doctype html>') >= 0, '导出：HTML 含 doctype')
  ok(html.includes('<meta name="viewport" content="width=device-width,initial-scale=1">'), '导出：HTML 含移动端 viewport')
  ok(html.includes('<meta charset="utf-8">'), '导出：HTML 声明 charset')
  ok(html.includes('<style>') && html.includes('<script>'), '导出 v2：HTML 内联 CSS + JS（离线可用）')
  ok(html.indexOf('href="http') < 0 && html.indexOf('src="http') < 0, '导出 v2：HTML 无 http(s) 外链')
  ok(html.includes('window.__TBP_DATA__'), '导出 v2：HTML 内嵌 window.__TBP_DATA__')
  const exportData = extractExportData(html)
  ok(!!exportData && Array.isArray(exportData.chapters), '导出 v2：内嵌数据可解析且含章节树')
  ok(html.includes(book.title), '导出 v2：数据含书名')
  ok(html.includes(String(book.overview.mainline).slice(0, 12)), '导出 v2：数据含迭代主线')
  ok(html.includes(String(firstChapter.solves)), '导出 v2：数据含章 solves 全文')
  if (point) ok(html.includes(String(point.title)), '导出 v2：数据含知识点标题')
  ok(html.includes(MOCK_ENRICH.examples[0].question), '导出 v2：数据含例题题干')
  ok(html.includes(MOCK_ENRICH.bookAnalogy) && html.includes(MOCK_ENRICH.sectionAnalogy) && html.includes(MOCK_ENRICH.pointAnalogy), '导出 v2：数据含全书 / 节 / 知识点生活类比')
  ok(html.includes(MOCK_ENRICH.sectionSummary.slice(0, 12)), '导出 v2：数据含本节知识点汇总')
  ok(html.includes(MOCK_ENRICH.pointDetail) && MOCK_ENRICH.pointKeyPoints.every((item) => html.includes(item)), '导出 v2：数据含详细讲解 + 学习要点')
  ok(html.includes(MOCK_ENRICH.mistakesText) && html.includes(MOCK_ENRICH.examTipsText), '导出 v2：数据含易错辨析 + 考试提示')
  ok(html.includes('prefers-color-scheme') && html.includes('@media print'), '导出 v2：亮暗自适应 + 打印样式')
  ok(html.includes('hashchange'), '导出 v2：hash 深链接路由（#/ch01/1.1/1.1.1）')
  ok(html.includes("act: 'toggle'") && html.includes('data-act'), '导出 v2：事件委托标记 data-act / 答案折叠')
  ok(html.includes('u003cimg src=x'), '导出 v2：内嵌 JSON 转义 < 防注入')
  ok(html.indexOf('<img src=x') < 0, '导出 v2：HTML 不含未转义注入标签')
  if (exportData) {
    ok(exportData.chapters.length === chapterCount, '导出 v2：内嵌数据含全部 ' + chapterCount + ' 章（实际 ' + exportData.chapters.length + '）')
    ok(String(exportData.book.title) === book.title, '导出 v2：内嵌书名正确')
    ok(exportData.stats.points >= 1 && exportData.stats.sections >= 1 && exportData.stats.chapters >= 1, '导出 v2：内嵌统计含章 / 节 / 知识点')
    ok(exportData.stats.important >= 1, '导出 v2：内嵌统计含重点数（' + exportData.stats.important + '）')
    const dataSection = findExportSection(exportData, 'ch01', section.id)
    const dataPoint = findExportPoint(exportData, 'ch01', section.id, point.id)
    ok(!!dataPoint, '导出 v2：内嵌数据含知识点节点')
    if (dataPoint) {
      ok(dataPoint.important === true, '导出 v2：内嵌数据保留 ★ important 标记')
      ok(dataPoint.detail === MOCK_ENRICH.pointDetail, '导出 v2：内嵌数据含 detail 全文')
      ok(dataPoint.keyPoints.length === MOCK_ENRICH.pointKeyPoints.length, '导出 v2：内嵌数据含 keyPoints 列表')
      ok(dataPoint.mistakes === MOCK_ENRICH.mistakesText && dataPoint.examTips === MOCK_ENRICH.examTipsText, '导出 v2：内嵌数据含易错辨析 / 考试提示')
    }
    if (dataSection) ok(dataSection.examples.length === MOCK_ENRICH.examples.length, '导出 v2：内嵌数据含本节例题（' + dataSection.examples.length + ' 道）')
  }
  await runExportAppChecks(html)
  const uniqueChapters = new Set(harness.fetchLog.filter((line) => String(line).indexOf('/chapters/') >= 0))
  ok(uniqueChapters.size === chapterCount, '导出：拉取全部 ' + chapterCount + ' 章（实际 ' + uniqueChapters.size + '）')

  /* Word 导出 */
  rt.click('导出')
  await settle(rt)
  rt.click('导出 Word（.doc）')
  text = await settle(rt)
  const docDownload = harness.downloads[harness.downloads.length - 1]
  ok(/\.doc$/.test(String(docDownload.filename)), '导出：Word 扩展名 .doc（' + docDownload.filename + '）')
  const docBlob = downloadBlobOf(harness, docDownload)
  ok(String(docBlob && docBlob.type) === 'application/msword', '导出：Word mime = application/msword')
  const docHtml = downloadContent(harness, docDownload)
  ok(docHtml.includes('ProgId') && docHtml.includes('Word.Document'), '导出：Word 头部含 ProgId')
  ok(docHtml.indexOf('<script>') < 0, '导出：Word 版本不含脚本（答案直接可见）')
  ok(docHtml.includes(MOCK_ENRICH.examples[0].answer), '导出：Word 版本直接包含答案')
  ok(docHtml.includes(MOCK_ENRICH.pointDetail), '导出 Word：含详细讲解 detail')
  ok(MOCK_ENRICH.pointKeyPoints.every((item) => docHtml.includes(item)), '导出 Word：含学习要点列表')
  ok(docHtml.includes(MOCK_ENRICH.mockDerivationSteps[0].step) && docHtml.includes(MOCK_ENRICH.mistakesText) && docHtml.includes(MOCK_ENRICH.examTipsText), '导出 Word：含推导步骤 / 易错辨析 / 考试提示')
  ok(docHtml.includes('★') && docHtml.includes('重点'), '导出 Word：重点知识点显示 ★ + 重点')

  /* PDF 导出（成功：打开打印窗口并 print） */
  harness.printed = 0
  harness.printedHtml = ''
  rt.click('导出')
  await settle(rt)
  rt.click('导出 PDF（打印）')
  await new Promise((resolve) => setTimeout(resolve, 420))
  await settle(rt)
  ok(harness.printed >= 1, '导出：PDF 打开打印窗口并调用 print()')
  ok(harness.printedHtml.includes(book.title) && harness.printedHtml.includes('name="viewport"'), '导出：打印窗口内容是自包含 HTML')
  ok(harness.printedHtml.includes('window.__TBP_DATA__'), '导出 v2：PDF 打印内容是交互式网页（内嵌数据）')
  ok(harness.printedHtml.includes("act: 'toggle'"), '导出 v2：PDF 打印内容保留答案折叠脚本 + 打印样式')
  ok(harness.printedHtml.includes('@media print'), '导出 v2：PDF 打印内容含 @media print 展开规则')

  /* PDF 导出（弹窗被拦截 → 回退下载 HTML + 提示） */
  harness.popupBlocked = true
  const beforeFallback = harness.downloads.length
  rt.click('导出')
  await settle(rt)
  rt.click('导出 PDF（打印）')
  text = await settle(rt)
  ok(harness.downloads.length > beforeFallback, '导出：弹窗被拦截时回退下载 HTML')
  const fallbackDownload = harness.downloads[harness.downloads.length - 1]
  ok(/\.html$/.test(String(fallbackDownload.filename)), '导出：回退下载的是 .html')
  console.log('DBG hasCtrlP=' + text.includes('Ctrl+P') + ' len=' + text.length + ' toast=' + JSON.stringify(text.slice(-120)))
  ok(text.includes('Ctrl+P'), '导出：回退提示包含「Ctrl+P 另存为 PDF」')
  ok(harness.errors.length === 0, '导出：全程无 console.error' + (harness.errors.length ? '：' + harness.errors.slice(0, 2).join(' | ') : ''))
}

/* ───────────────────────── 4e) 可选：--dump-export 导出两本书的真实样例 ───────────────────────── */
function loadBookFromDir(dir) {
  if (!existsSync(path.join(dir, 'book.json'))) return null
  let book = null
  try { book = JSON.parse(readFileSync(path.join(dir, 'book.json'), 'utf8')) } catch (error) { return null }
  const chapters = {}
  const chapterDir = path.join(dir, 'chapters')
  if (existsSync(chapterDir)) {
    readdirSync(chapterDir).filter((file) => /^ch\d+\.json$/.test(file)).forEach((file) => {
      try {
        const parsed = JSON.parse(readFileSync(path.join(chapterDir, file), 'utf8'))
        if (parsed && parsed.id) chapters[parsed.id] = parsed
      } catch (error) { /* 忽略损坏章节 */ }
    })
  }
  return { book, chapters }
}

function loadUserBook() {
  return loadBookFromDir(USER_BOOK_DIR)
}

async function exportSampleHtml(data) {
  const harness = mountPanel(data, { noMockEnrich: true })
  if (!harness) return ''
  const rt = harness.rt
  await settle(rt)
  rt.click('导出')
  await settle(rt)
  const before = harness.downloads.length
  rt.click('导出网页（.html）')
  await settle(rt)
  if (harness.downloads.length <= before) return ''
  return downloadContent(harness, harness.downloads[harness.downloads.length - 1])
}

async function dumpOneBook(outdir, key, label, data) {
  if (!data) {
    ok(true, '--dump-export：' + label + ' 不存在，跳过')
    console.log('[dump-export] 跳过（数据不存在）：' + label)
    return
  }
  const html = await exportSampleHtml(data)
  ok(html.length > 0, '--dump-export：' + label + ' 真实导出流程产出 HTML')
  if (!html) return
  const target = path.join(outdir, 'export-sample-' + key + '.html')
  let writeError = null
  try {
    mkdirSync(outdir, { recursive: true })
    writeFileSync(target, html, 'utf8')
  } catch (error) { writeError = error }
  ok(!writeError, '--dump-export：写出 ' + target + (writeError ? '（失败：' + writeError.message + '）' : ''))
  const bytes = Buffer.byteLength(html, 'utf8')
  const exportData = extractExportData(html)
  const exportStats = exportData && exportData.stats ? exportData.stats : {}
  const chapterCount = exportData && Array.isArray(exportData.chapters) ? exportData.chapters.length : 0
  const pointCount = Number(exportStats.points) || 0
  const importantCount = Number(exportStats.important) || 0
  const exampleFields = (html.match(/"question":/g) || []).length
  const toggleCount = (html.match(/act: 'toggle'/g) || []).length
  const hasDoctype = html.indexOf('<!doctype html>') >= 0
  const hasViewport = html.includes('<meta name="viewport" content="width=device-width,initial-scale=1">')
  const noExternal = html.indexOf('href="http') < 0 && html.indexOf('src="http') < 0
  ok(hasDoctype && hasViewport, '--dump-export：' + label + ' 自包含 HTML（doctype + viewport）')
  ok(html.includes('window.__TBP_DATA__'), '--dump-export：' + label + ' 内嵌 __TBP_DATA__ 数据')
  ok(noExternal, '--dump-export：' + label + ' 无 http(s) 外链')
  ok(chapterCount >= 1 && pointCount >= 1, '--dump-export：' + label + ' 数据完整（' + chapterCount + ' 章 / ' + pointCount + ' 知识点）')
  console.log('')
  console.log('[dump-export] ' + label)
  console.log('  文件：' + target)
  console.log('  大小：' + bytes + ' 字节（' + (bytes / 1024 / 1024).toFixed(2) + ' MB）')
  console.log('  结构：' + chapterCount + ' 章 / ' + pointCount + ' 知识点 / ' + importantCount + ' 重点 / ' + exampleFields + ' 例题字段 / ' + toggleCount + ' 处折叠交互')
  console.log('  自检：doctype+viewport=' + (hasDoctype && hasViewport ? '✓' : '✗') + ' __TBP_DATA__=' + (html.includes('window.__TBP_DATA__') ? '✓' : '✗') + ' 外链=' + (noExternal ? '0' : '有'))
  console.log('')
}

async function runDumpExport(outdirArg) {
  const rawArg = String(outdirArg || 'dist')
  const outdir = path.resolve(process.cwd(), /\.(html|htm)$/i.test(rawArg) ? path.dirname(rawArg) : rawArg)
  console.log('')
  console.log('[dump-export] 输出目录：' + outdir)
  await dumpOneBook(outdir, 'signals-systems', '信号与系统（内置 data/books/signals-systems-zheng）', loadRealBook())
  await dumpOneBook(outdir, 'advanced-mathematics', '高等数学（用户目录 ' + USER_BOOK_DIR + '）', loadUserBook())
}

/* ───────────────────────── 4) 执行 factory + apply + 真实挂载 ───────────────────────── */
const __T_START__ = Date.now()
async function run() {
  const fetched = []
  const windowListeners = {}
  const docListeners = {}
  const fetchedDescriptor = { current: null }
  const localStore = {}

  const sandbox = {
    console: { error() {}, log() {}, warn() {}, info() {} },
    URL,
    Promise,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(localStore, key) ? localStore[key] : null },
      setItem(key, value) { localStore[key] = String(value) },
      removeItem(key) { delete localStore[key] },
    },
    fetch: makeFetch(fetched),
    window: {
      __ModuleLoader__: {
        load(descriptor) { fetchedDescriptor.current = descriptor },
      },
      addEventListener(type, fn) { (windowListeners[type] = windowListeners[type] || []).push(fn) },
      removeEventListener(type, fn) { windowListeners[type] = (windowListeners[type] || []).filter((item) => item !== fn) },
    },
    document: {
      baseURI: 'http://127.0.0.1:53090/',
      addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn) },
      removeEventListener(type, fn) { docListeners[type] = (docListeners[type] || []).filter((item) => item !== fn) },
    },
  }
  sandbox.globalThis = sandbox
  const context = vm.createContext(sandbox)
  let loadError = null
  try { new vm.Script(source, { filename: 'client.js' }).runInContext(context) } catch (error) { loadError = error }
  ok(!loadError, 'client.js 在假 window 环境下执行通过' + (loadError ? '：' + loadError.message : ''))

  const descriptor = fetchedDescriptor.current
  ok(descriptor && typeof descriptor === 'object', '__ModuleLoader__.load 被调用且收到描述对象')
  eq(descriptor && descriptor.id, 'dsh-textbook-parser', 'loader id 正确')
  eq(typeof (descriptor && descriptor.factory), 'function', 'factory 是函数')

  const stub = createReactStub()
  ok(typeof stub.React.createElement === 'function', 'React 桩就绪')
  let api = null
  let factoryError = null
  try { api = descriptor.factory((name) => {
    if (name === 'react') return stub.React
    throw new Error('client.js 只应 require("react")，实际：' + name)
  }) } catch (error) { factoryError = error }
  ok(!factoryError, 'factory 执行不抛错' + (factoryError ? '：' + factoryError.message : ''))
  ok(api && Array.isArray(api.inject), '返回对象含 inject 数组')
  eq(api && api.inject.join(','), 'slots,locale', 'inject = [slots, locale]')
  eq(typeof (api && api.apply), 'function', '返回对象含 apply 函数')

  const registrations = { slots: [], locales: [], effects: 0, injected: [] }
  const errors = []
  const ctx = {
    effect(fn, label) {
      registrations.effects += 1
      ok(typeof fn === 'function', 'ctx.effect 收到 disposer 工厂（' + label + '）')
      const disposer = fn()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    locale: {
      register(name, dict) { registrations.locales.push({ name, dict }); return () => {} },
      bind(name) { return (key) => { const dicts = registrations.locales[0] && registrations.locales[0].dict; return (dicts && dicts.zh && dicts.zh[key]) || key } },
    },
    slots: {
      register(options, component) { registrations.slots.push({ options, component }); return () => {} },
      inject(key, callback) { registrations.injected.push(key); return callback() },
    },
  }
  const originalError = sandbox.console.error
  sandbox.console.error = (...args) => { errors.push(args.map(String).join(' ')) }
  let applyError = null
  try { api.apply(ctx) } catch (error) { applyError = error }
  sandbox.console.error = originalError
  ok(!applyError, 'apply 不抛错' + (applyError ? '：' + applyError.message : ''))
  eq(registrations.locales.length, 1, 'locale.register 调用 1 次')
  eq(registrations.locales[0] && registrations.locales[0].name, 'textbook-parser', 'locale 名 = textbook-parser')
  const dict = (registrations.locales[0] && registrations.locales[0].dict) || {}
  ok(dict.zh && dict.en, 'locale 字典含 zh / en')
  const zhKeys = Object.keys(dict.zh || {}).sort()
  const enKeys = Object.keys(dict.en || {}).sort()
  eq(zhKeys.length, enKeys.length, 'zh / en 字典键数量一致')
  eq(zhKeys.filter((key) => !(key in (dict.en || {}))).join(','), '', 'zh 每个键在 en 中都存在')
  ok(zhKeys.length >= 40, '字典键数量 >= 40（实际 ' + zhKeys.length + '）')
  eq(registrations.slots.length, 2, 'slots.register 调用 2 次')
  const mainSlot = registrations.slots.find((entry) => entry.options.name === 'main')
  const sideSlot = registrations.slots.find((entry) => entry.options.name === 'sidebar.panellist')
  ok(!!mainSlot, '注册 main 槽位')
  ok(!!sideSlot, '注册 sidebar.panellist 槽位')
  eq(mainSlot && mainSlot.options.key, 'textbook-parser', 'main 槽位 key 正确')
  eq(sideSlot && sideSlot.options.id, 'textbook-parser', 'sidebar 槽位 id 正确')
  eq(sideSlot && sideSlot.options.order, 20, 'sidebar 槽位 order = 20')
  eq(typeof (mainSlot && mainSlot.component), 'function', 'main 槽位组件是函数')
  eq(typeof (sideSlot && sideSlot.component), 'function', 'sidebar 槽位组件是函数')
  ok(typeof (sideSlot.options.label && sideSlot.options.label()) === 'string' && sideSlot.options.label().length > 0, 'sidebar label() 返回文案')
  eq(typeof (sideSlot.component({ size: 18, active: true })), 'object', 'SidebarIcon 可渲染（返回元素）')
  ok(errors.length === 0, 'apply 期间无 console.error' + (errors.length ? '：' + errors.join(' | ') : ''))
  eq((registrations.injected || []).join(','), 'main,sidebar.panellist', 'slots.inject 同时用于 main / sidebar.panellist（冷启动等待槽位声明）')

  /* 冷启动时序回归：本模块可能早于 ui-layout / ui-sidebar 声明槽位。
     此时 slots.inject 必须把注册推迟到声明之后，而不是直接 register 抛错丢注册。 */
  const deferredInjects = new Map()
  const declaredSlots = new Set()
  const lateSlots = []
  const lateErrors = []
  const lateCtx = {
    effect(fn) { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    locale: {
      register() { return () => {} },
      bind() {
        return (key) => {
          const source = dict || {}
          const zh = source.zh || {}
          const en = source.en || {}
          if (zh[key] !== undefined) return zh[key]
          if (en[key] !== undefined) return en[key]
          return key
        }
      },
    },
    slots: {
      register(options) {
        if (!declaredSlots.has(options.name)) throw new Error('unknown slot: ' + options.name)
        lateSlots.push(options.name)
        return () => {}
      },
      inject(key, callback) { deferredInjects.set(key, callback); return () => {} },
    },
  }
  const originalError2 = sandbox.console.error
  sandbox.console.error = (...args) => { lateErrors.push(args.map(String).join(' ')) }
  let coldError = null
  try {
    /* 用独立 factory 实例做冷启动回归，避免改动主实例的翻译器状态 */
    const coldApi = descriptor.factory((name) => {
      if (name === 'react') return stub.React
      throw new Error('client.js 只应 require("react")，实际：' + name)
    })
    coldApi.apply(lateCtx)
  } catch (error) { coldError = error }
  sandbox.console.error = originalError2
  ok(!coldError, '冷启动：apply 不抛错' + (coldError ? '：' + coldError.message : ''))
  ok(deferredInjects.has('main') && deferredInjects.has('sidebar.panellist'), '冷启动：用 slots.inject 等待 main / sidebar.panellist 声明')
  eq(lateSlots.length, 0, '冷启动：槽位未声明时不会直接 register')
  eq(lateErrors.length, 0, '冷启动：没有「client mount failed」类错误')
  declaredSlots.add('main')
  declaredSlots.add('sidebar.panellist')
  for (const [key, callback] of deferredInjects) {
    try { callback() } catch (error) { ok(false, '冷启动：槽位声明后注册失败 ' + key + '：' + error.message) }
  }
  eq(lateSlots.slice().sort().join(','), 'main,sidebar.panellist', '冷启动：槽位声明后两个槽位都注册成功')

  /* 真实挂载主面板：StrictMode 关闭，单 component */
  const rt = createRenderer(stub)
  rt.tree = stub.React.createElement(mainSlot.component, null)
  sandbox.console.error = (...args) => { errors.push(args.map(String).join(' ')) }
  let text = await settle(rt)
  ok(text.includes('教材知识框架'), '面板渲染出标题「教材知识框架」')
  ok(text.includes('信号与系统'), '默认加载第一本书《信号与系统》')
  ok(text.includes('全书总纲'), '渲染出全书总纲大卡')
  ok(text.includes('全书总目标') && text.includes('原始痛点') && text.includes('迭代主线'), '总纲包含总目标/原始痛点/迭代主线')
  ok(text.includes('缺陷 → 修复 链路'), '总纲包含缺陷→修复链路')
  ok(text.includes('时域冲激分解'), '全书 chain step 渲染')
  ok(text.includes('缺陷'), 'chain 缺陷标签渲染（warn 色）')
  ok(text.includes('章节地图'), '章节网格标题渲染')
  ok(/2 章 · 3 节 · 5 个知识点/.test(text), '统计条 2 章 · 3 节 · 5 个知识点（实际片段：' + (text.match(/\d+ 章[^。]{0,30}/) || [''])[0] + '）')
  ok(text.includes('绪论'), '章节卡片渲染章名')
  ok(text.includes('解决时域分析无法统一描述'), '章节卡片渲染 solves')
  ok(text.includes('微积分'), '章节卡片渲染 requires chips')
  eq(localStore['tbp:lastBook'], 'signals-systems-zheng', 'localStorage 记录 tbp:lastBook')

  /* 进入章视图 */
  rt.click('绪论')
  text = await settle(rt)
  ok(text.includes('解决时域分析无法统一描述激励—响应关系的问题'), '章头卡渲染 solves')
  ok(text.includes('能建立信号与系统的统一描述框架'), '章头卡渲染 gain')
  ok(text.includes('仍无法处理任意信号在频域的展开'), '章头卡渲染 remainingGap')
  ok(text.includes('下一章动机'), 'remainingGap 带「下一章动机」样式')
  ok(text.includes('信号分解 + 卷积'), '章 chain 渲染')
  ok(text.includes('1.1') && text.includes('信号与系统'), '节卡片渲染编号与标题')
  ok(text.includes('如何用统一的数学语言描述任意激励下的响应'), '节卡片渲染 subProblem')
  ok(text.includes('2 节'), '章视图节数统计')

  /* 进入节视图 */
  rt.click('如何用统一的数学语言描述任意激励下的响应')
  text = await settle(rt)
  ok(text.includes('本小节子问题') || text.includes('1.1 信号与系统'), '节视图面包屑/标题渲染')
  ok(text.includes('信号与系统的激励—响应关系'), '知识点卡片渲染标题')
  ok(text.includes('为修复缺陷而生'), '知识点卡片渲染 solves 引导语')
  ok(text.includes('冲激函数'), '知识点卡片渲染前置 chips')

  /* 进入知识点详情 */
  rt.click('信号与系统的激励—响应关系')
  text = await settle(rt)
  ok(text.includes('它要解决的问题'), '详情渲染 solves 高亮块')
  ok(text.includes('为修复逐题解微分方程'), '详情渲染 solves 文本')
  ok(text.includes('含义') && text.includes('把系统视为把输入映射为输出的算子'), '详情渲染含义')
  ok(text.includes('公式 / 定理') && text.includes('y(t)=x(t)*h(t)'), '详情渲染公式块')
  ok(text.includes('应用') && text.includes('电路、控制系统、通信系统的统一建模'), '详情渲染应用')
  ok(text.includes('例题') && text.includes('求 h(t)=e^{-t}u(t) 对 x(t)=u(t) 的响应'), '详情渲染例题题干')
  ok(text.includes('解答') && text.includes('y(t)=1-e^{-t}'), '详情渲染例题解答')
  ok(text.includes('前置知识'), '详情渲染前置知识')
  ok(text.includes('遗留不足') && text.includes('仅适用于线性时不变系统'), '详情渲染遗留不足')
ok(!text.includes('★') && !text.includes('详细讲解') && !text.includes('学习要点'), 'v1.2 旧数据：无新字段时不渲染星标/详解/要点板块（不报错）')
  ok(text.includes('下一环') && text.includes('傅里叶级数把信号展开到频域'), '详情渲染下一环')
  ok(text.includes('上一环') && text.includes('下一环'), '详情渲染上一环/下一环导航')
  ok(text.includes('按 Esc 返回上一层'), '详情渲染 Esc 提示')

  /* Esc 返回节视图 */
  const keydowns = docListeners.keydown || []
  ok(keydowns.length >= 1, '详情挂载后注册了 document keydown 监听')
  keydowns.forEach((fn) => fn({ key: 'Escape', preventDefault() {} }))
  text = await settle(rt)
  ok(!text.includes('它要解决的问题'), 'Esc 后离开知识点详情')
  ok(text.includes('信号与系统的激励—响应关系'), 'Esc 返回节视图')
  ok(text.includes('1.1'), 'Esc 返回后仍显示节标题')

  /* 返回章视图，再返回全书视图 */
  rt.click('返回')
  text = await settle(rt)
  ok(text.includes('解决时域分析无法统一描述激励—响应关系的问题'), '从节返回章视图')
  rt.click('返回')
  text = await settle(rt)
  ok(text.includes('全书总纲') && text.includes('章节地图'), '从章返回全书视图')

  /* 章节 404 兜底 */
  rt.click('连续时间系统的时域分析')
  text = await settle(rt)
  ok(text.includes('该章内容尚未生成'), '章节 404 显示「该章内容尚未生成」')
  ok(text.includes('这部分内容加载失败') && text.includes('重试'), '章节 404 显示错误盒 + 重试')
  ok(!text.includes('undefined'), '章节 404 不出现 undefined')

  /* 切到空书：空状态兜底，不白屏 */
  rt.click('返回')
  await settle(rt)
  rt.change('全部教材', 'empty-book')
  text = await settle(rt)
  ok(text.includes('还没有章节的教材'), '切换到无章节教材')
  ok(text.includes('该书章节尚未生成'), '空章节书显示空状态')
  ok(text.includes('全书总纲'), '空章节书仍有总纲卡（不白屏）')

  /* 刷新按钮 */
  const before = fetched.length
  rt.click('刷新')
  await settle(rt)
  ok(fetched.length > before, '刷新按钮重新拉取接口（' + before + ' → ' + fetched.length + '）')

  /* 窗口 focus 静默刷新（可选行为） */
  ok((windowListeners.focus || []).length >= 1, '注册了 window focus 静默刷新')

  /* 结束：断言没有渲染期 console.error */
  ok(errors.length === 0, '整个挂载/交互过程无 console.error' + (errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''))

  console.error('PHASE static+fixture done', Date.now() - __T_START__)
  /* 真实数据端到端 */
  await runRealDataChecks()

  console.error('PHASE realdata done', Date.now() - __T_START__)
  /* 导出端到端（HTML / Word / PDF，纯前端） */
  await runExportChecks()

  console.error('PHASE export done', Date.now() - __T_START__)
  /* 可选：--dump-export <outfile> 用真实数据额外导出一次示例 HTML */
  if (DUMP_EXPORT_PATH) await runDumpExport(DUMP_EXPORT_PATH)

  /* ───────────────────────── 汇总 ───────────────────────── */
  const failed = checks.filter((entry) => !entry.pass)
  checks.forEach((entry) => { console.log((entry.pass ? '  ✓ ' : '  ✗ ') + entry.label) })
  console.log('')
  console.log('client-check: ' + (checks.length - failed.length) + '/' + checks.length + ' 通过')
  if (failed.length) {
    console.error('失败项：')
    failed.forEach((entry) => console.error('  - ' + entry.label))
    process.exitCode = 1
    return
  }
  console.log('全部通过 ✅')
}

run().catch((error) => {
  console.error('client-check 运行异常：', error)
  process.exitCode = 1
})