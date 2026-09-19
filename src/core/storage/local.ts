/**
 * 存储底层：命名空间、可用性探测、信封读写、版本判定与迁移。
 *
 * 边界（硬性）：
 *  - 纯 TypeScript：不 import vue，也不 import core/parse（存储不参与解析的兼容逻辑）
 *  - 只做可靠读写，认识的是「信封 + 不透明 payload」，不认识生词本/最近导入的具体形状
 *  - 零网络请求
 *
 * 磁盘形状：每个 key 存一个信封 `{"v":<版本>, ...payload}`。
 * 版本放在值里而不是 key 里 —— 这样迁移只有「读出来 → 转换 → 写回去」一条路径，
 * 不需要「读旧 key → 写新 key → 删旧 key」这种中途失败会留下两份数据的操作。
 */

import { isPlainObject } from '../util/assert'

/** 站点命名空间。GitHub Pages 的所有项目页共享同一 origin，也就是共享同一份
 *  localStorage，所以前缀必须足够具体，避免和将来别的 Pages 项目串数据。 */
export const NAMESPACE = 'english-site.'

/** 当前 schema 版本。只有「结构或语义真的变了」才 +1；新增可选字段不升版。 */
export const SCHEMA_VERSION = 1

export const SLOTS = ['wordbook', 'recentQuiz', 'recentVocab'] as const
export type Slot = (typeof SLOTS)[number]

export const SLOT_KEYS: Record<Slot, string> = {
  wordbook: `${NAMESPACE}wordbook`,
  recentQuiz: `${NAMESPACE}recent.quiz`,
  recentVocab: `${NAMESPACE}recent.vocab`
}

/** 可注入的存储后端：默认是 window.localStorage，测试时传假实现。 */
export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type ReadResult =
  | { status: 'ok'; value: unknown }
  | { status: 'missing' }
  | { status: 'corrupt'; detail: string }
  | { status: 'future'; version: number }
  | { status: 'unreadable'; detail: string }

export type WriteFailureReason = 'quota' | 'unknown' | 'readonly' | 'corrupt' | 'too-large'

export type WriteResult = { ok: true } | { ok: false; reason: WriteFailureReason; detail: string }

export interface EnvelopeStore {
  /** 真实存储是否可用；false 表示当前处在「内存降级」模式（功能照常，关掉页面即失） */
  readonly available: boolean
  /** 读取并校验信封；`value` 是去掉 v 之后的 payload */
  read(slot: Slot): ReadResult
  /** 写入信封（自动带上当前版本号） */
  write(slot: Slot, payload: Record<string, unknown>): WriteResult
}

/** 一步迁移：只写「从 n 升到 n+1」，返回新的完整信封；返回 null 表示无法迁移。 */
export type Migration = (envelope: Record<string, unknown>) => Record<string, unknown> | null

/**
 * 迁移表。v1 是首版，所以现在是空的。
 * 将来要加 v2 时只写这一步，例如：
 *   1: (old) => ({ v: 2, words: (old.words as string[]).map((text) => ({ text })) })
 */
const MIGRATIONS: Record<number, Migration> = {}

/**
 * 版本迁移（纯函数，可单独测试）。
 * 任一步缺少迁移函数或返回 null → 判定为不可读，调用方**不得改写原值**。
 */
export function migrateValue(
  envelope: unknown,
  fromVersion: number,
  migrations: Record<number, Migration> = MIGRATIONS,
  toVersion: number = SCHEMA_VERSION
): { ok: true; value: Record<string, unknown> } | { ok: false; detail: string } {
  if (!isPlainObject(envelope)) return { ok: false, detail: '信封不是对象' }

  let current = envelope
  let version = fromVersion
  while (version < toVersion) {
    const step = migrations[version]
    if (step === undefined)
      return { ok: false, detail: `缺少 v${version} → v${version + 1} 的迁移函数` }
    const next = step(current)
    if (next === null) return { ok: false, detail: `v${version} → v${version + 1} 迁移失败` }
    current = next
    version += 1
  }
  return { ok: true, value: current }
}

export function createStorage(backend?: StorageBackend | null): EnvelopeStore {
  const target = backend === undefined ? detectBackend() : backend
  const usable = target !== null && probe(target)
  // 存储不可用时不报错、不阻塞使用：退化成内存存储，功能照常，只是关掉页面就没了。
  // 对外通过 available=false 暴露这一点，由 UI 提示用户。
  const active = usable ? (target as StorageBackend) : createMemoryBackend()

  return {
    available: usable,
    read(slot) {
      return readSlot(active, slot)
    },
    write(slot, payload) {
      return writeSlot(active, slot, payload)
    }
  }
}

function readSlot(backend: StorageBackend, slot: Slot): ReadResult {
  const key = SLOT_KEYS[slot]

  let raw: string | null
  try {
    raw = backend.getItem(key)
  } catch {
    // 读到一半抛异常：当作没有数据，但绝不去改动它
    return { status: 'missing' }
  }
  if (raw === null || raw === '') return { status: 'missing' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupt', detail: '不是合法的 JSON（原值未被修改）' }
  }
  if (!isPlainObject(parsed)) {
    return { status: 'corrupt', detail: '顶层不是对象（原值未被修改）' }
  }

  const version = parsed['v']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { status: 'corrupt', detail: '缺少合法的版本号 v（原值未被修改）' }
  }
  if (version > SCHEMA_VERSION) {
    // 数据来自更新版本的站点：只读，绝不写入，避免把新数据降级覆盖
    return { status: 'future', version }
  }

  let envelope = parsed
  if (version < SCHEMA_VERSION) {
    const migrated = migrateValue(parsed, version)
    if (!migrated.ok) return { status: 'unreadable', detail: migrated.detail }
    envelope = migrated.value
    // 回写迁移结果；回写失败不影响本次使用（磁盘上仍是旧值，下次读会再迁移一次，幂等）
    tryWriteRaw(backend, key, JSON.stringify(envelope))
  }

  const { v: _version, ...payload } = envelope
  return { status: 'ok', value: payload }
}

function writeSlot(
  backend: StorageBackend,
  slot: Slot,
  payload: Record<string, unknown>
): WriteResult {
  const envelope = { v: SCHEMA_VERSION, ...payload }
  return tryWriteRaw(backend, SLOT_KEYS[slot], JSON.stringify(envelope))
}

function tryWriteRaw(backend: StorageBackend, key: string, value: string): WriteResult {
  try {
    backend.setItem(key, value)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: classifyWriteError(error), detail: describeError(error) }
  }
}

function classifyWriteError(error: unknown): WriteFailureReason {
  if (isQuotaError(error)) return 'quota'
  return 'unknown'
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return true
  const code = (error as { code?: unknown }).code
  return code === 22 || code === 1014
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

function detectBackend(): StorageBackend | null {
  try {
    // 某些隐私设置下，访问 localStorage 这个属性本身就会抛异常
    const candidate = (globalThis as { localStorage?: StorageBackend }).localStorage
    return candidate ?? null
  } catch {
    return null
  }
}

/** 可用性探测：能写、能读回、能删干净，才算可用 */
function probe(backend: StorageBackend): boolean {
  const key = `${NAMESPACE}__probe__`
  try {
    backend.setItem(key, '1')
    const ok = backend.getItem(key) === '1'
    backend.removeItem(key)
    return ok
  } catch {
    return false
  }
}

export function createMemoryBackend(): StorageBackend {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    }
  }
}
