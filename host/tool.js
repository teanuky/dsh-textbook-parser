/**
 * textbook-parser · textbook_archive 工具（模型落库入口）
 *
 * 全局工具名固定为 textbook_archive；execute 按 action 调 store，
 * output.render 负责给模型 1-3 条中文摘要（写入位置、统计、下一步动作）。
 */

export const TOOL_NAME = 'textbook_archive'

export const TOOL_DESCRIPTION = [
  '把拆解好的理工科教材知识框架保存到 textbook-parser 插件的数据目录，供侧边栏「教材知识框架」面板读取。',
  '教材拆解完成后必须调用本工具落库，不要手写文件到插件目录。',
  'action=save_book 先写入全书总纲与章/节骨架（book.json）；action=save_chapter 每完成一章就写一次该章的节与知识点（chapters/chNN.json），并自动更新全书 stats；',
  'action=list_books 列出已有教材（内置示例 + 用户保存）；action=get_book 读取全书结构（传 chapterId 可读单章详情）；action=delete_book 删除用户保存的教材（内置示例只读，不可删）。',
  '校验失败时错误信息会逐条列出字段路径，按提示修正后重试即可。',
].join('')

export const TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['save_book', 'save_chapter', 'list_books', 'get_book', 'delete_book'],
      description:
        '操作类型：save_book=保存全书总纲与章/节骨架；save_chapter=保存单章全部节与知识点；list_books=列出所有教材；get_book=读取教材（可指定 chapterId 读单章）；delete_book=删除用户保存的教材',
    },
    bookId: {
      type: 'string',
      description:
        '教材 id，kebab-case（小写字母/数字/连字符，如 signals-systems-zheng）。save_book 时若 book.id 缺失可用它补充；save_chapter / get_book / delete_book 时必填',
    },
    book: {
      type: 'object',
      additionalProperties: true,
      description:
        '仅 save_book 使用：完整 book.json 对象。必含 id、title、subject、tags、overview{goal,pain,mainline,chain[{step,detail,defect}]}、chapters[{id,number,title,solves,requires,gain,remainingGap,sections[{id,title,subProblem,pointCount}]}]、stats{chapters,sections,points}',
    },
    chapter: {
      type: 'object',
      additionalProperties: true,
      description:
        '仅 save_chapter 使用：完整章 JSON 对象。必含 id、number、title、solves、requires、gain、remainingGap、chain[{from,to,label}]（至少 2 项）、sections[{id,title,subProblem,requires,remaining,points[{id,title,solves,meaning,formula,application,example{question,answer},prerequisites,limitation,next}]}]',
    },
    chapterId: {
      type: 'string',
      description: '可选，仅 get_book 使用：读取某一章的完整详情（如 ch01）',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

export const TOOL_OUTPUT_SCHEMA = { type: 'object', additionalProperties: true }

const ACTIONS = TOOL_PARAMETERS.properties.action.enum
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function archiveError(message, errors = []) {
  const list = Array.isArray(errors) ? errors.filter((item) => typeof item === 'string' && item.trim()) : []
  const error = new Error(list.length > 0 ? `${message}（${list.length} 处）：\n- ${list.join('\n- ')}` : message)
  error.code = 'TBP_TOOL'
  error.errors = list
  return error
}

function normalizedBookId(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function countChapterPoints(chapter) {
  const sections = isPlainObject(chapter) && Array.isArray(chapter.sections) ? chapter.sections : []
  let points = 0
  for (const section of sections) {
    if (isPlainObject(section) && Array.isArray(section.points)) points += section.points.length
  }
  return points
}

function countChapterSections(chapter) {
  return isPlainObject(chapter) && Array.isArray(chapter.sections) ? chapter.sections.length : 0
}

function textBlock(text) {
  return { type: 'text', text: String(text) }
}

function sourceLabel(source) {
  return source === 'bundled' ? '内置示例' : source === 'user' ? '用户保存' : '未知来源'
}

// ---------------------------------------------------------------------------
// execute
// ---------------------------------------------------------------------------

async function saveBookAction(store, args) {
  if (!isPlainObject(args.book)) {
    throw archiveError(
      'save_book 需要 book 参数（完整的 book.json 对象，至少含 id/title/subject/tags/overview/chapters/stats）。可先参考 skill 的 schema 示例或 get_book 返回的结构。',
    )
  }
  const book = structuredClone(args.book)
  const bookIdArg = normalizedBookId(args.bookId)
  if (!book.id && bookIdArg) book.id = bookIdArg
  if (book.id && bookIdArg && book.id !== bookIdArg) {
    throw archiveError('bookId 与 book.id 不一致', [`参数 bookId="${bookIdArg}"，但 book.id="${book.id}"；两者必须相同，或省略 bookId 只传 book.id`])
  }
  const result = await store.saveBook(book)
  return {
    ok: true,
    action: 'save_book',
    bookId: result.bookId,
    title: result.title,
    stats: result.stats,
    chapterCount: Array.isArray(book.chapters) ? book.chapters.length : 0,
    path: result.path,
    dataDir: store.userRoot,
  }
}

async function saveChapterAction(store, args) {
  const bookId = normalizedBookId(args.bookId)
  if (!bookId) {
    throw archiveError(
      'save_chapter 需要 bookId 参数（book.json 中的教材 id，如 signals-systems-zheng）。如果还没有 book.json，请先调用 action="save_book" 保存全书总纲与章骨架。',
    )
  }
  if (!isPlainObject(args.chapter)) {
    throw archiveError(
      'save_chapter 需要 chapter 参数（完整的章 JSON 对象，含 id/number/title/solves/chain/sections 等）；可参考 skill 的 schema 示例。',
    )
  }
  const chapter = args.chapter
  const result = await store.saveChapter(bookId, chapter)
  return {
    ok: true,
    action: 'save_chapter',
    bookId: result.bookId,
    chapterId: result.chapterId,
    title: typeof chapter.title === 'string' ? chapter.title : '',
    number: Number.isInteger(chapter.number) ? chapter.number : null,
    sections: countChapterSections(chapter),
    points: countChapterPoints(chapter),
    stats: result.stats,
    bookUpdated: result.bookUpdated === true,
    path: result.path,
  }
}

async function listBooksAction(store) {
  const books = await store.listBooks()
  return { ok: true, action: 'list_books', count: books.length, books, dataDir: store.userRoot }
}

async function getBookAction(store, args) {
  const bookId = normalizedBookId(args.bookId)
  if (!bookId) {
    throw archiveError('get_book 需要 bookId 参数（教材 id，如 signals-systems-zheng）。可先调用 action="list_books" 查看已有 id。')
  }
  const book = await store.getBook(bookId)
  if (!book) {
    throw archiveError(
      `未找到教材「${bookId}」。可先调用 action="list_books" 查看已有 bookId；若是新教材，请先用 action="save_book" 保存全书总纲。`,
    )
  }
  const payload = {
    ok: true,
    action: 'get_book',
    bookId,
    book: {
      schemaVersion: book.schemaVersion,
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      subject: book.subject,
      tags: book.tags,
      updatedAt: book.updatedAt,
      stats: book.stats,
      source: book.source,
      overview: book.overview,
      chapters: Array.isArray(book.chapters) ? book.chapters : [],
    },
  }
  const chapterIdArg = normalizedBookId(args.chapterId)
  if (chapterIdArg) {
    const chapter = await store.getChapter(bookId, chapterIdArg)
    if (!chapter) {
      throw archiveError(
        `教材「${bookId}」没有章「${chapterIdArg}」：chapters/${chapterIdArg}.json 尚未保存。可先 save_chapter 保存该章，或不传 chapterId 只看全书结构。`,
      )
    }
    payload.chapter = chapter
  }
  return payload
}

async function deleteBookAction(store, args) {
  const bookId = normalizedBookId(args.bookId)
  if (!bookId) {
    throw archiveError('delete_book 需要 bookId 参数（要删除的教材 id）。可先调用 action="list_books" 查看已有 id。')
  }
  const result = await store.deleteBook(bookId)
  return {
    ok: true,
    action: 'delete_book',
    bookId: result.bookId,
    deleted: true,
    path: result.path,
    message: `已删除用户保存的教材「${result.bookId}」；内置示例不受影响。`,
  }
}

async function executeAction(store, args) {
  if (!isPlainObject(args)) throw archiveError('textbook_archive 的参数必须是 JSON 对象。')
  const action = typeof args.action === 'string' ? args.action : ''
  if (!ACTIONS.includes(action)) {
    throw archiveError(`未知 action：${action || '（缺失）'}；可选值：${ACTIONS.join(' / ')}`)
  }
  switch (action) {
    case 'save_book':
      return saveBookAction(store, args)
    case 'save_chapter':
      return saveChapterAction(store, args)
    case 'list_books':
      return listBooksAction(store)
    case 'get_book':
      return getBookAction(store, args)
    case 'delete_book':
      return deleteBookAction(store, args)
    default:
      throw archiveError(`未知 action：${action}`)
  }
}

// ---------------------------------------------------------------------------
// render（模型可读的中文摘要，1-3 条 text block）
// ---------------------------------------------------------------------------

function renderSaveBook(args, value) {
  const title = typeof value.title === 'string' && value.title ? value.title : '（未命名教材）'
  const stats = isPlainObject(value.stats) ? value.stats : { chapters: 0, sections: 0, points: 0 }
  return [
    textBlock(
      `已保存《${title}》全书总纲：${stats.chapters} 章 · ${stats.sections} 节 · ${stats.points} 个知识点。\n写入：${value.path}`,
    ),
    textBlock(
      `下一步：逐章调用 textbook_archive(action="save_chapter", bookId="${value.bookId}", chapter={...}) 保存章详情（每章一次）；全部完成后可 list_books 核对，用户可在侧边栏「教材知识框架」查看。`,
    ),
  ]
}

function renderSaveChapter(args, value) {
  const chapter = isPlainObject(args.chapter) ? args.chapter : {}
  const title = typeof chapter.title === 'string' && chapter.title ? chapter.title : '（未命名章）'
  const numberText = Number.isInteger(value.number) ? `第 ${value.number} 章` : '本章'
  const stats = isPlainObject(value.stats) ? value.stats : { chapters: 0, sections: 0, points: 0 }
  return [
    textBlock(
      `已保存${numberText}「${title}」：${value.sections} 节 / ${value.points} 个知识点。\n写入：${value.path}`,
    ),
    textBlock(
      `全书进度：${stats.chapters} 章 · ${stats.sections} 节 · ${stats.points} 个知识点。下一步：继续 save_chapter 保存下一章；全部完成后可用 list_books 核对统计。`,
    ),
  ]
}

function renderListBooks(args, value) {
  const books = Array.isArray(value.books) ? value.books : []
  if (books.length === 0) {
    return [
      textBlock('暂无教材：内置示例尚未就绪，也还没有用户保存的教材。'),
      textBlock('先用 action="save_book" 保存全书总纲与章骨架，再逐章 save_chapter 落库；完成后侧边栏「教材知识框架」会显示。'),
    ]
  }
  const lines = books.slice(0, 20).map((book) => {
    const stats = isPlainObject(book.stats) ? book.stats : { chapters: 0, sections: 0, points: 0 }
    return `- 《${book.title}》 id=${book.id} · ${stats.chapters} 章/${stats.sections} 节/${stats.points} 点 · ${sourceLabel(book.source)}`
  })
  if (books.length > 20) lines.push(`…… 其余 ${books.length - 20} 本省略`)
  return [
    textBlock(`共 ${books.length} 本教材：`),
    textBlock(lines.join('\n')),
    textBlock('用 action="get_book" + bookId 读取全书结构；加 chapterId（如 ch01）读取单章详情。'),
  ]
}

function renderGetBook(args, value) {
  const book = isPlainObject(value.book) ? value.book : {}
  const stats = isPlainObject(book.stats) ? book.stats : { chapters: 0, sections: 0, points: 0 }
  const blocks = [
    textBlock(
      `《${book.title || value.bookId}》 id=${value.bookId} · ${stats.chapters} 章 / ${stats.sections} 节 / ${stats.points} 个知识点（${sourceLabel(book.source)}）`,
    ),
  ]
  const overview = isPlainObject(book.overview) ? book.overview : {}
  if (typeof overview.goal === 'string' && overview.goal) {
    blocks.push(textBlock(`总目标：${overview.goal}\n迭代主线：${typeof overview.mainline === 'string' ? overview.mainline : '（未填写）'}`))
  }
  if (isPlainObject(value.chapter)) {
    const chapter = value.chapter
    const sections = Array.isArray(chapter.sections) ? chapter.sections : []
    const points = sections.reduce((total, section) => total + (Array.isArray(section.points) ? section.points.length : 0), 0)
    blocks.push(
      textBlock(
        `章 ${chapter.id}「${chapter.title}」：${sections.length} 节 / ${points} 个知识点。\n本章要解决：${typeof chapter.solves === 'string' ? chapter.solves : '（未填写）'}`,
      ),
    )
  } else {
    const chapters = Array.isArray(book.chapters) ? book.chapters : []
    const shown = chapters.slice(0, 14).map((chapter) => `${chapter.id} ${chapter.title}`).join('；')
    blocks.push(textBlock(`章列表：${shown || '（尚未写章骨架）'}${chapters.length > 14 ? '；……' : ''}`))
  }
  return blocks
}

function renderDeleteBook(args, value) {
  return [
    textBlock(`已删除用户保存的教材「${value.bookId}」。内置示例不受影响；如需恢复请重新 save_book / save_chapter 导入。`),
  ]
}

function renderForAction(action, args, value) {
  switch (action) {
    case 'save_book':
      return renderSaveBook(args, value)
    case 'save_chapter':
      return renderSaveChapter(args, value)
    case 'list_books':
      return renderListBooks(args, value)
    case 'get_book':
      return renderGetBook(args, value)
    case 'delete_book':
      return renderDeleteBook(args, value)
    default:
      return [textBlock(`textbook_archive 已执行 ${action || '(未知 action)'}。`)]
  }
}

// ---------------------------------------------------------------------------
// 工厂
// ---------------------------------------------------------------------------

/**
 * 创建 textbook_archive 的 ToolDefinition。
 * @param {ReturnType<import('./store.js').createStore>} store
 */
export function createTool(store) {
  if (!store || typeof store.saveBook !== 'function') {
    throw new TypeError('createTool 需要一个合法的 store 实例')
  }
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: TOOL_PARAMETERS,
    output: {
      schema: TOOL_OUTPUT_SCHEMA,
      render(args, value) {
        const safeArgs = isPlainObject(args) ? args : {}
        const action = typeof safeArgs.action === 'string' ? safeArgs.action : isPlainObject(value) && typeof value.action === 'string' ? value.action : ''
        try {
          const blocks = renderForAction(action, safeArgs, isPlainObject(value) ? value : {})
          return (Array.isArray(blocks) ? blocks : []).slice(0, 3)
        } catch (error) {
          console.error('[textbook-parser] 生成 textbook_archive 摘要失败：', error)
          return [textBlock('textbook_archive 已执行，但生成摘要失败；可调用 action="list_books" 或 action="get_book" 查看当前数据。')]
        }
      },
    },
    // 写文件不是并发安全的：同一时刻只执行一次，避免两个 action 同时改 book.json。
    isConcurrencySafe: () => false,
    async execute(args) {
      return executeAction(store, args)
    },
  }
}