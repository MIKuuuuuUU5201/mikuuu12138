/**
 * Quiz JSON → 内部模型。整个「宽松兼容」策略都收敛在这个文件里。
 *
 * ── GPT 标准格式（必须 100% 支持） ──────────────────────────
 * 外层：{ "title": "...", "items": [ … ] }    items 里可混装三种题型
 *
 * 选择题   { "type": "multiple_choice", "question": "...",
 *           "options": ["…","…","…","…"], "answer": 1, "explanation": "…" }
 * 判断题   { "type": "true_false", "statement": "...", "answer": true, "explanation": "…" }
 * 完形填空 { "type": "cloze", "passage": "… {{1}} … {{2}} …",
 *           "blanks": [ { "number": 1, "options": ["…"], "answer": 1, "explanation": "…" } ] }
 *
 * ── 题型判定规则（按顺序，命中即止） ────────────────────────
 *  1. 段落里出现 {{n}} 标记 → 完形填空
 *  2. 有显式 type → 按别名表归一化；归一化不到 → 跳过（unknown-type）
 *     · multiple_choice / multiple-choice / multiple choice / choice / 选择题
 *       → 泛化类型，由答案形状决定单/多选
 *     · multi / multi-select → 多选
 *     · single-* / 单选 / 单选题 → 单选；true_false / 判断题 / tf / boolean → 判断题
 *  3. 有选项数组（choices / options / candidates，或 answers 且元素为对象）→ 选择题
 *  4. 有布尔型 answer / correct → 判断题
 *  5. 其余 → 跳过（unknown-type）
 *
 * ── 答案来源规则（绝不猜） ─────────────────────────────────
 *  · 选项自带显式布尔标记（correct / isCorrect / is_correct / right），或题目级 answer 键
 *  · answer 单个值：字母按 A/B/C 对应选项顺序；数字按 **1-based** 且必须落在 1..n
 *    （0 或越界一律不认）；字符串按选项原文精确匹配（去空格、忽略大小写），匹配到多个则跳过
 *  · answer 数组（如 [1, 3]）→ 多个正确答案；任一元素无法唯一对应 → 整条跳过
 *  · 单/多选最终由正确选项个数决定：1 个 → single；≥2 个 → multi
 *  · 完形填空每个空：answer 是数字 → 取该空 options[n-1] 的文本（1-based；0 / 越界 / 非整数 → 跳过）；
 *    字符串且有词库、且本身是纯数字 → 同样按索引；其余字符串 → 自由填空的文本
 *  · 完形填空空号：number 存在且全部合法 → 以 number 为准；全部缺失 → 退回数组顺序；
 *    混用 / 非法 / 重复 / 越界 → 跳过
 *  · explanation 可选：题级与完形填空每个空都会保留，缺失时为 null，不影响导入
 *  任何一步无法安全确定 → 跳过并在报告里说明原因，绝不填默认值。
 */
import type {
  ChoiceItem,
  ChoiceMode,
  ClozeBlank,
  ClozeItem,
  QuizItem,
  TrueFalseItem
} from '../model/quiz'
import { asTrimmedString, isNonEmptyString, isPlainObject, parseBooleanLike } from '../util/assert'
import * as A from './aliases'
import { ItemError } from './errors'
import { readJson } from './read-json'
import { extractSkeleton } from './skeleton'
import { emptyReport, fatalReport, previewOf, type ImportReport, type SkippedEntry } from './report'

type ExplicitKind = 'single' | 'multi' | 'tf' | 'cloze' | 'infer'

const TYPE_MAP: Record<string, ExplicitKind> = {
  'single-choice': 'single',
  singlechoice: 'single',
  single: 'single',
  'one-choice': 'single',
  'single-select': 'single',
  单选: 'single',
  单选题: 'single',

  'multiple-choice': 'infer',
  multiplechoice: 'infer',
  multiple: 'multi',
  multi: 'multi',
  'multi-select': 'multi',
  多选: 'multi',
  多选题: 'multi',

  'true-false': 'tf',
  truefalse: 'tf',
  tf: 'tf',
  boolean: 'tf',
  bool: 'tf',
  judge: 'tf',
  judgement: 'tf',
  judgment: 'tf',
  判断: 'tf',
  判断题: 'tf',
  对错题: 'tf',

  cloze: 'cloze',
  'cloze-test': 'cloze',
  'cloze-passage': 'cloze',
  完形填空: 'cloze',

  // 泛化类型：本身不区分单选/多选，交给结构推断
  choice: 'infer',
  question: 'infer',
  generic: 'infer',
  选择: 'infer',
  选择题: 'infer'
}

export function parseQuizText(text: string): ImportReport<QuizItem> {
  const read = readJson(text)
  if (!read.ok) return fatalReport<QuizItem>('quiz', read.reason, read.detail)

  const skeleton = extractSkeleton(read.value, A.QUIZ_ITEM_KEYS, A.QUIZ_ITEM_HINT_KEYS)
  if (!skeleton.ok) return fatalReport<QuizItem>('quiz', skeleton.reason, skeleton.detail)

  const report = emptyReport<QuizItem>('quiz', skeleton.skeleton.title)
  skeleton.skeleton.items.forEach((raw, index) => {
    try {
      report.accepted.push(parseQuizItem(raw, index))
    } catch (error) {
      report.skipped.push(toSkippedEntry(index, raw, error))
    }
  })
  return report
}

export function parseQuizItem(raw: unknown, index: number): QuizItem {
  if (!isPlainObject(raw)) throw new ItemError('not-an-object', `第 ${index + 1} 条不是对象`)

  const id = `q${index + 1}`
  const explicit = readExplicitKind(raw)

  const passage = A.firstStringByKeys(raw, A.PASSAGE_KEYS)
  const markersPresent = passage !== null && A.hasClozeMarkers(passage)

  if (explicit === 'cloze' || (explicit === null && markersPresent)) {
    return buildCloze(raw, id, passage)
  }
  if (markersPresent) {
    throw new ItemError('conflicting-type', `声明为 ${explicit}，但内容出现 {{n}} 完形填空标记`)
  }
  if (explicit === 'tf') return buildTrueFalse(raw, id)

  const options = A.optionArrayOf(raw)
  if (explicit === 'single' || explicit === 'multi' || explicit === 'infer' || options !== null) {
    if (options === null) {
      throw new ItemError(
        'malformed-item',
        '声明为选择题，但找不到选项数组（choices / options / candidates）'
      )
    }
    const mode = explicit === 'single' ? 'single' : explicit === 'multi' ? 'multi' : null
    return buildChoice(raw, id, mode, options)
  }

  const booleanKey = A.answerKeyOf(raw)
  if (booleanKey !== undefined && parseBooleanLike(booleanKey) !== null) {
    return buildTrueFalse(raw, id)
  }

  throw new ItemError(
    'unknown-type',
    '无法唯一判断题型（没有可用的 type / 选项数组 / 布尔答案 / {{n}} 标记）'
  )
}

function readExplicitKind(raw: Record<string, unknown>): ExplicitKind | null {
  const picked = A.pickFirst(raw, A.TYPE_KEYS)
  if (picked === null) return null
  const value = asTrimmedString(picked.value)
  if (value === null) {
    throw new ItemError('unknown-type', `type 不是字符串：${previewOf(picked.value, 40)}`)
  }
  const kind = TYPE_MAP[normalizeType(value)]
  if (kind === undefined) throw new ItemError('unknown-type', `未识别的题型：${value}`)
  return kind
}

function normalizeType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

function buildChoice(
  raw: Record<string, unknown>,
  id: string,
  declaredMode: ChoiceMode | null,
  optionArray: unknown[]
): ChoiceItem {
  const prompt = A.firstStringByKeys(raw, A.PROMPT_KEYS)
  if (prompt === null)
    throw new ItemError('missing-prompt', '缺少题干（question / prompt / stem / statement）')
  const explanation = A.firstStringByKeys(raw, A.EXPLANATION_KEYS)
  if (optionArray.length < 2) {
    throw new ItemError('incomplete-options', `选项少于 2 个（当前 ${optionArray.length} 个）`)
  }

  const texts: string[] = []
  const flags: (boolean | null)[] = []

  optionArray.forEach((option, i) => {
    if (typeof option === 'string') {
      const text = asTrimmedString(option)
      if (text === null) throw new ItemError('incomplete-options', `第 ${i + 1} 个选项是空字符串`)
      texts.push(text)
      flags.push(null)
      return
    }
    if (!isPlainObject(option)) {
      throw new ItemError('incomplete-options', `第 ${i + 1} 个选项既不是字符串也不是对象`)
    }
    const text = A.firstStringByKeys(option, A.OPTION_TEXT_KEYS)
    if (text === null) {
      throw new ItemError(
        'incomplete-options',
        `第 ${i + 1} 个选项缺少文本（content / text / option / label / value）`
      )
    }
    texts.push(text)

    const flag = A.pickFirst(option, A.CORRECT_KEYS)
    if (flag === null) {
      flags.push(null)
      return
    }
    const parsed = parseBooleanLike(flag.value)
    if (parsed === null) {
      throw new ItemError(
        'missing-answer-key',
        `第 ${i + 1} 个选项的 ${flag.key} 不是布尔值：${previewOf(flag.value, 30)}`
      )
    }
    flags.push(parsed)
  })

  const resolved = resolveCorrectFlags(raw, texts, flags)
  const correctCount = resolved.filter(Boolean).length
  if (correctCount === 0) {
    throw new ItemError('no-correct-option', '所有选项都没有被标记为正确答案')
  }

  let mode: ChoiceMode
  if (declaredMode === null) {
    mode = correctCount === 1 ? 'single' : 'multi'
  } else if (declaredMode === 'single' && correctCount > 1) {
    throw new ItemError(
      'conflicting-type',
      `声明为单选（single-choice），但有 ${correctCount} 个正确答案`
    )
  } else {
    mode = declaredMode
  }

  return {
    kind: 'choice',
    id,
    mode,
    prompt,
    options: texts.map((text, i) => ({ id: `${id}-o${i + 1}`, text, correct: resolved[i] })),
    explanation
  }
}

function resolveCorrectFlags(
  raw: Record<string, unknown>,
  texts: string[],
  flags: (boolean | null)[]
): boolean[] {
  if (flags.every((f) => f !== null)) return flags as boolean[]

  const key = A.answerKeyOf(raw)
  if (key === undefined) {
    throw new ItemError(
      'missing-answer-key',
      '没有正确答案：选项缺少 correct 标记，题目也没有 answer 字段'
    )
  }

  const indices = resolveAnswerKeyIndices(key, texts)
  return texts.map((_, i) => indices.includes(i))
}

/**
 * answer 支持两种形状：
 *  - 单个值（字母 / 1-based 数字 / 选项原文）→ 一个正确答案
 *  - 数组（例如 answer: [1, 3]）→ 多个正确答案（多选题）
 * 数组里任何一个元素无法唯一对应 → 整条跳过。
 */
function resolveAnswerKeyIndices(key: unknown, texts: string[]): number[] {
  if (Array.isArray(key)) {
    if (key.length === 0) {
      throw new ItemError('missing-answer-key', 'answer 是空数组，没有正确答案')
    }
    const indices: number[] = []
    for (const element of key) {
      const matched = matchAnswerKey(element, texts)
      if (matched === 'ambiguous') {
        throw new ItemError(
          'ambiguous-answer-key',
          `answer 数组里有元素同时匹配多个选项：${previewOf(element, 30)}`
        )
      }
      if (matched === null) {
        throw new ItemError(
          'missing-answer-key',
          `answer 数组里有元素无法对应到任何选项：${previewOf(element, 30)}`
        )
      }
      if (!indices.includes(matched)) indices.push(matched)
    }
    return indices
  }

  const matched = matchAnswerKey(key, texts)
  if (matched === 'ambiguous') {
    throw new ItemError('ambiguous-answer-key', 'answer 同时匹配到多个选项，无法唯一确定')
  }
  if (matched === null) {
    throw new ItemError('missing-answer-key', `answer 无法对应到任何选项：${previewOf(key, 40)}`)
  }
  return [matched]
}

function matchAnswerKey(key: unknown, texts: string[]): number | 'ambiguous' | null {
  // 字母 A/B/C…（与选项顺序一一对应，最无歧义）
  if (typeof key === 'string' && /^[A-Za-z]$/.test(key.trim())) {
    const idx = key.trim().toUpperCase().charCodeAt(0) - 65
    return idx < texts.length ? idx : null
  }
  // 数字按 1-based 解释，且必须落在 1..n；0 或越界一律不认（宁可跳过）
  if (typeof key === 'number' && Number.isInteger(key)) {
    return key >= 1 && key <= texts.length ? key - 1 : null
  }
  if (typeof key === 'string' && /^\d+$/.test(key.trim())) {
    const n = Number(key.trim())
    return n >= 1 && n <= texts.length ? n - 1 : null
  }
  // 与选项原文精确匹配（去多余空白、忽略大小写）
  if (typeof key === 'string') {
    const target = normalizeText(key)
    const hits = texts.map((t, i) => (normalizeText(t) === target ? i : -1)).filter((i) => i >= 0)
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) return 'ambiguous'
  }
  return null
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function buildTrueFalse(raw: Record<string, unknown>, id: string): TrueFalseItem {
  const prompt = A.firstStringByKeys(raw, A.PROMPT_KEYS)
  if (prompt === null)
    throw new ItemError('missing-prompt', '缺少题干（question / prompt / statement）')

  const picked = A.pickFirst(raw, [...A.ANSWER_KEYS, ...A.CORRECT_KEYS])
  const answer = picked === null ? null : parseBooleanLike(picked.value)
  if (answer === null) {
    throw new ItemError('missing-answer-key', '判断题缺少布尔答案（answer: true / false）')
  }
  return {
    kind: 'true-false',
    id,
    prompt,
    answer,
    explanation: A.firstStringByKeys(raw, A.EXPLANATION_KEYS)
  }
}

function buildCloze(raw: Record<string, unknown>, id: string, passage: string | null): ClozeItem {
  if (passage === null) {
    throw new ItemError(
      'cloze-marker-mismatch',
      '找不到段落文本（passage / text / article / paragraph）'
    )
  }

  const markers = A.clozeMarkers(passage)
  if (markers.length === 0) throw new ItemError('cloze-marker-mismatch', '段落里没有 {{n}} 标记')

  const sorted = [...markers].sort((a, b) => a - b)
  const expected = Array.from({ length: markers.length }, (_, i) => i + 1)
  const wellFormed = sorted.every((v, i) => v === expected[i])
  if (!wellFormed) {
    throw new ItemError(
      'cloze-marker-mismatch',
      `标记必须是从 {{1}} 开始的连续整数且不重复，当前为 ${markers.map((m) => `{{${m}}}`).join(' ')}`
    )
  }

  const rawBlanks = readRawBlanks(raw)
  if (rawBlanks === null) {
    throw new ItemError(
      'cloze-missing-answer',
      `有 ${markers.length} 个空，但找不到 blanks / answers 数组`
    )
  }
  if (rawBlanks.length !== markers.length) {
    throw new ItemError(
      'cloze-missing-answer',
      `有 ${markers.length} 个空，但提供了 ${rawBlanks.length} 个答案`
    )
  }

  const byIndex = mapBlanksToMarkers(rawBlanks, markers.length)

  const blanks: ClozeBlank[] = expected.map((index) => {
    const blank = byIndex.get(index)
    if (blank === undefined) {
      throw new ItemError('cloze-marker-mismatch', `找不到编号为 ${index} 的空`)
    }
    return {
      index,
      answer: resolveBlankAnswer(blank, index),
      choices: blank.options,
      explanation: blank.explanation
    }
  })

  return {
    kind: 'cloze',
    id,
    passage,
    blanks,
    explanation: A.firstStringByKeys(raw, A.EXPLANATION_KEYS)
  }
}

interface RawBlank {
  /** 空号：来自 number 字段（权威）；null 表示该空没给编号 */
  number: number | null
  /** 给了 number 但不是合法整数 */
  invalidNumber: boolean
  /** 该空自带的词库 */
  options: string[]
  /** 原始 answer 值：文本、1-based 数字索引，或缺失 */
  answerRaw: unknown
  explanation: string | null
}

/**
 * 空号 → 空的映射：
 *  - number 全部存在且合法 → 以 number 为准
 *  - number 全部缺失 → 退回数组顺序（{{1}} 对应第 1 个）
 *  - 混用 / 非法 / 重复 / 越界 → 跳过（无法唯一对应就绝不猜）
 */
function mapBlanksToMarkers(rawBlanks: RawBlank[], count: number): Map<number, RawBlank> {
  const byIndex = new Map<number, RawBlank>()

  if (rawBlanks.some((blank) => blank.invalidNumber)) {
    throw new ItemError('cloze-marker-mismatch', 'blanks[].number 必须是合法的整数编号')
  }

  const numbered = rawBlanks.filter((blank) => blank.number !== null)
  if (numbered.length > 0 && numbered.length !== rawBlanks.length) {
    throw new ItemError(
      'cloze-marker-mismatch',
      '有的空给了 number、有的没给，无法唯一对应（要么都写，要么都不写）'
    )
  }

  if (numbered.length === 0) {
    rawBlanks.forEach((blank, i) => byIndex.set(i + 1, blank))
    return byIndex
  }

  for (const blank of rawBlanks) {
    const number = blank.number as number
    if (number < 1 || number > count) {
      throw new ItemError('cloze-marker-mismatch', `number ${number} 超出范围（应为 1..${count}）`)
    }
    if (byIndex.has(number)) {
      throw new ItemError('cloze-marker-mismatch', `number ${number} 重复`)
    }
    byIndex.set(number, blank)
  }
  return byIndex
}

/**
 * 把一个空的答案解析成**文本**（现有 ClozeBlank.answer 是字符串，结构不变）：
 *  - 数字 n → 按 1-based 索引取该空 options[n-1] 的文本
 *  - 字符串且有词库、且本身是纯数字 → 同样按索引解释
 *  - 其余字符串 → 自由填空的文本
 *  - 0 / 越界 / 非整数 / 空 / 其它类型 → 跳过，绝不猜
 */
function resolveBlankAnswer(blank: RawBlank, index: number): string {
  const value = blank.answerRaw

  if (typeof value === 'number') return optionTextAt(value, blank.options, index)

  if (typeof value === 'string') {
    const text = value.trim()
    if (!isNonEmptyString(text)) {
      throw new ItemError('cloze-missing-answer', `第 ${index} 个空没有答案`)
    }
    if (blank.options.length > 0 && /^\d+$/.test(text)) {
      return optionTextAt(Number(text), blank.options, index)
    }
    return text
  }

  throw new ItemError(
    'cloze-missing-answer',
    `第 ${index} 个空没有可用答案（当前是 ${previewOf(value, 30)}）`
  )
}

function optionTextAt(oneBased: number, options: string[], index: number): string {
  if (!Number.isInteger(oneBased) || oneBased < 1 || oneBased > options.length) {
    throw new ItemError(
      'missing-answer-key',
      `第 ${index} 个空的 answer 是 ${oneBased}，需要 1-based 且落在 1..${options.length}（该空选项 ${options.length} 个）`
    )
  }
  const text: string | undefined = options[oneBased - 1]
  if (text === undefined || text === '') {
    throw new ItemError('cloze-missing-answer', `第 ${index} 个空的答案选项文本为空`)
  }
  return text
}

function readRawBlanks(raw: Record<string, unknown>): RawBlank[] | null {
  const picked = A.pickFirst(raw, A.BLANK_ARRAY_KEYS)
  if (picked === null) return null
  const value = picked.value

  if (Array.isArray(value)) return value.map((element) => toRawBlank(element, null))

  // { "1": …, "2": … } 这种按空编号给的映射：键就是空号
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
    if (keys.length === 0) return null
    return keys.map((key) => toRawBlank(value[key], Number(key)))
  }

  return null
}

function toRawBlank(element: unknown, fallbackNumber: number | null): RawBlank {
  if (typeof element === 'string' || typeof element === 'number') {
    return {
      number: fallbackNumber,
      invalidNumber: false,
      options: [],
      answerRaw: element,
      explanation: null
    }
  }

  if (!isPlainObject(element)) {
    return {
      number: fallbackNumber,
      invalidNumber: false,
      options: [],
      answerRaw: undefined,
      explanation: null
    }
  }

  const numberPick = A.pickFirst(element, A.BLANK_NUMBER_KEYS)
  const number = readBlankNumber(numberPick === null ? undefined : numberPick.value, fallbackNumber)

  return {
    number: number.value,
    invalidNumber: number.invalid,
    options: readChoices(element),
    answerRaw: A.pickFirst(element, A.BLANK_ANSWER_KEYS)?.value,
    explanation: A.firstStringByKeys(element, A.EXPLANATION_KEYS)
  }
}

function readBlankNumber(
  value: unknown,
  fallback: number | null
): { value: number | null; invalid: boolean } {
  if (value === undefined) return { value: fallback, invalid: false }
  if (typeof value === 'number' && Number.isInteger(value)) return { value, invalid: false }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return { value: Number(value.trim()), invalid: false }
  }
  return { value: fallback, invalid: true }
}

function readChoices(holder: Record<string, unknown>): string[] {
  const array = A.optionArrayOf(holder)
  if (array === null) return []
  return array
    .map((element) => {
      if (typeof element === 'string') return element.trim()
      if (isPlainObject(element)) return A.firstStringByKeys(element, A.OPTION_TEXT_KEYS) ?? ''
      return ''
    })
    .filter((text) => text !== '')
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
