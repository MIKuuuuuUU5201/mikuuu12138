/** 基础类型判定与小工具。纯函数，无副作用，不依赖任何框架。 */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 非空字符串才认；纯空白不算。 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function asTrimmedString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null
}

/**
 * 只接受真正的布尔，以及字符串 'true' / 'false'（大小写不敏感）。
 * 刻意不接受 1/0 —— 那类值无法安全断言语义，宁可跳过也不能猜。
 */
export function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true') return true
    if (v === 'false') return false
  }
  return null
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}
