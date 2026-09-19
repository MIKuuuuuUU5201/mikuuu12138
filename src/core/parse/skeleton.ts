/**
 * 骨架识别：从“任意 JSON 值”里找出 title 和 items 数组。
 * 只认结构，不认内容——找不到就整体失败（fatal），绝不猜。
 */
import { isPlainObject } from '../util/assert'
import type { FatalReason } from './errors'
import { TITLE_KEYS, firstStringByKeys, hasAnyKey } from './aliases'

export interface Skeleton {
  title: string
  items: unknown[]
}

export type SkeletonResult =
  { ok: true; skeleton: Skeleton } | { ok: false; reason: FatalReason; detail: string }

export function extractSkeleton(
  root: unknown,
  itemKeys: readonly string[],
  looksLikeItemKeys: readonly string[]
): SkeletonResult {
  if (Array.isArray(root)) {
    if (root.length === 0) return { ok: false, reason: 'empty-items', detail: '顶层数组是空的' }
    return { ok: true, skeleton: { title: '', items: root } }
  }

  if (!isPlainObject(root)) {
    return { ok: false, reason: 'not-an-object', detail: '顶层既不是对象也不是数组' }
  }

  const title = firstStringByKeys(root, TITLE_KEYS) ?? ''

  for (const key of itemKeys) {
    const value = root[key]
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { ok: false, reason: 'empty-items', detail: `字段 ${key} 是空数组` }
      }
      return { ok: true, skeleton: { title, items: value } }
    }
    const asMap = asItemArray(value)
    if (asMap !== null) {
      return { ok: true, skeleton: { title, items: asMap } }
    }
  }

  // 整个文件只有一条：把顶层对象自己当成 items[0]
  if (hasAnyKey(root, looksLikeItemKeys)) {
    return { ok: true, skeleton: { title, items: [root] } }
  }

  return {
    ok: false,
    reason: 'no-items',
    detail: `顶层对象里没有可识别的数组字段（期望字段：${itemKeys.join(' / ')}）`
  }
}

/** { "1": {...}, "2": {...} } 这种“数字键对象”也当成数组用 */
function asItemArray(value: unknown): unknown[] | null {
  if (!isPlainObject(value)) return null
  const values = Object.values(value)
  if (values.length === 0) return null
  if (!values.every((v) => isPlainObject(v))) return null
  return values
}
