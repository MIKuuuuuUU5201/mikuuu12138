import { describe, expect, it } from 'vitest'
import { parseVocabText } from '../vocab-parse'
import { json, readSample } from './samples'

const reasonsOf = (text: string) => parseVocabText(text).skipped.map((s) => s.reason)

describe('词汇 JSON 解析', () => {
  const report = parseVocabText(readSample('vocab-lesson01.json'))

  it('5 条全部导入，标题取自 title', () => {
    expect(report.fatal).toBeNull()
    expect(report.title).toBe('Lesson 01 · A Private Conversation')
    expect(report.accepted).toHaveLength(5)
    expect(report.skipped).toHaveLength(0)
  })

  it('标准字段 word / example / translation', () => {
    expect(report.accepted[0]).toEqual({
      id: 'v1',
      word: 'confidence',
      example: 'I have confidence in you.',
      translation: '我对你有信心。'
    })
  })

  it('别名 term / sentence / meaning 同样认', () => {
    expect(report.accepted[1]).toEqual({
      id: 'v2',
      word: 'private',
      example: 'This is a private conversation.',
      translation: '私人的；私密的'
    })
  })

  it('缺 example 或 translation 就留 null，不推测内容', () => {
    expect(report.accepted[2]).toEqual({
      id: 'v3',
      word: 'angry',
      example: null,
      translation: '生气的'
    })
    expect(report.accepted[3]).toEqual({
      id: 'v4',
      word: 'attention',
      example: null,
      translation: null
    })
  })

  it('纯字符串数组形式的词表也认', () => {
    expect(report.accepted[4]).toEqual({
      id: 'v5',
      word: 'theatre',
      example: null,
      translation: null
    })
  })
})

describe('词汇解析的容错', () => {
  it('没有 word 字段 → 跳过该条，其余照常导入', () => {
    const text = json({
      title: 'T',
      items: [{ translation: '孤儿翻译' }, { word: 'good', translation: '好的' }, { word: '   ' }]
    })
    const report = parseVocabText(text)
    expect(report.accepted).toHaveLength(1)
    expect(report.accepted[0]?.word).toBe('good')
    expect(report.skipped.map((s) => s.reason)).toEqual(['missing-word', 'missing-word'])
    expect(report.skipped.map((s) => s.index)).toEqual([0, 2])
  })

  it('条目不是对象或字符串 → 跳过', () => {
    const text = json({ items: [{ word: 'ok' }, 42, null, true] })
    expect(reasonsOf(text)).toEqual(['not-an-object', 'not-an-object', 'not-an-object'])
  })

  it('单词前后空白会被去掉', () => {
    const report = parseVocabText(json({ items: [{ word: '  confidence  ' }] }))
    expect(report.accepted[0]?.word).toBe('confidence')
  })

  it('顶层数组 + 字符串条目', () => {
    const report = parseVocabText(json(['apple', 'banana']))
    expect(report.accepted.map((i) => i.word)).toEqual(['apple', 'banana'])
  })

  it('words / vocabulary 等数组字段名都能认', () => {
    for (const key of ['words', 'vocabulary', 'wordList', 'list', 'entries']) {
      const report = parseVocabText(json({ title: 'T', [key]: [{ word: 'a' }] }))
      expect(report.accepted, key).toHaveLength(1)
    }
  })

  it('围栏包裹的 JSON 也能读', () => {
    const report = parseVocabText('```json\n{"title":"T","items":[{"word":"a"}]}\n```')
    expect(report.title).toBe('T')
    expect(report.accepted).toHaveLength(1)
  })
})

describe('词汇整体失败', () => {
  it('语法错 → fatal invalid-json', () => {
    expect(parseVocabText('{').fatal?.reason).toBe('invalid-json')
  })

  it('没有词条数组 → fatal no-items', () => {
    expect(parseVocabText(json({ title: 'T' })).fatal?.reason).toBe('no-items')
  })

  it('词条数组为空 → fatal empty-items', () => {
    expect(parseVocabText(json({ items: [] })).fatal?.reason).toBe('empty-items')
  })
})
