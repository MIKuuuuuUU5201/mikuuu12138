import { describe, expect, it } from 'vitest'
import { parseQuizText } from '../quiz-parse'
import type { ChoiceItem, ClozeItem, QuizItem, TrueFalseItem } from '../../model/quiz'
import { json, readSample } from './samples'

const kindsOf = (items: QuizItem[]) => items.map((i) => i.kind)
const reasonsOf = (text: string) => parseQuizText(text).skipped.map((s) => s.reason)

function firstChoice(text: string): ChoiceItem {
  const report = parseQuizText(text)
  const item = report.accepted[0]
  if (item === undefined || item.kind !== 'choice') throw new Error('expected a choice item')
  return item
}

describe('混合题型：一个 JSON 里多种题型', () => {
  const report = parseQuizText(readSample('quiz-mixed.json'))

  it('全部 7 条都能识别，没有跳过', () => {
    expect(report.fatal).toBeNull()
    expect(report.title).toBe('Lesson 01 · 混合题型样本')
    expect(report.accepted).toHaveLength(7)
    expect(report.skipped).toHaveLength(0)
  })

  it('题型顺序与内容一一对应', () => {
    expect(kindsOf(report.accepted)).toEqual([
      'choice',
      'choice',
      'choice',
      'true-false',
      'cloze',
      'choice',
      'choice'
    ])
  })

  it('显式 单选 / 多选 被正确区分', () => {
    const single = report.accepted[0] as ChoiceItem
    const multi = report.accepted[1] as ChoiceItem
    expect(single.mode).toBe('single')
    expect(single.options.filter((o) => o.correct)).toHaveLength(1)
    expect(multi.mode).toBe('multi')
    expect(multi.options.filter((o) => o.correct)).toHaveLength(3)
  })

  it('没有 type 但结构是选择题 → 按正确答案个数推断为单选', () => {
    const inferred = report.accepted[2] as ChoiceItem
    expect(inferred.kind).toBe('choice')
    expect(inferred.mode).toBe('single')
    expect(inferred.prompt).toContain('confidence')
  })

  it('判断题保留布尔答案', () => {
    const tf = report.accepted[3] as TrueFalseItem
    expect(tf.answer).toBe(false)
    expect(tf.prompt).toContain('thinked')
  })

  it('完形填空按 {{1}} / {{2}} 解析成两个空，段落标记原样保留', () => {
    const cloze = report.accepted[4] as ClozeItem
    expect(cloze.passage).toContain('{{1}}')
    expect(cloze.passage).toContain('{{2}}')
    expect(cloze.blanks.map((b) => b.index)).toEqual([1, 2])
    expect(cloze.blanks.map((b) => b.answer)).toEqual(['went', 'loudly'])
  })

  it('answer: "A" 映射到第一个选项', () => {
    const item = report.accepted[5] as ChoiceItem
    expect(item.options.map((o) => o.correct)).toEqual([true, false, false])
    expect(item.mode).toBe('single')
  })

  it('answer: 2 按 1-based 映射到第二个选项', () => {
    const item = report.accepted[6] as ChoiceItem
    expect(item.options[1]?.text).toContain("didn't go out")
    expect(item.options.map((o) => o.correct)).toEqual([false, true, false])
  })

  it('id 与选项 id 稳定可推导', () => {
    const item = report.accepted[0] as ChoiceItem
    expect(item.id).toBe('q1')
    expect(item.options[0]?.id).toBe('q1-o1')
  })
})

describe('坏数据：能识别的照常导入，不能识别的跳过后报告', () => {
  const report = parseQuizText(readSample('quiz-broken.json'))

  it('只有第 1 条被导入，其余 8 条被跳过', () => {
    expect(report.fatal).toBeNull()
    expect(report.accepted).toHaveLength(1)
    expect(report.accepted[0]?.kind).toBe('choice')
    expect(report.skipped).toHaveLength(8)
  })

  it('每一条跳过都带下标、原因与人话说明', () => {
    expect(report.skipped.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (const entry of report.skipped) {
      expect(entry.detail.length).toBeGreaterThan(0)
      expect(entry.preview.length).toBeGreaterThan(0)
    }
  })

  it('跳过原因逐条对应', () => {
    expect(report.skipped.map((s) => s.reason)).toEqual([
      'missing-answer-key', // 没有 correct 标记也没有 answer
      'no-correct-option', // 全部显式 false
      'unknown-type', // type: essay
      'conflicting-type', // 声明单选却有 2 个正确答案
      'cloze-marker-mismatch', // {{1}} {{3}}
      'cloze-missing-answer', // 2 个空只有 1 个答案
      'missing-prompt', // 只有 choices，没有题干
      'not-an-object' // 裸字符串
    ])
  })
})

describe('绝不猜答案', () => {
  it('选项部分带 correct 标记、部分缺失，且没有 answer → 跳过', () => {
    const text = json({
      questions: [
        {
          question: 'q',
          choices: [{ content: 'A', correct: true }, { content: 'B' }, { content: 'C' }]
        }
      ]
    })
    expect(reasonsOf(text)).toEqual(['missing-answer-key'])
  })

  it('完全没有答案信息 → 跳过', () => {
    const text = json({
      questions: [{ question: 'q', choices: [{ content: 'A' }, { content: 'B' }] }]
    })
    expect(reasonsOf(text)).toEqual(['missing-answer-key'])
  })

  it('所有选项都是 false → 跳过（而不是当作全错答案）', () => {
    const text = json({
      questions: [
        {
          question: 'q',
          choices: [
            { content: 'A', correct: false },
            { content: 'B', correct: false }
          ]
        }
      ]
    })
    expect(reasonsOf(text)).toEqual(['no-correct-option'])
  })

  it('数字答案按 1-based，且越界 / 0 一律不认', () => {
    const outOfRange = json({
      questions: [{ question: 'q', choices: ['A', 'B', 'C'], answer: 5 }]
    })
    expect(reasonsOf(outOfRange)).toEqual(['missing-answer-key'])

    const zero = json({ questions: [{ question: 'q', choices: ['A', 'B', 'C'], answer: 0 }] })
    expect(reasonsOf(zero)).toEqual(['missing-answer-key'])
  })

  it('answer 同时匹配多个选项 → 跳过（不随便挑一个）', () => {
    const text = json({
      questions: [
        { question: 'q', choices: [{ content: 'same' }, { content: 'same' }], answer: 'same' }
      ]
    })
    expect(reasonsOf(text)).toEqual(['ambiguous-answer-key'])
  })

  it('answer 是文本但与任何选项都不匹配 → 跳过', () => {
    const text = json({ questions: [{ question: 'q', choices: ['A', 'B'], answer: 'C' }] })
    expect(reasonsOf(text)).toEqual(['missing-answer-key'])
  })

  it('判断题缺少布尔答案 → 跳过', () => {
    const text = json({ questions: [{ type: 'true-false', question: 'q' }] })
    expect(reasonsOf(text)).toEqual(['missing-answer-key'])
  })

  it('判断题答案是字符串 "maybe" → 跳过（不猜真假）', () => {
    const text = json({ questions: [{ type: 'true-false', question: 'q', answer: 'maybe' }] })
    expect(reasonsOf(text)).toEqual(['missing-answer-key'])
  })

  it('完形填空某个空没有答案 → 整条跳过', () => {
    const text = json({
      questions: [{ type: 'cloze', passage: 'a {{1}} b {{2}}', blanks: [{ answer: 'x' }, {}] }]
    })
    expect(reasonsOf(text)).toEqual(['cloze-missing-answer'])
  })

  it('完形填空的答案个数与空数不符 → 跳过', () => {
    const text = json({
      questions: [{ type: 'cloze', passage: 'a {{1}} b {{2}}', answers: ['only-one'] }]
    })
    expect(reasonsOf(text)).toEqual(['cloze-missing-answer'])
  })
})

describe('题型冲突与未知题型', () => {
  it('声明单选但有多个正确答案 → 跳过（宁可跳过也不改题型）', () => {
    const text = json({
      questions: [
        {
          type: 'single-choice',
          question: 'q',
          choices: [
            { content: 'A', correct: true },
            { content: 'B', correct: true }
          ]
        }
      ]
    })
    expect(reasonsOf(text)).toEqual(['conflicting-type'])
  })

  it('声明为选择题却没有选项数组 → 跳过', () => {
    const text = json({ questions: [{ type: 'single-choice', question: 'q' }] })
    expect(reasonsOf(text)).toEqual(['malformed-item'])
  })

  it('未知 type → 跳过', () => {
    const text = json({ questions: [{ type: 'essay', question: 'q' }] })
    expect(reasonsOf(text)).toEqual(['unknown-type'])
  })

  it('声明单选但段落里有 {{n}} 标记 → 冲突跳过', () => {
    const text = json({
      questions: [{ type: 'single-choice', passage: 'a {{1}} b', choices: ['x', 'y'] }]
    })
    expect(reasonsOf(text)).toEqual(['conflicting-type'])
  })

  it('声明完形填空但没有标记 → 跳过', () => {
    const text = json({
      questions: [{ type: 'cloze', passage: 'no markers here', answers: ['x'] }]
    })
    expect(reasonsOf(text)).toEqual(['cloze-marker-mismatch'])
  })

  it('标记缺号（{{1}} {{3}}）→ 跳过', () => {
    const text = json({
      questions: [{ type: 'cloze', passage: 'a {{1}} b {{3}}', answers: ['x', 'y'] }]
    })
    expect(reasonsOf(text)).toEqual(['cloze-marker-mismatch'])
  })

  it('标记重复（{{1}} {{1}}）→ 跳过', () => {
    const text = json({
      questions: [{ type: 'cloze', passage: 'a {{1}} b {{1}}', answers: ['x', 'y'] }]
    })
    expect(reasonsOf(text)).toEqual(['cloze-marker-mismatch'])
  })

  it('标记出现顺序与编号不一致但连续的 → 允许（空按编号对应，与出现顺序无关）', () => {
    const text = json({
      questions: [
        {
          type: 'cloze',
          passage: 'first {{1}} third {{3}} second {{2}}',
          answers: ['A1', 'A2', 'A3']
        }
      ]
    })
    const report = parseQuizText(text)
    expect(report.skipped).toHaveLength(0)
    const cloze = report.accepted[0] as ClozeItem
    expect(cloze.blanks.map((b) => [b.index, b.answer])).toEqual([
      [1, 'A1'],
      [2, 'A2'],
      [3, 'A3']
    ])
  })
})

describe('题型别名与泛化类型', () => {
  it('大小写 / 下划线 / 中文别名都能归一化', () => {
    const text = json({
      questions: [
        { type: 'SINGLE_CHOICE', question: 'a', choices: ['x', 'y'], answer: 'A' },
        { type: 'Multiple Choice', question: 'b', choices: ['x', 'y'], answer: 'A' },
        { type: 'TRUE-FALSE', question: 'c', answer: true },
        { type: '判断题', question: 'd', answer: false },
        { type: '完形填空', passage: 'p {{1}}', answers: ['x'] }
      ]
    })
    const report = parseQuizText(text)
    expect(report.skipped).toHaveLength(0)
    expect(kindsOf(report.accepted)).toEqual([
      'choice',
      'choice',
      'true-false',
      'true-false',
      'cloze'
    ])
  })

  it('泛化类型（选择题 / choice）按正确答案个数推断单/多选', () => {
    const genericMulti = json({
      questions: [
        {
          type: '选择题',
          question: 'q',
          choices: [
            { content: 'A', correct: true },
            { content: 'B', correct: true },
            { content: 'C', correct: false }
          ]
        }
      ]
    })
    const report = parseQuizText(genericMulti)
    expect((report.accepted[0] as ChoiceItem).mode).toBe('multi')
  })

  it('multiple_choice + 单个答案 → 单选（我们的标准里 multiple_choice 就是四选一）', () => {
    const text = json({
      questions: [
        {
          type: 'multiple-choice',
          question: 'q',
          choices: [
            { content: 'A', correct: true },
            { content: 'B', correct: false }
          ]
        }
      ]
    })
    const report = parseQuizText(text)
    expect(report.skipped).toHaveLength(0)
    expect((report.accepted[0] as ChoiceItem).mode).toBe('single')
  })

  it('明确声明 multi / multi-select → 仍然多选', () => {
    for (const type of ['multi', 'multi-select']) {
      const text = json({
        questions: [
          {
            type,
            question: 'q',
            choices: [
              { content: 'A', correct: true },
              { content: 'B', correct: false }
            ]
          }
        ]
      })
      const report = parseQuizText(text)
      expect(report.skipped, type).toHaveLength(0)
      expect((report.accepted[0] as ChoiceItem).mode, type).toBe('multi')
    }
  })
})

describe('其它兼容形状', () => {
  it('没有 type 但有布尔 answer → 判断题', () => {
    const text = json({ questions: [{ question: 'q', answer: true }] })
    const report = parseQuizText(text)
    expect(report.accepted[0]).toMatchObject({ kind: 'true-false', answer: true })
  })

  it('correct 别名的字符串 "true" 也认', () => {
    const text = json({
      questions: [
        {
          question: 'q',
          choices: [
            { content: 'A', is_correct: 'true' },
            { content: 'B', is_correct: 'false' }
          ]
        }
      ]
    })
    const item = firstChoice(text)
    expect(item.options.map((o) => o.correct)).toEqual([true, false])
  })

  it('answer 用选项原文精确匹配（忽略大小写与多余空白）', () => {
    const text = json({
      questions: [{ question: 'q', choices: ['Went', 'Go'], answer: '  went ' }]
    })
    expect(firstChoice(text).options.map((o) => o.correct)).toEqual([true, false])
  })

  it('完形填空答案可以是 { "1": ..., "2": ... } 映射', () => {
    const text = json({
      questions: [{ type: 'cloze', passage: 'a {{1}} b {{2}}', answers: { '1': 'x', '2': 'y' } }]
    })
    const report = parseQuizText(text)
    const cloze = report.accepted[0] as ClozeItem
    expect(cloze.blanks.map((b) => b.answer)).toEqual(['x', 'y'])
  })

  it('完形填空每个空可以带词库选项', () => {
    const text = json({
      questions: [
        {
          type: 'cloze',
          passage: 'I {{1}} home.',
          blanks: [{ answer: 'went', choices: ['went', 'go', 'gone'] }]
        }
      ]
    })
    const cloze = parseQuizText(text).accepted[0] as ClozeItem
    expect(cloze.blanks[0]?.choices).toEqual(['went', 'go', 'gone'])
  })

  it('整个文件只有一条题（顶层对象即题目）', () => {
    const text = json({ question: 'only', choices: ['a', 'b'], answer: 'b' })
    const report = parseQuizText(text)
    expect(report.accepted).toHaveLength(1)
    expect(firstChoice(text).options.map((o) => o.correct)).toEqual([false, true])
  })

  it('顶层是数组', () => {
    const text = json([{ question: 'q', choices: ['a', 'b'], answer: 'A' }])
    expect(parseQuizText(text).accepted).toHaveLength(1)
  })

  it('围栏 / 前言 / 后语包裹的 JSON 同样可用', () => {
    const inner = json({
      title: 'T',
      questions: [{ question: 'q', choices: ['a', 'b'], answer: 'A' }]
    })
    const text = `好的，这是题目：\n\`\`\`json\n${inner}\n\`\`\`\n希望能帮到你。`
    const report = parseQuizText(text)
    expect(report.title).toBe('T')
    expect(report.accepted).toHaveLength(1)
  })
})

describe('整体失败（fatal）只在文件级问题上发生', () => {
  it('JSON 语法错 → fatal invalid-json，且没有任何逐条结果', () => {
    const report = parseQuizText('{"questions":[{"question":')
    expect(report.fatal?.reason).toBe('invalid-json')
    expect(report.accepted).toHaveLength(0)
    expect(report.skipped).toHaveLength(0)
  })

  it('题目数组是空的 → fatal empty-items', () => {
    const report = parseQuizText(json({ title: 'T', questions: [] }))
    expect(report.fatal?.reason).toBe('empty-items')
  })

  it('找不到题目数组 → fatal no-items', () => {
    const report = parseQuizText(json({ title: 'T', foo: 1 }))
    expect(report.fatal?.reason).toBe('no-items')
  })

  it('顶层是字符串 → fatal not-an-object', () => {
    const report = parseQuizText('"nope"')
    expect(report.fatal?.reason).toBe('not-an-object')
  })
})

describe('标准规则：完形填空的答案与空号', () => {
  const one = (blank: unknown) =>
    json({ items: [{ type: 'cloze', passage: 'a {{1}} b', blanks: [blank] }] })
  const two = (blanks: unknown) =>
    json({ items: [{ type: 'cloze', passage: 'a {{1}} b {{2}}', blanks }] })

  it('answer 是 1-based index → 取该空选项文本（模型结构不变）', () => {
    const item = parseQuizText(one({ number: 1, options: ['went', 'go', 'goes'], answer: 2 }))
      .accepted[0] as ClozeItem
    expect(item.blanks[0]?.answer).toBe('go')
    expect(item.blanks[0]?.choices).toEqual(['went', 'go', 'goes'])
  })

  it('answer 越界 / 0 / 非整数 → 跳过', () => {
    expect(reasonsOf(one({ number: 1, options: ['a', 'b'], answer: 3 }))).toEqual([
      'missing-answer-key'
    ])
    expect(reasonsOf(one({ number: 1, options: ['a', 'b'], answer: 0 }))).toEqual([
      'missing-answer-key'
    ])
    expect(reasonsOf(one({ number: 1, options: ['a', 'b'], answer: 1.5 }))).toEqual([
      'missing-answer-key'
    ])
  })

  it('answer 是索引但没有词库 → 跳过（无法确定答案）', () => {
    expect(reasonsOf(one({ number: 1, answer: 1 }))).toEqual(['missing-answer-key'])
  })

  it('字符串答案在有词库且是纯数字时同样按索引解释', () => {
    const item = parseQuizText(one({ number: 1, options: ['went', 'go'], answer: '2' }))
      .accepted[0] as ClozeItem
    expect(item.blanks[0]?.answer).toBe('go')
  })

  it('字符串答案 + 词库但不是数字 → 当作自由填空的文本', () => {
    const item = parseQuizText(one({ number: 1, options: ['went', 'go'], answer: 'went' }))
      .accepted[0] as ClozeItem
    expect(item.blanks[0]?.answer).toBe('went')
  })

  it('number 可以乱序：按 number 对应空，而不是数组顺序', () => {
    const text = two([
      { number: 2, answer: 'SECOND' },
      { number: 1, answer: 'FIRST' }
    ])
    const item = parseQuizText(text).accepted[0] as ClozeItem
    expect(item.blanks.map((b) => [b.index, b.answer])).toEqual([
      [1, 'FIRST'],
      [2, 'SECOND']
    ])
  })

  it('number 重复 / 越界 / 非法 → 跳过', () => {
    expect(
      reasonsOf(
        two([
          { number: 1, answer: 'x' },
          { number: 1, answer: 'y' }
        ])
      )
    ).toEqual(['cloze-marker-mismatch'])
    expect(
      reasonsOf(
        two([
          { number: 1, answer: 'x' },
          { number: 5, answer: 'y' }
        ])
      )
    ).toEqual(['cloze-marker-mismatch'])
    expect(
      reasonsOf(
        two([
          { number: 'x', answer: 'x' },
          { number: 2, answer: 'y' }
        ])
      )
    ).toEqual(['cloze-marker-mismatch'])
  })

  it('number 混用（部分有、部分没有）→ 跳过', () => {
    const text = two([{ number: 1, answer: 'x' }, { answer: 'y' }])
    expect(reasonsOf(text)).toEqual(['cloze-marker-mismatch'])
  })

  it('没有 number 时退回数组顺序', () => {
    const text = json({
      items: [{ type: 'cloze', passage: 'a {{1}} b {{2}}', answers: ['x', 'y'] }]
    })
    const item = parseQuizText(text).accepted[0] as ClozeItem
    expect(item.blanks.map((b) => [b.index, b.answer])).toEqual([
      [1, 'x'],
      [2, 'y']
    ])
  })
})

describe('标准规则：multiple_choice 的单/多由答案形状决定', () => {
  const mc = (answer: unknown) =>
    json({
      items: [{ type: 'multiple_choice', question: 'q', options: ['A', 'B', 'C', 'D'], answer }]
    })

  it('单个数字 answer → single', () => {
    const item = parseQuizText(mc(1)).accepted[0] as ChoiceItem
    expect(item.mode).toBe('single')
    expect(item.options.map((o) => o.correct)).toEqual([true, false, false, false])
  })

  it('数组 answer → multi', () => {
    const item = parseQuizText(mc([1, 3])).accepted[0] as ChoiceItem
    expect(item.mode).toBe('multi')
    expect(item.options.map((o) => o.correct)).toEqual([true, false, true, false])
  })

  it('数组 answer 里有越界 / 无法对应的元素 → 整条跳过', () => {
    expect(reasonsOf(mc([1, 9]))).toEqual(['missing-answer-key'])
    expect(reasonsOf(mc([1, 'ZZ']))).toEqual(['missing-answer-key'])
  })

  it('空数组 answer → 跳过', () => {
    expect(reasonsOf(mc([]))).toEqual(['missing-answer-key'])
  })

  it('字母数组 answer 也支持', () => {
    const item = parseQuizText(mc(['A', 'C'])).accepted[0] as ChoiceItem
    expect(item.options.map((o) => o.correct)).toEqual([true, false, true, false])
  })
})

describe('标准规则：explanation 保留', () => {
  it('三种题型的 explanation 都保留（含完形填空每个空）', () => {
    const text = json({
      items: [
        {
          type: 'multiple_choice',
          question: 'q',
          options: ['A', 'B'],
          answer: 1,
          explanation: '选择题讲解'
        },
        { type: 'true_false', statement: 's', answer: true, explanation: '判断题讲解' },
        {
          type: 'cloze',
          passage: 'a {{1}}',
          blanks: [{ number: 1, answer: 'x', explanation: '空的讲解' }],
          explanation: '整篇讲解'
        }
      ]
    })
    const [choice, trueFalse, cloze] = parseQuizText(text).accepted as [
      ChoiceItem,
      TrueFalseItem,
      ClozeItem
    ]
    expect(choice.explanation).toBe('选择题讲解')
    expect(trueFalse.explanation).toBe('判断题讲解')
    expect(cloze.explanation).toBe('整篇讲解')
    expect(cloze.blanks[0]?.explanation).toBe('空的讲解')
  })

  it('explanation 缺失时是 null，且不影响导入', () => {
    const text = json({
      items: [
        { type: 'multiple_choice', question: 'q', options: ['A', 'B'], answer: 1 },
        { type: 'true_false', statement: 's', answer: false },
        { type: 'cloze', passage: 'a {{1}}', blanks: [{ number: 1, answer: 'x' }] }
      ]
    })
    const report = parseQuizText(text)
    expect(report.skipped).toHaveLength(0)
    const [choice, trueFalse, cloze] = report.accepted as [ChoiceItem, TrueFalseItem, ClozeItem]
    expect(choice.explanation).toBeNull()
    expect(trueFalse.explanation).toBeNull()
    expect(cloze.explanation).toBeNull()
    expect(cloze.blanks[0]?.explanation).toBeNull()
  })
})
