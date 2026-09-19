import { describe, expect, it } from 'vitest'
import { extractSkeleton } from '../skeleton'
import {
  QUIZ_ITEM_HINT_KEYS,
  QUIZ_ITEM_KEYS,
  VOCAB_ITEM_HINT_KEYS,
  VOCAB_ITEM_KEYS
} from '../aliases'

const quiz = (root: unknown) => extractSkeleton(root, QUIZ_ITEM_KEYS, QUIZ_ITEM_HINT_KEYS)
const vocab = (root: unknown) => extractSkeleton(root, VOCAB_ITEM_KEYS, VOCAB_ITEM_HINT_KEYS)

describe('extractSkeleton：找 title 与 items', () => {
  it('questions 字段', () => {
    const result = quiz({ title: 'T', questions: [{ a: 1 }] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.skeleton.title).toBe('T')
      expect(result.skeleton.items).toHaveLength(1)
    }
  })

  it('items / exercises / list / rows / data 都能认', () => {
    for (const key of ['items', 'exercises', 'list', 'rows', 'data']) {
      const result = quiz({ title: 'T', [key]: [{ a: 1 }, { b: 2 }] })
      expect(result.ok, key).toBe(true)
      if (result.ok) expect(result.skeleton.items).toHaveLength(2)
    }
  })

  it('title 别名字段', () => {
    const result = vocab({ name: 'Lesson 02', items: [{ word: 'a' }] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.skeleton.title).toBe('Lesson 02')
  })

  it('没有 title 时给空字符串，不算错误', () => {
    const result = vocab({ items: [{ word: 'a' }] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.skeleton.title).toBe('')
  })

  it('顶层数组直接用，title 为空', () => {
    const result = quiz([{ question: 'q', choices: [] }])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.skeleton.title).toBe('')
      expect(result.skeleton.items).toHaveLength(1)
    }
  })

  it('数字键对象（{"1":{...},{"2":{...}}）也当数组', () => {
    const result = quiz({ title: 'T', questions: { 1: { a: 1 }, 2: { b: 2 } } })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.skeleton.items).toHaveLength(2)
  })

  it('整个文件就是一条题时，把顶层对象当作唯一一项', () => {
    const result = quiz({ question: 'only one', choices: [{ content: 'a', correct: true }] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.skeleton.items).toHaveLength(1)
  })

  it('词汇：单条 {word:...} 同样支持', () => {
    const result = vocab({ word: 'confidence', translation: '信心' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.skeleton.items).toHaveLength(1)
  })

  it('空数组 → empty-items（fatal）', () => {
    const result = quiz({ title: 'T', questions: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('empty-items')
  })

  it('顶层空数组 → empty-items', () => {
    const result = quiz([])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('empty-items')
  })

  it('找不到任何数组字段 → no-items（fatal）', () => {
    const result = quiz({ title: 'T', foo: 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no-items')
  })

  it('顶层是字符串 → not-an-object', () => {
    const result = quiz('hello')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not-an-object')
  })
})
