import { describe, expect, it } from 'vitest'
import {
  gradeCloze,
  gradeMultipleChoice,
  gradeSingleChoice,
  gradeTrueFalse,
  normalizeAnswer
} from '../grading'
import type { ChoiceItem, ClozeItem, TrueFalseItem } from '../../model/quiz'

const single: ChoiceItem = {
  kind: 'choice',
  id: 'q1',
  mode: 'single',
  prompt: 'p',
  options: [
    { id: 'q1-o1', text: 'A', correct: false },
    { id: 'q1-o2', text: 'B', correct: true }
  ]
}

const multi: ChoiceItem = {
  ...single,
  id: 'q2',
  mode: 'multi',
  options: [
    { id: 'q2-o1', text: 'A', correct: true },
    { id: 'q2-o2', text: 'B', correct: false },
    { id: 'q2-o3', text: 'C', correct: true }
  ]
}

const trueFalse: TrueFalseItem = { kind: 'true-false', id: 'q3', prompt: 'p', answer: false }

const cloze: ClozeItem = {
  kind: 'cloze',
  id: 'q4',
  passage: 'I {{1}} to the {{2}}.',
  blanks: [
    { index: 1, answer: 'went', choices: [] },
    { index: 2, answer: 'theatre', choices: [] }
  ]
}

describe('单选判定', () => {
  it('选中正确项 → correct', () => {
    expect(gradeSingleChoice(single, 'q1-o2')).toBe('correct')
  })

  it('选中错误项 → wrong', () => {
    expect(gradeSingleChoice(single, 'q1-o1')).toBe('wrong')
  })

  it('未作答 → null', () => {
    expect(gradeSingleChoice(single, null)).toBeNull()
  })

  it('传入不存在的选项 id → null（当作未作答，而不是判错）', () => {
    expect(gradeSingleChoice(single, 'nope')).toBeNull()
  })
})

describe('多选判定：集合必须完全一致', () => {
  it('全对 → correct', () => {
    expect(gradeMultipleChoice(multi, ['q2-o1', 'q2-o3'])).toBe('correct')
  })

  it('顺序不影响结果', () => {
    expect(gradeMultipleChoice(multi, ['q2-o3', 'q2-o1'])).toBe('correct')
  })

  it('漏选 → wrong', () => {
    expect(gradeMultipleChoice(multi, ['q2-o1'])).toBe('wrong')
  })

  it('多选 → wrong', () => {
    expect(gradeMultipleChoice(multi, ['q2-o1', 'q2-o2', 'q2-o3'])).toBe('wrong')
  })

  it('一个都不选 → wrong（不是 null：提交了空集合就是错误答案）', () => {
    expect(gradeMultipleChoice(multi, [])).toBe('wrong')
  })
})

describe('判断题判定', () => {
  it('答对 / 答错 / 未作答', () => {
    expect(gradeTrueFalse(trueFalse, false)).toBe('correct')
    expect(gradeTrueFalse(trueFalse, true)).toBe('wrong')
    expect(gradeTrueFalse(trueFalse, null)).toBeNull()
  })
})

describe('完形填空判定', () => {
  it('全对 → overall correct，逐空都 correct', () => {
    const result = gradeCloze(cloze, ['went', 'theatre'])
    expect(result.overall).toBe('correct')
    expect(result.blankResults.map((r) => r.verdict)).toEqual(['correct', 'correct'])
  })

  it('有一空错 → overall wrong，且能定位是哪个空', () => {
    const result = gradeCloze(cloze, ['went', 'cinema'])
    expect(result.overall).toBe('wrong')
    expect(result.blankResults).toEqual([
      { index: 1, verdict: 'correct' },
      { index: 2, verdict: 'wrong' }
    ])
  })

  it('有空没填 → overall null（未作答），已填的空仍然给出判定', () => {
    const result = gradeCloze(cloze, ['went', null])
    expect(result.overall).toBeNull()
    expect(result.blankResults).toEqual([
      { index: 1, verdict: 'correct' },
      { index: 2, verdict: null }
    ])
  })

  it('空白字符串视为未填', () => {
    expect(gradeCloze(cloze, ['went', '   ']).overall).toBeNull()
  })

  it('忽略大小写与多余空格', () => {
    expect(gradeCloze(cloze, ['  Went ', 'THEATRE']).overall).toBe('correct')
  })

  it('答案数组比空数短 → 缺的算未填', () => {
    const result = gradeCloze(cloze, ['went'])
    expect(result.overall).toBeNull()
    expect(result.blankResults[1]?.verdict).toBeNull()
  })
})

describe('文本归一化', () => {
  it('去首尾空白、多空格归一、忽略大小写', () => {
    expect(normalizeAnswer('  Hello   World ')).toBe('hello world')
  })
})
