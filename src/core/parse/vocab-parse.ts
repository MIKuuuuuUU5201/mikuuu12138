/**
 * 词汇 JSON → 内部模型。
 *
 * 硬性要求只有一条：每个词条必须有一个非空的 word（别名见 aliases.ts）。
 * example / translation 是可选的——缺了照常导入，只是显示为空，绝不推测内容。
 */
import type { VocabItem } from '../model/vocab'
import { asTrimmedString, isPlainObject } from '../util/assert'
import * as A from './aliases'
import { ItemError } from './errors'
import { readJson } from './read-json'
import { extractSkeleton } from './skeleton'
import { emptyReport, fatalReport, previewOf, type ImportReport, type SkippedEntry } from './report'

export function parseVocabText(text: string): ImportReport<VocabItem> {
  const read = readJson(text)
  if (!read.ok) return fatalReport<VocabItem>('vocab', read.reason, read.detail)

  const skeleton = extractSkeleton(read.value, A.VOCAB_ITEM_KEYS, A.VOCAB_ITEM_HINT_KEYS)
  if (!skeleton.ok) return fatalReport<VocabItem>('vocab', skeleton.reason, skeleton.detail)

  const report = emptyReport<VocabItem>('vocab', skeleton.skeleton.title)
  skeleton.skeleton.items.forEach((raw, index) => {
    try {
      report.accepted.push(parseVocabItem(raw, index))
    } catch (error) {
      report.skipped.push(toSkippedEntry(index, raw, error))
    }
  })
  return report
}

export function parseVocabItem(raw: unknown, index: number): VocabItem {
  const id = `v${index + 1}`

  // 纯字符串数组（["apple", "banana"]）也认：字符串本身就是单词
  if (typeof raw === 'string') {
    const word = asTrimmedString(raw)
    if (word === null) throw new ItemError('missing-word', `第 ${index + 1} 条是空字符串`)
    return { id, word, example: null, translation: null }
  }

  if (!isPlainObject(raw)) throw new ItemError('not-an-object', `第 ${index + 1} 条不是对象`)

  const word = A.firstStringByKeys(raw, A.WORD_KEYS)
  if (word === null) {
    throw new ItemError('missing-word', `缺少 word 字段（可用：${A.WORD_KEYS.join(' / ')}）`)
  }

  return {
    id,
    word,
    example: A.firstStringByKeys(raw, A.EXAMPLE_KEYS),
    translation: A.firstStringByKeys(raw, A.TRANSLATION_KEYS)
  }
}

function toSkippedEntry(index: number, raw: unknown, error: unknown): SkippedEntry {
  if (error instanceof ItemError) {
    return { index, reason: error.reason, detail: error.message, preview: previewOf(raw) }
  }
  return {
    index,
    reason: 'malformed-item',
    detail: error instanceof Error ? error.message : String(error),
    preview: previewOf(raw)
  }
}
