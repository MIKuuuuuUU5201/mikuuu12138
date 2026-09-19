/**
 * 字段别名表 —— 解析层容忍度的唯一来源。
 *
 * 设计约束（重要）：
 *  1. 别名是**白名单**，写死在这张表里；不做模糊匹配、不做拼音/翻译猜测。
 *  2. 只影响“字段叫什么”，绝不参与“答案是什么”：任何答案都必须由 JSON 显式给出。
 *  3. 表越小越好读，改起来越安全；要加别名就加在这一个文件里。
 */
import { asTrimmedString, isPlainObject } from '../util/assert'

export const TITLE_KEYS = ['title', 'name', 'topic', 'lesson', 'unit', 'quizTitle', 'vocabTitle']

export const TYPE_KEYS = ['type', 'questionType', 'question_type', 'kind', 'category']

export const QUIZ_ITEM_KEYS = ['questions', 'items', 'exercises', 'list', 'data', 'rows', 'entries']

export const VOCAB_ITEM_KEYS = [
  'items',
  'words',
  'vocabulary',
  'wordList',
  'word_list',
  'list',
  'data',
  'entries'
]

export const PROMPT_KEYS = ['question', 'prompt', 'stem', 'statement']

export const OPTION_TEXT_KEYS = ['content', 'text', 'option', 'label', 'value']

export const OPTION_ARRAY_KEYS = ['choices', 'options', 'candidates']

export const CORRECT_KEYS = ['correct', 'isCorrect', 'is_correct', 'right']

export const ANSWER_KEYS = [
  'answer',
  'correctAnswer',
  'correct_answer',
  'answerKey',
  'answer_key',
  'key'
]

export const PASSAGE_KEYS = [
  'passage',
  'text',
  'cloze',
  'article',
  'paragraph',
  'content',
  'body',
  'question'
]

export const BLANK_ARRAY_KEYS = ['blanks', 'answers', 'gaps']

export const BLANK_ANSWER_KEYS = ['answer', 'text', 'value', 'content']

/** 完形填空的空号：标准格式用 number；存在且合法时以它为准 */
export const BLANK_NUMBER_KEYS = ['number']

/** 解析说明：三种题型与完形填空的每个空都可以携带，缺失不影响导入 */
export const EXPLANATION_KEYS = ['explanation']

export const WORD_KEYS = ['word', 'term', 'en', 'english', 'headword', 'spelling']

export const EXAMPLE_KEYS = [
  'example',
  'sentence',
  'exampleSentence',
  'example_sentence',
  'usage',
  'sample'
]

export const TRANSLATION_KEYS = ['translation', 'meaning', 'zh', 'chinese', 'translate']

/** 出现这些键说明顶层对象本身可能就是“单条”，而不是容器 */
export const QUIZ_ITEM_HINT_KEYS = [...PROMPT_KEYS, ...OPTION_ARRAY_KEYS, 'type']
export const VOCAB_ITEM_HINT_KEYS = WORD_KEYS

const CLOZE_MARKER = /\{\{\s*(\d+)\s*\}\}/g

/** 完形填空标记：{{1}} / {{ 2 }} 都认 */
export function clozeMarkers(text: string): number[] {
  const found: number[] = []
  for (const m of text.matchAll(CLOZE_MARKER)) found.push(Number(m[1]))
  return found
}

export function hasClozeMarkers(text: string): boolean {
  return clozeMarkers(text).length > 0
}

export function pickFirst(
  obj: Record<string, unknown>,
  keys: readonly string[]
): { key: string; value: unknown } | null {
  for (const key of keys) {
    if (obj[key] !== undefined) return { key, value: obj[key] }
  }
  return null
}

export function firstStringByKeys(
  obj: Record<string, unknown>,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = asTrimmedString(obj[key])
    if (value !== null) return value
  }
  return null
}

export function hasAnyKey(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => obj[key] !== undefined)
}

/**
 * 取选项数组。
 * OPTION_ARRAY_KEYS 之外的兼容：`answers` 这个键名歧义大（可能指答案键，也可能指选项），
 * 只有当它确实是“对象组成的数组”时才当作选项数组使用——字符串数组一律不当选项。
 */
export function optionArrayOf(raw: Record<string, unknown>): unknown[] | null {
  for (const key of OPTION_ARRAY_KEYS) {
    const value = raw[key]
    if (Array.isArray(value)) return value
  }
  const answers = raw['answers']
  if (Array.isArray(answers) && answers.length > 0 && answers.every((v) => isPlainObject(v))) {
    return answers
  }
  return null
}

/** 优先取“自己声明的正确答案”，其次才是别的兼容键 */
export function answerKeyOf(raw: Record<string, unknown>): unknown {
  const picked = pickFirst(raw, ANSWER_KEYS)
  return picked === null ? undefined : picked.value
}
