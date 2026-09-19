/**
 * Import 层测试：粘贴 / 文件 / 盘外文字 / 部分损坏 / 确认 → 最近导入 → 重新打开。
 *
 * 这里走的是真实的 parser 与真实的 storage 代码（只把 localStorage 换成假后端），
 * 所以它验证的是「接线」而不是 mock 的行为。
 */
import { describe, expect, it } from 'vitest'
import { SLOT_KEYS, createStorage } from '@/core/storage/local'
import type { RecentImport } from '@/core/storage/recent'
import { createImportFlow } from '../useImportFlow'
import {
  createFake,
  createQuotaFake,
  type FakeStorage
} from '@/core/storage/__tests__/fake-storage'

const QUIZ_KEY = SLOT_KEYS.recentQuiz
const VOCAB_KEY = SLOT_KEYS.recentVocab

const json = (value: unknown) => JSON.stringify(value)

function setup(options: { initial?: Record<string, string>; quota?: number } = {}) {
  const fake: FakeStorage =
    options.quota === undefined ? createFake(options.initial ?? {}) : createQuotaFake(options.quota)
  const store = createStorage(fake)
  const changed: string[] = []
  const flow = createImportFlow({
    store,
    now: () => 1_700_000_000_000,
    onRecentChanged: (kind) => changed.push(kind)
  })
  return { fake, store, flow, changed }
}

function recentEntries(fake: FakeStorage, key: string): RecentImport[] {
  const raw = fake.dump()[key]
  if (raw === undefined) return []
  return (JSON.parse(raw) as { entries: RecentImport[] }).entries
}

const ONE_QUIZ = json({
  title: '第一份',
  questions: [{ question: 'q1', choices: ['A', 'B'], answer: 'A' }]
})

const TWO_QUIZ = json({
  title: '第二份',
  questions: [
    { question: 'q1', choices: ['A', 'B'], answer: 'A' },
    { question: 'q2', answer: true }
  ]
})

const VOCAB = json({
  title: 'Lesson 01',
  items: [
    { word: 'confidence', translation: '信心' },
    { word: 'private', translation: '私人的' }
  ]
})

describe('粘贴 JSON', () => {
  it('解析后给出报告，内容还不落盘', () => {
    const { fake, flow } = setup()

    const doc = flow.parse('quiz', ONE_QUIZ, null)

    expect(doc.kind).toBe('quiz')
    if (doc.kind !== 'quiz') return
    expect(doc.report.accepted).toHaveLength(1)
    expect(doc.report.skipped).toHaveLength(0)
    expect(flow.pending.value).toBe(doc)
    expect(fake.dump()[QUIZ_KEY]).toBeUndefined()
  })

  it('确认后才写入最近导入，并且存的是原始文本（不是解析后的模型）', () => {
    const { fake, flow, changed } = setup()
    flow.parse('quiz', ONE_QUIZ, null)

    const outcome = flow.confirm()

    expect(outcome).toEqual({ ok: true, kind: 'quiz', notice: null })
    expect(changed).toEqual(['quiz'])
    expect(flow.pending.value).toBeNull()

    const entries = recentEntries(fake, QUIZ_KEY)
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry?.raw).toBe(ONE_QUIZ)
    expect(entry?.title).toBe('第一份')
    expect(entry?.filename).toBeNull()
    expect(entry?.counts).toEqual({ accepted: 1, skipped: 0 })
    expect(entry?.importedAt).toBe(1_700_000_000_000)

    // 磁盘上只有元数据 + 原始文本，没有任何解析后的模型字段
    expect(Object.keys(entry ?? {}).sort()).toEqual(
      ['counts', 'filename', 'id', 'importedAt', 'raw', 'title'].sort()
    )
  })

  it('JSON 前后夹带解释文字 / 代码围栏也能导入', () => {
    const { flow } = setup()
    const text = `好的，这是题目：\n\`\`\`json\n${ONE_QUIZ}\n\`\`\`\n希望对你有帮助。`

    const doc = flow.parse('quiz', text, null)

    expect(doc.report.fatal).toBeNull()
    expect(doc.report.accepted).toHaveLength(1)
    expect(doc.raw).toBe(text) // 原始文本原样保留，包括前后那段话
  })

  it('部分条目损坏时：能识别的照常导入，并在报告里逐条说明', () => {
    const { flow } = setup()
    const text = json({
      title: '混合',
      questions: [
        { question: '正常题', choices: ['A', 'B'], answer: 'A' },
        { question: '没有答案', choices: [{ content: 'A' }, { content: 'B' }] },
        { type: 'essay', question: '未知题型' }
      ]
    })

    const doc = flow.parse('quiz', text, null)

    expect(doc.report.accepted).toHaveLength(1)
    expect(doc.report.skipped).toHaveLength(2)
    expect(doc.report.skipped.map((s) => s.reason)).toEqual(['missing-answer-key', 'unknown-type'])
    expect(doc.report.skipped.map((s) => s.index)).toEqual([1, 2])
  })

  it('一条都识别不出来时不允许确认，也不会写最近导入', () => {
    const { fake, flow } = setup()
    flow.parse('quiz', json({ questions: [{ type: 'essay', question: 'x' }] }), null)

    const outcome = flow.confirm()

    expect(outcome.ok).toBe(false)
    expect(outcome.notice).toContain('没有可导入的内容')
    expect(fake.dump()[QUIZ_KEY]).toBeUndefined()
    expect(flow.pending.value).not.toBeNull() // 报告仍然在，用户能看到原因
  })

  it('整个文件语法错 → fatal，不能确认', () => {
    const { fake, flow } = setup()
    const doc = flow.parse('quiz', '{"questions":[', null)

    expect(doc.report.fatal?.reason).toBe('invalid-json')
    expect(flow.confirm().ok).toBe(false)
    expect(fake.dump()[QUIZ_KEY]).toBeUndefined()
  })
})

describe('文件与拖拽（共用同一条链路）', () => {
  it('文件名会被记录，并在重新打开时取回', () => {
    const { fake, flow } = setup()
    flow.parse('quiz', ONE_QUIZ, 'my-quiz.json')
    flow.confirm()

    expect(recentEntries(fake, QUIZ_KEY)[0]?.filename).toBe('my-quiz.json')
  })
})

describe('最近导入：重新打开时用 raw 重新 parse', () => {
  const baseEntry: RecentImport = {
    id: 'fixed',
    title: '旧标题',
    filename: 'old.json',
    importedAt: 1,
    counts: { accepted: 1, skipped: 0 },
    raw: ONE_QUIZ
  }

  it('不保存解析模型：换掉 raw 里的内容，重新打开结果随之改变', () => {
    const { flow } = setup()

    const first = flow.openRecent('quiz', baseEntry)
    expect(first.report.accepted).toHaveLength(1)

    const second = flow.openRecent('quiz', { ...baseEntry, raw: TWO_QUIZ })
    expect(second.report.accepted).toHaveLength(2) // 1 → 2，证明是重新解析 raw
    expect(second.title).toBe('第二份') // 标题也来自重新解析
    expect(second.raw).toBe(TWO_QUIZ)
  })

  it('打开历史记录本身不写入任何东西', () => {
    const { fake, flow } = setup()
    const writesBefore = fake.stats.writes

    flow.openRecent('quiz', baseEntry)

    expect(fake.stats.writes).toBe(writesBefore)
    expect(fake.dump()[QUIZ_KEY]).toBeUndefined()
  })

  it('raw 里没有 title 时，退回用记录里的标题', () => {
    const { flow } = setup()
    const entry: RecentImport = {
      ...baseEntry,
      title: '记录里的标题',
      raw: json({ questions: [{ question: 'q', choices: ['A', 'B'], answer: 'A' }] })
    }

    expect(flow.openRecent('quiz', entry).title).toBe('记录里的标题')
  })
})

describe('写最近导入失败不影响本次导入', () => {
  it('配额不足 → 仍然可以进入学习，只给一条提示', () => {
    // 60 字节：够放可用性探测的探针，但放不下任何一条记录
    const { fake, flow, changed } = setup({ quota: 60 })
    flow.parse('quiz', ONE_QUIZ, null)

    const outcome = flow.confirm()

    expect(outcome.ok).toBe(true)
    expect(outcome.notice).toContain('最近导入')
    expect(flow.current.value).not.toBeNull()
    expect(flow.notice.value).not.toBeNull()
    expect(changed).toEqual([]) // 没写成功就不通知刷新
    expect(fake.dump()[QUIZ_KEY]).toBeUndefined()
  })
})

describe('两种类型各自独立', () => {
  it('词汇走词汇 parser，并写到 vocab 槽位', () => {
    const { fake, flow } = setup()
    const doc = flow.parse('vocab', VOCAB, 'lesson01.json')

    expect(doc.kind).toBe('vocab')
    if (doc.kind !== 'vocab') return
    expect(doc.report.accepted).toHaveLength(2)
    expect(doc.report.accepted[0]?.word).toBe('confidence')

    flow.confirm()

    expect(recentEntries(fake, VOCAB_KEY)).toHaveLength(1)
    expect(fake.dump()[QUIZ_KEY]).toBeUndefined()
  })

  it('做题与词汇互不覆盖，各自保留自己的记录', () => {
    const { fake, flow } = setup()
    flow.parse('quiz', ONE_QUIZ, null)
    flow.confirm()
    flow.parse('vocab', VOCAB, null)
    flow.confirm()

    expect(recentEntries(fake, QUIZ_KEY).map((e) => e.title)).toEqual(['第一份'])
    expect(recentEntries(fake, VOCAB_KEY).map((e) => e.title)).toEqual(['Lesson 01'])
  })

  it('把做题 JSON 当词汇导入 → 找不到词条，允许给出 fatal 报告', () => {
    const { flow } = setup()
    const doc = flow.parse('vocab', ONE_QUIZ, null)

    expect(doc.report.fatal?.reason).toBe('no-items')
    expect(flow.confirm().ok).toBe(false)
  })
})
