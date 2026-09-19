/**
 * 复制文本的规则测试。
 *
 * 最关键的一条：复制内容里**不能**出现正确答案与 explanation。
 * 选项原文当然会在（要求就是「所有选项」），但「我的答案」那一行不能泄露正确答案。
 */
import { describe, expect, it } from 'vitest'
import type { ChoiceItem, ClozeItem, TrueFalseItem } from '@/core/model/quiz'
import { buildCopyText } from '../copy-text'

const CHOICE: ChoiceItem = {
  kind: 'choice',
  id: 'q1',
  mode: 'single',
  prompt: 'She ____ to the theatre last night.',
  options: [
    { id: 'q1-o1', text: 'went', correct: true },
    { id: 'q1-o2', text: 'go', correct: false },
    { id: 'q1-o3', text: 'goes', correct: false }
  ],
  explanation: 'last night 是过去时间状语，用过去式 went。'
}

const MULTI: ChoiceItem = { ...CHOICE, id: 'q2', mode: 'multi' }

const TF: TrueFalseItem = {
  kind: 'true-false',
  id: 'q3',
  prompt: 'The past tense of "think" is "thinked".',
  answer: false,
  explanation: 'think 的过去式是 thought。'
}

const CLOZE: ClozeItem = {
  kind: 'cloze',
  id: 'q4',
  passage: 'Last week I {{1}} to the theatre. He was talking {{2}}.',
  blanks: [
    { index: 1, answer: 'went', choices: ['went', 'go', 'goes'] },
    {
      index: 2,
      answer: 'loudly',
      choices: ['loud', 'loudly', 'louder'],
      explanation: '修饰 talking 用副词。'
    }
  ],
  explanation: '整篇解析。'
}

const lines = (text: string) => text.split('\n')
const lastLine = (text: string) => lines(text).at(-1) ?? ''

describe('复制：单选题', () => {
  it('包含题目与所有选项', () => {
    const text = buildCopyText({ item: CHOICE, selected: ['q1-o2'] })
    expect(text).toContain('She ____ to the theatre last night.')
    expect(text).toContain('A. went')
    expect(text).toContain('B. go')
    expect(text).toContain('C. goes')
  })

  it('答错时「我的答案」只写我选的那一项，不泄露正确答案', () => {
    const text = buildCopyText({ item: CHOICE, selected: ['q1-o2'] })
    expect(lastLine(text)).toBe('我的答案：B. go')
  })

  it('答对时「我的答案」写我选的那一项', () => {
    const text = buildCopyText({ item: CHOICE, selected: ['q1-o1'] })
    expect(lastLine(text)).toBe('我的答案：A. went')
  })

  it('未作答时明确写未作答，不猜', () => {
    const text = buildCopyText({ item: CHOICE, selected: [] })
    expect(lastLine(text)).toBe('我的答案：（未作答）')
  })

  it('绝不包含 explanation', () => {
    const text = buildCopyText({ item: CHOICE, selected: ['q1-o2'] })
    expect(text).not.toContain('last night 是过去时间状语')
    expect(text).not.toContain('解析')
    expect(text).not.toContain('正确答案')
  })
})

describe('复制：多选题', () => {
  it('多个选择都写出来，顺序按选项顺序', () => {
    const text = buildCopyText({ item: MULTI, selected: ['q1-o3', 'q1-o1'] })
    expect(lastLine(text)).toBe('我的答案：A. went，C. goes')
  })

  it('一个都没选时写未作答', () => {
    expect(lastLine(buildCopyText({ item: MULTI, selected: [] }))).toBe('我的答案：（未作答）')
  })
})

describe('复制：判断题', () => {
  it('包含 statement 与 True / False 两个选项', () => {
    const text = buildCopyText({ item: TF, trueFalse: false })
    expect(text).toContain('The past tense of "think" is "thinked".')
    expect(text).toContain('A. True')
    expect(text).toContain('B. False')
  })

  it('「我的答案」写 False，且不含 explanation', () => {
    const text = buildCopyText({ item: TF, trueFalse: false })
    expect(lastLine(text)).toBe('我的答案：False')
    expect(text).not.toContain('think 的过去式是 thought')
  })

  it('未作答时写未作答', () => {
    expect(lastLine(buildCopyText({ item: TF, trueFalse: null }))).toBe('我的答案：（未作答）')
  })
})

describe('复制：完形填空', () => {
  it('包含完整 passage、每个空的选项、以及我的答案', () => {
    const text = buildCopyText({ item: CLOZE, blanks: { 1: 'go', 2: 'loudly' } })
    expect(text).toContain('Last week I {{1}} to the theatre. He was talking {{2}}.')
    expect(text).toContain('1.')
    expect(text).toContain('A. went')
    expect(text).toContain('2.')
    expect(text).toContain('B. loudly')
    expect(lastLine(text)).toBe('我的答案：1) go  2) loudly')
  })

  it('答错的那一空写我的错答，不写正确文本', () => {
    const text = buildCopyText({ item: CLOZE, blanks: { 1: 'goes', 2: 'loud' } })
    expect(lastLine(text)).toBe('我的答案：1) goes  2) loud')
  })

  it('没填的空写未作答', () => {
    const text = buildCopyText({ item: CLOZE, blanks: { 1: 'go' } })
    expect(lastLine(text)).toBe('我的答案：1) go  2) （未作答）')
  })

  it('绝不包含每空的 explanation 与整篇 explanation', () => {
    const text = buildCopyText({ item: CLOZE, blanks: {} })
    expect(text).not.toContain('修饰 talking 用副词')
    expect(text).not.toContain('整篇解析')
  })

  it('自由填空（没有选项）的空也能正常输出', () => {
    const freeFill: ClozeItem = {
      kind: 'cloze',
      id: 'q5',
      passage: 'I {{1}} home.',
      blanks: [{ index: 1, answer: 'went', choices: [] }]
    }
    const text = buildCopyText({ item: freeFill, blanks: { 1: 'go' } })
    expect(lastLine(text)).toBe('我的答案：1) go')
    expect(text).not.toContain('A. ')
  })
})
