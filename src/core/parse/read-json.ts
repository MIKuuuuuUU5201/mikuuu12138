/**
 * 文本 → unknown。只做“能不能变成 JSON 值”这一件事，不理解任何业务结构。
 * 这一层是整个导入链路上唯一的“脏数据入口”。
 */
import type { FatalReason } from './errors'

export type ReadJsonResult =
  { ok: true; value: unknown } | { ok: false; reason: FatalReason; detail: string }

const FENCE = /```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n?```/

export function readJson(text: string): ReadJsonResult {
  const cleaned = stripDecoration(text)
  if (cleaned === '') {
    return { ok: false, reason: 'invalid-json', detail: '内容是空的' }
  }

  const direct = tryParse(cleaned)
  if (direct.ok) return classify(direct.value)

  // GPT 常在 JSON 前后附带一段解释文字：退一步，取最外层 {...} 或 [...] 再试一次。
  // 这只是“找边界”，不会补任何内容。
  const sliced = outermostJson(cleaned)
  if (sliced !== null && sliced !== cleaned) {
    const retry = tryParse(sliced)
    if (retry.ok) return classify(retry.value)
  }

  return { ok: false, reason: 'invalid-json', detail: direct.message }
}

/** 去掉 BOM、首尾空白；如果整段被 ``` 围栏包住，剥掉围栏 */
function stripDecoration(text: string): string {
  let s = text.replace(/^\uFEFF/, '').trim()
  if (/^\s*```/.test(s)) {
    const fence = s.match(FENCE)
    if (fence) s = fence[1].trim()
  }
  return s
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

function outermostJson(text: string): string | null {
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0)
  if (starts.length === 0) return null
  const start = Math.min(...starts)
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (end <= start) return null
  return text.slice(start, end + 1)
}

function classify(value: unknown): ReadJsonResult {
  if (value === null || typeof value !== 'object') {
    return {
      ok: false,
      reason: 'not-an-object',
      detail: `顶层是 ${value === null ? 'null' : typeof value}，需要对象或数组`
    }
  }
  return { ok: true, value }
}
