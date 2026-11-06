/**
 * dsh-textbook-parser · Host 插件入口
 *
 * 装配三件套（全部注册都用 ctx.effect 持有生命周期）：
 * - webServer：前缀路由 /dsh-textbook-parser/api（只读 JSON，给 Web 面板取数）
 * - tools：全局工具 textbook_archive（模型落库）
 * - skills：textbook-parser 技能（读包内 SKILL.md）
 *
 * 容错约定：apply 整体 try/catch，任一注册失败只 console.error，其余部分继续；
 * webServer 缺失时工具与 skill 仍会注册，插件不会拖垮宿主启动。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './host/store.js'
import { API_PREFIX, createRoutes } from './host/routes.js'
import { createTool } from './host/tool.js'
import { buildSkillRegistration } from './host/skill.js'

const PKG_DIR = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_NAME = 'dsh-textbook-parser'
const FALLBACK_VERSION = '1.0.0'

// Cordis 标准导出：三个 Host 服务都是硬依赖；缺失时 Loader 不会激活本插件。
export const inject = ['skills', 'tools', 'webServer']

function readPluginVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'))
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : FALLBACK_VERSION
  } catch (error) {
    console.error('[textbook-parser] 读取 package.json 版本失败，回退 1.0.0：', error.message)
    return FALLBACK_VERSION
  }
}

/** 尽量取到可选服务：ctx.get(name) 优先，属性访问兜底；取不到返回 undefined 而不是抛错。 */
function optionalService(ctx, name) {
  if (!ctx) return undefined
  try {
    if (typeof ctx.get === 'function') {
      const service = ctx.get(name)
      if (service) return service
    }
  } catch {
    // ctx.get 在少数上下文会抛错，继续用属性访问兜底
  }
  try {
    return ctx[name] || undefined
  } catch {
    return undefined
  }
}

/**
 * 用 ctx.effect 包一个注册动作；注册失败只记录，返回是否成功。
 * @param {*} ctx
 * @param {string} label
 * @param {() => unknown} register
 */
function applyEffect(ctx, label, register) {
  try {
    if (!ctx || typeof ctx.effect !== 'function') throw new Error('当前 ctx 不支持 ctx.effect，无法托管注册生命周期')
    ctx.effect(register, label)
    return true
  } catch (error) {
    console.error(`[textbook-parser] ${label} 注册失败（其余功能继续）：`, error)
    return false
  }
}

/**
 * Host 插件入口。
 * @param {*} ctx Cordis 上下文
 * @param {{ dataDir?: string, bundledDir?: string }} [config] cordis.patch.yml 中的 plugin config
 * @returns {void} 与 Cordis 函数式插件约定一致：注册都交给 ctx.effect 托管。
 */
export function apply(ctx, config = {}) {
  const status = {
    plugin: PLUGIN_NAME,
    dataDir: '',
    skillRegistered: false,
    toolRegistered: false,
    routesRegistered: false,
  }

  // 1) 存储层：目录解析失败则插件整体不启用（不抛错，不拖垮宿主）。
  let store
  try {
    store = createStore(config && typeof config === 'object' ? config : {})
    status.dataDir = store.userRoot
  } catch (error) {
    console.error('[textbook-parser] 存储层初始化失败，插件未启用：', error)
    return
  }

  // 2) HTTP 只读 API（Web 服务缺失时跳过，工具/skill 仍可用）
  try {
    const webServer = optionalService(ctx, 'webServer')
    if (!webServer || typeof webServer.register !== 'function') {
      console.error(`[textbook-parser] 未找到可用的 webServer 服务：${API_PREFIX} 接口不可用，textbook_archive 与 skill 继续注册。`)
    } else {
      const version = readPluginVersion()
      const handler = createRoutes(store, () => status, { version })
      status.routesRegistered = applyEffect(ctx, 'tbp: routes', () =>
        webServer.register({ kind: 'prefix', path: API_PREFIX, handler }),
      )
    }
  } catch (error) {
    console.error('[textbook-parser] HTTP 路由装配失败（其余功能继续）：', error)
  }

  // 3) textbook_archive 工具
  try {
    const tools = optionalService(ctx, 'tools')
    if (!tools || typeof tools.register !== 'function') {
      console.error('[textbook-parser] 未找到可用的 tools 服务：textbook_archive 工具不可用，其余功能继续。')
    } else {
      const tool = createTool(store)
      status.toolRegistered = applyEffect(ctx, 'tbp: tool', () => tools.register(tool))
    }
  } catch (error) {
    console.error('[textbook-parser] textbook_archive 工具装配失败（其余功能继续）：', error)
  }

  // 4) skill：先读文件再注册；读失败/注册失败都只记录
  try {
    const skills = optionalService(ctx, 'skills')
    if (!skills || typeof skills.register !== 'function') {
      console.error('[textbook-parser] 未找到可用的 skills 服务：textbook-parser 技能不可用，其余功能继续。')
    } else {
      const registration = buildSkillRegistration(PKG_DIR)
      status.skillRegistered = applyEffect(ctx, 'tbp: skill', () => skills.register(registration))
    }
  } catch (error) {
    console.error('[textbook-parser] skill 注册失败（工具与界面继续可用）：', error)
  }
}