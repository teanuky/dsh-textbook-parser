/**
 * textbook-parser · 只读 HTTP API（挂在宿主同一端口）
 *
 * 路径前缀固定为 /dsh-textbook-parser/api，由 ctx.webServer.register({kind:'prefix'}) 注册。
 * 仅支持 GET/HEAD；所有响应 JSON + no-store；不泄漏堆栈（错误详情只写 console.error）。
 *
 *   GET /dsh-textbook-parser/api/health
 *   GET /dsh-textbook-parser/api/books
 *   GET /dsh-textbook-parser/api/books/<bookId>
 *   GET /dsh-textbook-parser/api/books/<bookId>/chapters/<chapterId>
 */
export const API_PREFIX = '/dsh-textbook-parser/api'
export const PLUGIN_NAME = 'dsh-textbook-parser'
export const DEFAULT_VERSION = '1.0.0'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

function sendJson(res, statusCode, payload, options = {}) {
  const body = JSON.stringify(payload)
  const headers = { ...JSON_HEADERS, 'content-length': Buffer.byteLength(body) }
  if (options.allow) headers.allow = options.allow
  try {
    if (res && typeof res.writeHead === 'function') {
      res.writeHead(statusCode, headers)
    } else if (res && typeof res.setHeader === 'function') {
      res.statusCode = statusCode
      for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
    }
    if (res && typeof res.end === 'function') res.end(options.head ? undefined : body)
  } catch (error) {
    console.error('[textbook-parser] 写 HTTP 响应失败：', error)
  }
}

function routeHint() {
  return '可用接口：GET /dsh-textbook-parser/api/health、/books、/books/<bookId>、/books/<bookId>/chapters/<chapterId>'
}

/**
 * 创建 prefix 路由 handler。
 * @param {ReturnType<import('./store.js').createStore>} store
 * @param {() => { skillRegistered?: boolean, toolRegistered?: boolean, routesRegistered?: boolean }} [getStatus]
 * @param {{ version?: string }} [options]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createRoutes(store, getStatus = () => ({}), options = {}) {
  if (!store || typeof store.listBooks !== 'function') {
    throw new TypeError('createRoutes 需要一个合法的 store 实例')
  }
  const version = typeof options.version === 'string' && options.version ? options.version : DEFAULT_VERSION
  const statusOf = typeof getStatus === 'function' ? getStatus : () => ({})

  async function handleHealth() {
    const status = statusOf() || {}
    let books = []
    try {
      books = await store.listBooks()
    } catch (error) {
      console.error('[textbook-parser] health 读取教材列表失败：', error)
    }
    return {
      status: 200,
      payload: {
        ok: true,
        plugin: PLUGIN_NAME,
        version,
        dataDir: store.userRoot,
        skillRegistered: status.skillRegistered === true,
        toolRegistered: status.toolRegistered === true,
        routesRegistered: status.routesRegistered === true,
        books: Array.isArray(books) ? books.length : 0,
      },
    }
  }

  async function handleBooks() {
    const books = await store.listBooks()
    return { status: 200, payload: { ok: true, books } }
  }

  async function handleBook(bookId) {
    const book = await store.getBook(bookId)
    if (!book) {
      return { status: 404, payload: { ok: false, error: `未找到教材「${bookId}」。可先请求 /books 查看已有 bookId。` } }
    }
    return { status: 200, payload: { ok: true, book } }
  }

  async function handleChapter(bookId, chapterId) {
    const chapter = await store.getChapter(bookId, chapterId)
    if (!chapter) {
      return {
        status: 404,
        payload: {
          ok: false,
          error: `未找到教材「${bookId}」的章「${chapterId}」：chapters/${chapterId}.json 尚未保存或 bookId 不存在。`,
        },
      }
    }
    return { status: 200, payload: { ok: true, chapter } }
  }

  async function dispatch(req, res) {
    const method = String(req && req.method ? req.method : 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: '该接口是只读的，只支持 GET/HEAD 请求。' }, { allow: 'GET, HEAD' })
      return
    }
    const head = method === 'HEAD'

    let url
    try {
      url = new URL(String(req && req.url ? req.url : '/'), 'http://localhost')
    } catch {
      sendJson(res, 400, { ok: false, error: '请求 URL 不合法。' }, { head })
      return
    }
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      sendJson(res, 400, { ok: false, error: '请求路径的 URL 编码不合法。' }, { head })
      return
    }
    if (pathname !== API_PREFIX && !pathname.startsWith(`${API_PREFIX}/`)) {
      sendJson(res, 404, { ok: false, error: `该路径不属于 textbook-parser API。${routeHint()}` }, { head })
      return
    }

    const relative = pathname.slice(API_PREFIX.length).replace(/\/+$/, '')
    const segments = relative.split('/').filter(Boolean)
    let result = null

    if (segments.length === 1 && segments[0] === 'health') {
      result = await handleHealth()
    } else if (segments.length === 1 && segments[0] === 'books') {
      result = await handleBooks()
    } else if (segments.length === 2 && segments[0] === 'books') {
      result = await handleBook(segments[1])
    } else if (segments.length === 4 && segments[0] === 'books' && segments[2] === 'chapters') {
      result = await handleChapter(segments[1], segments[3])
    } else {
      result = { status: 404, payload: { ok: false, error: `未知接口：${pathname}。${routeHint()}` } }
    }

    sendJson(res, result.status, result.payload, { head })
  }

  return async function textbookParserRoutes(req, res) {
    try {
      await dispatch(req, res)
    } catch (error) {
      console.error('[textbook-parser] API 请求处理失败：', error)
      const alreadySent = Boolean(res && (res.headersSent || res.writableEnded))
      if (!alreadySent) {
        sendJson(res, 500, { ok: false, error: `textbook-parser API 内部错误：${error && error.message ? error.message : String(error)}` })
      }
    }
  }
}