/**
 * 生词本。
 *
 * 产品要求（硬性）：**只保存「单词/短语」本身**，磁盘上就是一个 `string[]`。
 * 不存 translation / example / addedAt / source，也不引入 WordEntry 之类的对象。
 * 顺序即时间：最新加入的排在最前（unshift），所以不需要时间字段。
 *
 * 存储形态 vs 比对形态：
 *  - 存的是「首次录入的原文」（只做 trim + 连续空白折叠），这样 `In my opinion` 保留可读大小写
 *  - 比对/去重时才 lowercase（wordKey），所以 `Confidence` 之后再录 `confidence` 视为已存在
 *
 * 写入纪律（整层的安全保证都靠它）：
 *  先写盘成功，再更新调用方的状态；任何失败路径都必须让旧数据保持不变。
 */

import type { EnvelopeStore, WriteResult } from './local'
import { isPlainObject } from '../util/assert'

export const WORDBOOK_EXPORT_TYPE = 'wordbook'

export interface WordbookSnapshot {
  status: 'ok' | 'missing' | 'corrupt' | 'future' | 'unreadable'
  words: string[]
  detail: string | null
}

/** 比对/去重键：trim → 连续空白折叠 → lowercase */
export function wordKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** 入库形态：trim + 连续空白折叠（保留大小写） */
export function normalizeDisplay(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function buildLookup(words: readonly string[]): Set<string> {
  return new Set(words.map(wordKey))
}

export function hasWord(words: readonly string[], text: string): boolean {
  return buildLookup(words).has(wordKey(text))
}

/** 最新在前。已存在（按 wordKey 判定）则原样返回传入的数组引用，便于变更检测。 */
export function addWord(words: readonly string[], text: string): string[] {
  const display = normalizeDisplay(text)
  if (display === '') return words as string[]
  const key = wordKey(display)
  if (words.some((w) => wordKey(w) === key)) return words as string[]
  return [display, ...words]
}

export function removeWord(words: readonly string[], text: string): string[] {
  const key = wordKey(text)
  const next = words.filter((w) => wordKey(w) !== key)
  return next.length === words.length ? (words as string[]) : next
}

export function toggleWord(
  words: readonly string[],
  text: string
): { words: string[]; added: boolean } {
  if (hasWord(words, text)) return { words: removeWord(words, text), added: false }
  return { words: addWord(words, text), added: true }
}

/** 导出：我们自己的形状（不是 GPT 的形状） */
export function exportJson(words: readonly string[]): string {
  return JSON.stringify({ type: WORDBOOK_EXPORT_TYPE, version: 1, words }, null, 2)
}

export interface ImportValidationSuccess {
  ok: true
  words: string[]
  /** 文件内部自身重复的条数（保留首次出现） */
  duplicates: number
}

export interface ImportValidationFailure {
  ok: false
  errors: string[]
}

export type ImportValidation = ImportValidationSuccess | ImportValidationFailure

/**
 * 只接受我们自己的导出格式：{ type: "wordbook", version: 1, words: [...] }
 * 完整校验，任何一条不合法 → 整体失败（由调用方保证此时不写盘）。
 */
export function validateImportText(text: string): ImportValidation {
  const errors: string[] = []

  const parsed = parseJsonText(text)
  if (!parsed.ok) return { ok: false, errors: [parsed.detail] }
  const root = parsed.value

  if (!isPlainObject(root)) return { ok: false, errors: ['顶层必须是对象'] }

  if (root['type'] !== WORDBOOK_EXPORT_TYPE) {
    return {
      ok: false,
      errors: [`type 必须是 "${WORDBOOK_EXPORT_TYPE}"（这是生词本导出文件的标记）`]
    }
  }

  const version = root['version']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, errors: ['version 必须是正整数'] }
  }
  if (version > 1) {
    return { ok: false, errors: [`version ${version} 来自更新版本的导出，本版本无法安全读取`] }
  }

  const rawWords = root['words']
  if (!Array.isArray(rawWords)) return { ok: false, errors: ['words 必须是数组'] }

  const seen = new Set<string>()
  const words: string[] = []
  let duplicates = 0

  rawWords.forEach((item, index) => {
    if (typeof item !== 'string') {
      errors.push(`words[${index}] 不是字符串：${JSON.stringify(item) ?? 'undefined'}`)
      return
    }
    const display = normalizeDisplay(item)
    if (display === '') {
      errors.push(`words[${index}] 是空白字符串`)
      return
    }
    const key = wordKey(display)
    if (seen.has(key)) {
      duplicates += 1
      return
    }
    seen.add(key)
    words.push(display)
  })

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, words, duplicates }
}

export function loadWordbook(store: EnvelopeStore): WordbookSnapshot {
  const result = store.read('wordbook')
  switch (result.status) {
    case 'ok': {
      const words = readWords(result.value)
      if (words === null) {
        return { status: 'corrupt', words: [], detail: 'words 不是字符串数组（原值未被修改）' }
      }
      return { status: 'ok', words, detail: null }
    }
    case 'missing':
      return { status: 'missing', words: [], detail: null }
    case 'corrupt':
      return { status: 'corrupt', words: [], detail: result.detail }
    case 'future':
      return {
        status: 'future',
        words: [],
        detail: `数据由更新版本的站点写入（v${result.version}），本版本无法读取，已停止写入以保护数据`
      }
    case 'unreadable':
      return { status: 'unreadable', words: [], detail: result.detail }
  }
}

export function saveWordbook(store: EnvelopeStore, words: readonly string[]): WriteResult {
  return store.write('wordbook', { words: [...words] })
}

/**
 * 生词本唯一的写入口：**每次写盘前重新读取当前值**，在最新值上做变更再落盘。
 * 这样两个标签页各加一个词时，不会用过期副本把对方的改动冲掉。
 *
 * 失败路径全部保持旧数据：
 *  - 落盘失败（配额等）→ 返回磁盘上的旧值
 *  - 值为未来版本（只读锁定）→ 拒绝写入
 *  - 值已损坏 → 拒绝基于它做增量修改（改由「导入」这个显式整体覆盖动作来修）
 */
export function updateWordbook(
  store: EnvelopeStore,
  change: (words: string[]) => string[]
): { words: string[]; result: WriteResult } {
  const current = loadWordbook(store)

  if (current.status === 'future') {
    return {
      words: current.words,
      result: { ok: false, reason: 'readonly', detail: current.detail ?? '数据来自更新版本，只读' }
    }
  }
  if (current.status === 'corrupt' || current.status === 'unreadable') {
    return {
      words: current.words,
      result: {
        ok: false,
        reason: 'corrupt',
        detail: current.detail ?? '生词本数据无法读取，已停止写入以保护原值'
      }
    }
  }

  const next = change(current.words)
  if (next === current.words) return { words: current.words, result: { ok: true } }

  const result = saveWordbook(store, next)
  return result.ok ? { words: next, result } : { words: current.words, result }
}

/**
 * 导入生词本：先完整校验，校验通过才一次性整体覆盖。
 * 校验失败 → 一个字节都不写，旧生词本完全不变。
 */
export function importWordbook(
  store: EnvelopeStore,
  text: string
):
  | { ok: true; words: string[]; count: number; duplicates: number }
  | { ok: false; errors: string[] } {
  const validation = validateImportText(text)
  if (!validation.ok) return { ok: false, errors: validation.errors }

  const current = loadWordbook(store)
  if (current.status === 'future') {
    return {
      ok: false,
      errors: [`导入被拒绝：${current.detail ?? '当前数据来自更新版本'}（原值未被修改）`]
    }
  }

  const result = saveWordbook(store, validation.words)
  if (!result.ok) {
    return { ok: false, errors: [`写入失败（${result.reason}）：${result.detail}（原值未被修改）`] }
  }
  return {
    ok: true,
    words: validation.words,
    count: validation.words.length,
    duplicates: validation.duplicates
  }
}

function readWords(value: unknown): string[] | null {
  if (!isPlainObject(value)) return null
  const words = value['words']
  if (!Array.isArray(words)) return null
  if (!words.every((w) => typeof w === 'string')) return null
  return [...words]
}

/**
 * 存储层的 JSON 读取是**严格**的：只做 BOM/空白清理后 JSON.parse。
 * 故意不复制解析层的「剥 ``` 围栏 / 前后夹带解释文字」那套容错——
 * 那是为了兼容 GPT 输出而存在的解析业务逻辑，存储不参与其中。
 */
function parseJsonText(text: string): { ok: true; value: unknown } | { ok: false; detail: string } {
  const cleaned = text.replace(/^\uFEFF/, '').trim()
  if (cleaned === '') return { ok: false, detail: '内容是空的' }
  try {
    return { ok: true, value: JSON.parse(cleaned) }
  } catch (error) {
    return {
      ok: false,
      detail: `不是合法的 JSON：${error instanceof Error ? error.message : String(error)}`
    }
  }
}
