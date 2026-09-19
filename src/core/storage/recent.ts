/**
 * 最近导入（做题 / 词汇各自独立）。
 *
 * 只存**原始 JSON 文本 + 必要元数据**，不存解析后的内部模型：
 * 打开时由 feature 层拿 raw 重新跑一遍 parser，于是 parser 改进后旧条目会自动变好，
 * 不需要为它写任何迁移逻辑。存储层不认识 QuizItem / VocabItem。
 *
 * 上限 5 条，第 6 条入册时淘汰最旧的一条；不提供手动删除。
 */

import type { EnvelopeStore, Slot, WriteFailureReason } from './local'
import { isPlainObject } from '../util/assert'

export type RecentKind = 'quiz' | 'vocab'

export const RECENT_LIMIT = 5

/** 单条原始文本上限：10 条 × 128KB ≈ 1.3MB，给 5MB 预算留足余量 */
export const MAX_RAW_BYTES = 128 * 1024

export interface RecentCounts {
  accepted: number
  skipped: number
}

export interface RecentImport {
  /** 内容哈希：同一份内容重复导入不会产生第二条，而是移到最前 */
  id: string
  title: string
  /** 粘贴导入时为 null */
  filename: string | null
  importedAt: number
  /** 导入当时的报告快照，仅用于列表显示；真正打开时以重新解析的结果为准 */
  counts: RecentCounts
  /** 原始 JSON 文本，原样保存 */
  raw: string
}

export interface RecentSnapshot {
  status: 'ok' | 'missing' | 'corrupt' | 'future' | 'unreadable'
  entries: RecentImport[]
  detail: string | null
}

const SLOT_OF: Record<RecentKind, Slot> = {
  quiz: 'recentQuiz',
  vocab: 'recentVocab'
}

export interface RecentInput {
  raw: string
  title: string
  filename: string | null
  counts: RecentCounts
  importedAt: number
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** FNV-1a 32 位：够用、无依赖、稳定（不需要加密强度） */
export function contentHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function loadRecent(store: EnvelopeStore, kind: RecentKind): RecentSnapshot {
  const result = store.read(SLOT_OF[kind])
  switch (result.status) {
    case 'ok': {
      const entries = readEntries(result.value)
      if (entries === null) {
        return { status: 'corrupt', entries: [], detail: 'entries 不是数组（原值未被修改）' }
      }
      return { status: 'ok', entries, detail: null }
    }
    case 'missing':
      return { status: 'missing', entries: [], detail: null }
    case 'corrupt':
      return { status: 'corrupt', entries: [], detail: result.detail }
    case 'future':
      return {
        status: 'future',
        entries: [],
        detail: `最近导入记录由更新版本的站点写入（v${result.version}），已停止写入以保护数据`
      }
    case 'unreadable':
      return { status: 'unreadable', entries: [], detail: result.detail }
  }
}

export interface RecentSaveOk {
  ok: true
  entries: RecentImport[]
  /** 本次被淘汰的条数（含因配额再退让的一条），null 表示没有淘汰 */
  evicted: number | null
}

export interface RecentSaveFailed {
  ok: false
  reason: WriteFailureReason
  detail: string
  entries: RecentImport[]
}

export type RecentSaveResult = RecentSaveOk | RecentSaveFailed

/**
 * 记一条导入。
 *
 * 写入失败**不影响本次实际导入**：调用方只是没有得到「最近导入」记录，做题/背单词照常。
 * 顺序：超限拒绝 → 重新读取 → 同内容去重（移到最前）→ 截断到 5 条 → 写盘；
 * 写盘若因配额失败，再退让一条重试一次。
 */
export function saveRecent(
  store: EnvelopeStore,
  kind: RecentKind,
  input: RecentInput
): RecentSaveResult {
  const size = byteLength(input.raw)
  if (size > MAX_RAW_BYTES) {
    return {
      ok: false,
      reason: 'too-large',
      detail: `原始数据 ${Math.round(size / 1024)}KB 超过单条上限 ${MAX_RAW_BYTES / 1024}KB，本次未记入最近导入`,
      entries: loadRecent(store, kind).entries
    }
  }

  const current = loadRecent(store, kind)
  if (current.status === 'future') {
    return {
      ok: false,
      reason: 'readonly',
      detail: current.detail ?? '数据来自更新版本，只读',
      entries: current.entries
    }
  }

  const entry: RecentImport = {
    id: contentHash(input.raw),
    title: input.title,
    filename: input.filename,
    importedAt: input.importedAt,
    counts: input.counts,
    raw: input.raw
  }

  const others = current.entries.filter((e) => e.id !== entry.id)
  const next = [entry, ...others].slice(0, RECENT_LIMIT)
  const evictedFirst = current.entries.length + 1 - next.length

  const first = store.write(SLOT_OF[kind], { entries: next })
  if (first.ok) {
    return { ok: true, entries: next, evicted: evictedFirst > 0 ? evictedFirst : null }
  }

  // 配额不足：再退让一条重试一次；仍失败就放弃记录，磁盘上保持原样
  if (first.reason === 'quota' && next.length > 1) {
    const trimmed = next.slice(0, next.length - 1)
    const second = store.write(SLOT_OF[kind], { entries: trimmed })
    if (second.ok) return { ok: true, entries: trimmed, evicted: evictedFirst + 1 }
  }

  return {
    ok: false,
    reason: first.reason,
    detail: first.detail,
    entries: current.entries
  }
}

/**
 * 读取时的形状校验：本格式由我们自己写入，出现非法条目说明被外部改过，
 * 直接忽略该条（**不改盘**），其余照常使用。
 */
function readEntries(value: unknown): RecentImport[] | null {
  if (!isPlainObject(value)) return null
  const raw = value['entries']
  if (!Array.isArray(raw)) return null
  return raw.filter(isRecentImport)
}

function isRecentImport(value: unknown): value is RecentImport {
  if (!isPlainObject(value)) return false
  if (typeof value['id'] !== 'string') return false
  if (typeof value['raw'] !== 'string') return false
  if (typeof value['title'] !== 'string') return false
  if (typeof value['importedAt'] !== 'number') return false
  const filename = value['filename']
  if (filename !== null && typeof filename !== 'string') return false
  return true
}

/** 读取时的兜底：counts 缺失或非法则按 0 计（只影响列表显示） */
export function readCounts(entry: RecentImport): RecentCounts {
  const counts: unknown = (entry as { counts?: unknown }).counts
  if (!isPlainObject(counts)) return { accepted: 0, skipped: 0 }
  const accepted = counts['accepted']
  const skipped = counts['skipped']
  return {
    accepted: typeof accepted === 'number' ? accepted : 0,
    skipped: typeof skipped === 'number' ? skipped : 0
  }
}
