/**
 * 把 GPT 侧的两种标准格式钉死：只要这份测试是绿的，标准格式就是 100% 支持的。
 * 样本文件：samples/gpt-quiz-standard.json、samples/gpt-vocab-standard.json
 */
import { describe, expect, it } from 'vitest'
import { parseQuizText } from '../quiz-parse'
import { parseVocabText } from '../vocab-parse'
import type { ChoiceItem, ClozeItem, TrueFalseItem } from '../../model/quiz'
import { readSample } from './samples'

describe('GPT 标准格式 · 词汇 JSON', () => {
  const report = parseVocabText(readSample('gpt-vocab-standard.json'))

  it('100% 导入：无 fatal、无跳过', () => {
    expect(report.fatal).toBeNull()
    expect(report.skipped).toHaveLength(0)
    expect(report.accepted).toHaveLength(2)
    expect(report.title).toBe('标准格式 · 词汇')
  })

  it('word / example / translation 逐字段原样保留', () => {
    expect(report.accepted[0]).toEqual({
      id: 'v1',
      word: 'confidence',
      example: 'I have confidence in you.',
      translation: '我对你有信心。'
    })
    expect(report.accepted[1]).toEqual({
      id: 'v2',
      word: 'private',
      example: 'This is a private conversation.',
      translation: '私人的；私密的'
    })
  })
})

describe('GPT 标准格式 · 题目 JSON（三种题型混装）', () => {
  const report = parseQuizText(readSample('gpt-quiz-standard.json'))

  it('100% 导入：无 fatal、无跳过', () => {
    expect(report.fatal).toBeNull()
    expect(report.skipped).toHaveLength(0)
    expect(report.accepted).toHaveLength(3)
    expect(report.title).toBe('标准格式 · 混合题型')
  })

  it('外层用 items，三种题型按顺序识别', () => {
    expect(report.accepted.map((item) => item.kind)).toEqual(['choice', 'true-false', 'cloze'])
  })

  it('选择题：multiple_choice + 单个 answer → 单选，answer:1 指向第一个选项', () => {
    const item = report.accepted[0] as ChoiceItem
    expect(item.mode).toBe('single')
    expect(item.prompt).toBe('She ____ to the theatre last night.')
    expect(item.options.map((o) => o.text)).toEqual(['went', 'go', 'goes', 'going'])
    expect(item.options.map((o) => o.correct)).toEqual([true, false, false, false])
  })

  it('选择题：explanation 保留', () => {
    const item = report.accepted[0] as ChoiceItem
    expect(item.explanation).toBe('last night 是过去时间状语，用过去式 went。')
  })

  it('判断题：statement 当题干、布尔 answer、explanation 保留', () => {
    const item = report.accepted[1] as TrueFalseItem
    expect(item.prompt).toBe('The past tense of "think" is "thinked".')
    expect(item.answer).toBe(false)
    expect(item.explanation).toBe('think 的过去式是 thought，不是 thinked。')
  })

  it('完形填空：{{1}}/{{2}} 解析成两个空，answer 是 1-based 索引 → 转成选项文本', () => {
    const item = report.accepted[2] as ClozeItem
    expect(item.passage).toContain('{{1}}')
    expect(item.passage).toContain('{{2}}')
    expect(item.blanks.map((b) => b.index)).toEqual([1, 2])
    // blanks[0].answer = 1 → options[0]；blanks[1].answer = 2 → options[1]
    expect(item.blanks.map((b) => b.answer)).toEqual(['went', 'loudly'])
  })

  it('完形填空：每个空保留自己的词库与 explanation', () => {
    const item = report.accepted[2] as ClozeItem
    expect(item.blanks[0]?.choices).toEqual(['went', 'go', 'goes', 'going'])
    expect(item.blanks[1]?.choices).toEqual(['loud', 'loudly', 'loudness', 'louder'])
    expect(item.blanks[0]?.explanation).toBe('Last week 提示过去时，选 went。')
    expect(item.blanks[1]?.explanation).toBe('修饰动词 talking 要用副词 loudly。')
  })
})
