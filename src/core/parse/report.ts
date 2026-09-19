import { truncate } from '../util/assert'
import type { FatalReason, SkipReason } from './errors'

export interface SkippedEntry {
  /** 在原始 items 数组里的下标（从 0 开始，供用户定位） */
  index: number
  reason: SkipReason
  /** 人话说明，直接可显示 */
  detail: string
  /** 原始条目的简短片段，便于用户自己回去查 */
  preview: string
}

export interface FatalError {
  reason: FatalReason
  detail: string
}

/**
 * 导入报告：UI 只需要看这一个结构。
 * fatal 非空时 accepted/skipped 一定为空（整个文件都不可用）。
 */
export interface ImportReport<T> {
  kind: 'quiz' | 'vocab'
  title: string
  accepted: T[]
  skipped: SkippedEntry[]
  fatal: FatalError | null
}

export interface ImportSummary {
  accepted: number
  skipped: number
  total: number
}

export function fatalReport<T>(
  kind: 'quiz' | 'vocab',
  reason: FatalReason,
  detail: string
): ImportReport<T> {
  return { kind, title: '', accepted: [], skipped: [], fatal: { reason, detail } }
}

export function emptyReport<T>(kind: 'quiz' | 'vocab', title = ''): ImportReport<T> {
  return { kind, title, accepted: [], skipped: [], fatal: null }
}

export function summarize(report: ImportReport<unknown>): ImportSummary {
  const accepted = report.accepted.length
  const skipped = report.skipped.length
  return { accepted, skipped, total: accepted + skipped }
}

/** 跳过原因的中文标签：报告 UI 的唯一来源，避免文案到处漂移 */
export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  'not-an-object': '这一条不是对象',
  'unknown-type': '题型无法判断',
  'conflicting-type': '题型与内容冲突',
  'missing-prompt': '缺少题干',
  'incomplete-options': '选项不完整',
  'missing-answer-key': '缺少正确答案',
  'ambiguous-answer-key': '答案指向多个选项',
  'no-correct-option': '没有任何正确答案',
  'malformed-item': '结构不合法',
  'cloze-marker-mismatch': '完形填空的空格标记不连续',
  'cloze-missing-answer': '完形填空有空没给答案',
  'missing-word': '缺少 word 字段'
}

export const FATAL_REASON_LABEL: Record<FatalReason, string> = {
  'invalid-json': '不是合法的 JSON',
  'not-an-object': '顶层不是一个对象或数组',
  'no-items': '找不到题目 / 词条数组',
  'empty-items': '题目 / 词条数组是空的'
}

export function previewOf(raw: unknown, max = 120): string {
  if (typeof raw === 'string') return truncate(raw, max)
  try {
    return truncate(JSON.stringify(raw) ?? '', max)
  } catch {
    return '(无法序列化)'
  }
}
