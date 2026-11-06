/**
 * textbook-parser · skill 注册（读包内 skills/textbook-parser/SKILL.md）
 *
 * 只做三件事：
 * 1. 读 SKILL.md（fs.readFileSync，包内相对路径，不联网）
 * 2. 解析 frontmatter（--- 分隔的 name/description/whenToUse；兼容 trigger）
 * 3. 调用 ctx.skills.register(...) 并返回其 disposer（由 apply 包在 ctx.effect 中）
 *
 * 读取/解析失败时抛错，由 index.js 捕获后只 console.error，不影响工具与界面。
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { PKG_DIR } from './store.js'

export const SKILL_NAME = 'textbook-parser'
export const SKILL_PROVIDER = 'textbook-parser'

export const FALLBACK_DESCRIPTION =
  '理工科教材拆解专家，以【问题驱动迭代】梳理全书、章、小节、知识点逻辑；每个知识点必须说明：它是为了解决前面方案的什么缺陷而来，展示知识迭代链条，不孤立罗列定义。适配模电、数电、信号与系统、复变、电路等电子信息类教材。'

export const FALLBACK_WHEN_TO_USE =
  '当用户要求梳理课本、教材、章节知识点逻辑，梳理知识演进脉络，分析每个知识点解决什么问题时自动启用'

/** 技能资源目录：<pkg>/skills/textbook-parser */
export function resolveSkillDir(pkgDir = PKG_DIR) {
  return path.join(pkgDir, 'skills', SKILL_NAME)
}

/** 技能正文文件：<pkg>/skills/textbook-parser/SKILL.md */
export function resolveSkillFile(pkgDir = PKG_DIR) {
  return path.join(resolveSkillDir(pkgDir), 'SKILL.md')
}

/**
 * 极简 frontmatter 解析：`---` 首尾分隔，逐行 `key: value`（去掉成对引号）。
 * 返回 { meta, body }；没有 frontmatter 时 meta 为空、body 为原文。
 * @param {string} raw
 */
export function parseFrontmatter(raw) {
  if (typeof raw !== 'string') throw new TypeError('SKILL.md 内容必须是字符串')
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  const meta = {}
  let body = text
  if (match) {
    body = text.slice(match[0].length)
    for (const line of match[1].split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const colon = trimmed.indexOf(':')
      if (colon <= 0) continue
      const key = trimmed.slice(0, colon).trim()
      let value = trimmed.slice(colon + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key) meta[key] = value
    }
  }
  return { meta, body: body.replace(/^\s+/, '').trim() }
}

/**
 * 构造 ctx.skills.register 需要的 SkillRegistration（不注册）。
 * @param {string} [pkgDir]
 * @returns {{name:string, description:string, whenToUse:string, content:string, path:string, source:string, provider:string, resourceBase:{kind:'directory', path:string}, invocation:{modelInvocable:boolean, userInvocable:boolean}}}
 */
export function buildSkillRegistration(pkgDir = PKG_DIR) {
  const skillDir = resolveSkillDir(pkgDir)
  const skillFile = resolveSkillFile(pkgDir)
  let raw
  try {
    raw = readFileSync(skillFile, 'utf8')
  } catch (error) {
    throw new Error(`读取 skill 正文失败（${skillFile}）：${error.message}；请确认包的 skills/textbook-parser/SKILL.md 存在且可读。`)
  }
  const { meta, body } = parseFrontmatter(raw)
  if (!body) throw new Error(`SKILL.md 正文为空（${skillFile}）：frontmatter 之后必须包含完整方法论正文。`)

  const name = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : SKILL_NAME
  const description = typeof meta.description === 'string' && meta.description.trim() ? meta.description.trim() : FALLBACK_DESCRIPTION
  const whenToUse =
    typeof meta.whenToUse === 'string' && meta.whenToUse.trim()
      ? meta.whenToUse.trim()
      : typeof meta.trigger === 'string' && meta.trigger.trim()
        ? meta.trigger.trim()
        : FALLBACK_WHEN_TO_USE

  if (!existsSync(skillDir)) {
    console.error(`[textbook-parser] skill 资源目录不存在：${skillDir}（resourceBase 可能不可读）`)
  }

  return {
    name,
    description,
    whenToUse,
    content: body,
    path: skillFile,
    source: 'custom',
    provider: SKILL_PROVIDER,
    resourceBase: { kind: 'directory', path: skillDir },
    invocation: { modelInvocable: true, userInvocable: true },
  }
}

/**
 * 注册 skill 并返回 disposer。调用方负责把它放进 ctx.effect。
 * @param {{ skills?: { register?: (skill: unknown) => () => void } }} ctx
 * @param {{ pkgDir?: string }} [options]
 */
export function registerSkill(ctx, options = {}) {
  if (!ctx || !ctx.skills || typeof ctx.skills.register !== 'function') {
    throw new Error('ctx.skills.register 不可用，跳过 skill 注册')
  }
  const registration = buildSkillRegistration(options.pkgDir || PKG_DIR)
  return ctx.skills.register(registration)
}