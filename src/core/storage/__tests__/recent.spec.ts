import { describe, expect, it } from 'vitest'
import { SLOT_KEYS, createStorage } from '../local'
import {
  MAX_RAW_BYTES,
  RECENT_LIMIT,
  byteLength,
  contentHash,
  loadRecent,
  readCounts,
  saveRecent,
  type RecentInput
} from '../recent'
import { createCapacityFake, createFake, createQuotaFake } from './fake-storage'

const QUIZ_KEY = SLOT_KEYS.recentQuiz
const VOCAB_KEY = SLOT_KEYS.recentVocab

function setup(initial: Record<string, string> = {}) {
  const fake = createFake(initial)
  return { fake, store: createStorage(fake) }
}

function input(raw: string, extra: Partial<RecentInput> = {}): RecentInput {
  return {
    raw,
    title: 'T',
    filename: 'sample.json',
    counts: { accepted: 3, skipped: 1 },
    importedAt: 1000,
    ...extra
  }
}

describe('内容哈希与体积', () => {
  it('同内容同哈希，不同内容不同哈希', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'))
    expect(contentHash('abc')).not.toBe(contentHash('abd'))
    expect(contentHash('abc')).toHaveLength(8)
  })

  it('byteLength 按 UTF-8 字节算', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('中')).toBe(3)
  })
})

describe('读写一条导入记录', () => {
  it('元数据完整、原始文本原样保存', () => {
    const { store } = setup()
    const raw = '{\n  "title": "中文 · 换行 \\" 引号"\n}'

    const result = saveRecent(store, 'quiz', input(raw, { title: 'Lesson 01', filename: null }))
    expect(result.ok).toBe(true)

    const snapshot = loadRecent(store, 'quiz')
    expect(snapshot.status).toBe('ok')
    expect(snapshot.entries).toHaveLength(1)
    expect(snapshot.entries[0]).toMatchObject({
      title: 'Lesson 01',
      filename: null,
      importedAt: 1000,
      counts: { accepted: 3, skipped: 1 },
      raw
    })
    expect(snapshot.entries[0]?.id).toBe(contentHash(raw))
  })

  it('没有记录 → missing', () => {
    const { store } = setup()
    expect(loadRecent(store, 'quiz')).toEqual({ status: 'missing', entries: [], detail: null })
  })

  it('quiz 与 vocab 各自独立', () => {
    const { fake, store } = setup()
    saveRecent(store, 'quiz', input('quiz-raw'))
    saveRecent(store, 'vocab', input('vocab-raw'))

    expect(loadRecent(store, 'quiz').entries[0]?.raw).toBe('quiz-raw')
    expect(loadRecent(store, 'vocab').entries[0]?.raw).toBe('vocab-raw')
    expect(fake.dump()[QUIZ_KEY]).toBeDefined()
    expect(fake.dump()[VOCAB_KEY]).toBeDefined()
  })
})

describe('上限 5 条：第 6 条淘汰最旧', () => {
  it('最多保留 5 条，最新的在最前', () => {
    const { store } = setup()
    for (let i = 1; i <= 6; i += 1) {
      saveRecent(store, 'quiz', input(`raw-${i}`, { importedAt: i }))
    }

    const entries = loadRecent(store, 'quiz').entries
    expect(entries).toHaveLength(RECENT_LIMIT)
    expect(entries.map((e) => e.raw)).toEqual(['raw-6', 'raw-5', 'raw-4', 'raw-3', 'raw-2'])
    expect(entries.some((e) => e.raw === 'raw-1')).toBe(false)
  })

  it('同一份内容重复导入不产生第二条，而是移到最前并刷新时间', () => {
    const { store } = setup()
    saveRecent(store, 'quiz', input('same', { title: '第一次', importedAt: 1 }))
    saveRecent(store, 'quiz', input('other', { importedAt: 2 }))
    const result = saveRecent(store, 'quiz', input('same', { title: '第二次', importedAt: 3 }))

    expect(result.ok).toBe(true)
    const entries = loadRecent(store, 'quiz').entries
    expect(entries).toHaveLength(2)
    expect(entries[0]?.raw).toBe('same')
    expect(entries[0]?.title).toBe('第二次')
    expect(entries[0]?.importedAt).toBe(3)
  })
})

describe('体积上限', () => {
  it('超过单条上限 → 拒绝记录，磁盘不变，导入本身不受影响', () => {
    const { fake, store } = setup()
    const before = fake.dump()

    const result = saveRecent(store, 'quiz', input('x'.repeat(MAX_RAW_BYTES + 1)))

    expect(result).toMatchObject({ ok: false, reason: 'too-large' })
    expect(fake.dump()).toEqual(before)
    expect(loadRecent(store, 'quiz').status).toBe('missing')
  })
})

describe('配额不足时的退让与放弃', () => {
  it('首次写入超限时再退让一条重试，成功但少留一条', () => {
    const fake = createCapacityFake(4)
    const store = createStorage(fake)

    for (let i = 1; i <= 5; i += 1) {
      saveRecent(store, 'quiz', input(`raw-${i}`, { importedAt: i }))
    }
    const entries = loadRecent(store, 'quiz').entries

    expect(entries).toHaveLength(4)
    expect(entries.map((e) => e.raw)).toEqual(['raw-5', 'raw-4', 'raw-3', 'raw-2'])
  })

  it('怎么都写不进 → 返回配额失败，磁盘保持原样（本次导入照常可用）', () => {
    const fake = createQuotaFake(60)
    const store = createStorage(fake)
    const before = fake.dump()

    const result = saveRecent(store, 'quiz', input('x'.repeat(300)))

    expect(result).toMatchObject({ ok: false, reason: 'quota' })
    expect(fake.dump()).toEqual(before)
  })
})

describe('损坏与版本', () => {
  it('读取损坏的记录不改盘，且此时仍允许写入（避免"最近导入"永久失效）', () => {
    const raw = '{broken'
    const { fake, store } = setup({ [QUIZ_KEY]: raw })

    const snapshot = loadRecent(store, 'quiz')
    expect(snapshot.status).toBe('corrupt')
    expect(fake.dump()[QUIZ_KEY]).toBe(raw)

    const result = saveRecent(store, 'quiz', input('after-corrupt'))
    expect(result.ok).toBe(true)
    expect(loadRecent(store, 'quiz').entries).toHaveLength(1)
  })

  it('未来版本 → 拒绝写入，原值不变', () => {
    const raw = JSON.stringify({ v: 2, entries: [] })
    const { fake, store } = setup({ [QUIZ_KEY]: raw })

    expect(loadRecent(store, 'quiz').status).toBe('future')
    const result = saveRecent(store, 'quiz', input('mine'))

    expect(result).toMatchObject({ ok: false, reason: 'readonly' })
    expect(fake.dump()[QUIZ_KEY]).toBe(raw)
  })

  it('非法条目被忽略（不改盘），合法条目照常可用', () => {
    const good = {
      id: 'abc',
      title: 't',
      filename: null,
      importedAt: 1,
      counts: { accepted: 1, skipped: 0 },
      raw: '{}'
    }
    const bad = { id: 'x', raw: 42 }
    const raw = JSON.stringify({ v: 1, entries: [bad, good] })
    const { fake, store } = setup({ [QUIZ_KEY]: raw })

    const snapshot = loadRecent(store, 'quiz')
    expect(snapshot.status).toBe('ok')
    expect(snapshot.entries).toHaveLength(1)
    expect(fake.dump()[QUIZ_KEY]).toBe(raw)
  })

  it('counts 缺失时按 0 计（只影响列表显示）', () => {
    const { store } = setup({
      [QUIZ_KEY]: JSON.stringify({
        v: 1,
        entries: [{ id: 'a', title: 't', filename: null, importedAt: 1, raw: '{}' }]
      })
    })
    const entry = loadRecent(store, 'quiz').entries[0]
    expect(entry).toBeDefined()
    if (entry !== undefined) expect(readCounts(entry)).toEqual({ accepted: 0, skipped: 0 })
  })
})
