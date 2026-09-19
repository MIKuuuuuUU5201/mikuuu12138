import { describe, expect, it } from 'vitest'
import {
  NAMESPACE,
  SCHEMA_VERSION,
  SLOTS,
  SLOT_KEYS,
  createStorage,
  migrateValue,
  type Migration
} from '../local'
import { createBrokenFake, createFailingFake, createFake, createQuotaFake } from './fake-storage'

describe('命名空间与 key', () => {
  it('每个槽位的 key 都以 english-site. 开头（GitHub Pages 共享 origin，前缀必须够具体）', () => {
    for (const slot of SLOTS) {
      expect(SLOT_KEYS[slot].startsWith(NAMESPACE)).toBe(true)
    }
  })

  it('key 互不重复', () => {
    const keys = SLOTS.map((slot) => SLOT_KEYS[slot])
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('信封读写', () => {
  it('写入后读回的是 payload（不含 v），磁盘上带 v', () => {
    const fake = createFake()
    const store = createStorage(fake)

    expect(store.available).toBe(true)
    expect(store.read('wordbook')).toEqual({ status: 'missing' })
    expect(store.write('wordbook', { words: ['a', 'b'] })).toEqual({ ok: true })
    expect(store.read('wordbook')).toEqual({ status: 'ok', value: { words: ['a', 'b'] } })

    const onDisk = fake.dump()[SLOT_KEYS.wordbook]
    expect(onDisk).toBeDefined()
    expect(JSON.parse(onDisk as string)).toEqual({ v: SCHEMA_VERSION, words: ['a', 'b'] })
  })

  it('空字符串视为没有数据', () => {
    const fake = createFake({ [SLOT_KEYS.wordbook]: '' })
    expect(createStorage(fake).read('wordbook')).toEqual({ status: 'missing' })
  })

  it('存储不可用时退化为内存模式：available=false，但读写仍然可用（本次会话内有效）', () => {
    const store = createStorage(createBrokenFake())
    expect(store.available).toBe(false)
    expect(store.write('wordbook', { words: ['x'] })).toEqual({ ok: true })
    expect(store.read('wordbook')).toEqual({ status: 'ok', value: { words: ['x'] } })
  })

  it('backend 传 null 同样走内存模式', () => {
    const store = createStorage(null)
    expect(store.available).toBe(false)
    expect(store.read('wordbook')).toEqual({ status: 'missing' })
  })
})

describe('损坏的数据：读出状态，绝不改动原值', () => {
  it('不是 JSON → corrupt，磁盘原值不变', () => {
    const raw = 'this is not json'
    const fake = createFake({ [SLOT_KEYS.wordbook]: raw })
    const store = createStorage(fake)

    const result = store.read('wordbook')
    expect(result.status).toBe('corrupt')
    expect(fake.dump()[SLOT_KEYS.wordbook]).toBe(raw)
  })

  it('顶层不是对象 → corrupt', () => {
    const fake = createFake({ [SLOT_KEYS.wordbook]: '["a","b"]' })
    expect(createStorage(fake).read('wordbook').status).toBe('corrupt')
  })

  it('缺少版本号 v → corrupt', () => {
    const fake = createFake({ [SLOT_KEYS.wordbook]: JSON.stringify({ words: ['a'] }) })
    expect(createStorage(fake).read('wordbook').status).toBe('corrupt')
  })

  it('v 不是正整数 → corrupt', () => {
    for (const bad of ['1', 1.5, 0, -1, null]) {
      const fake = createFake({ [SLOT_KEYS.wordbook]: JSON.stringify({ v: bad, words: [] }) })
      expect(createStorage(fake).read('wordbook').status, String(bad)).toBe('corrupt')
    }
  })

  it('读取不会因为损坏而重置数据（读两次结果一致，磁盘不变）', () => {
    const raw = '{broken'
    const fake = createFake({ [SLOT_KEYS.wordbook]: raw })
    const store = createStorage(fake)
    store.read('wordbook')
    store.read('wordbook')
    expect(fake.dump()[SLOT_KEYS.wordbook]).toBe(raw)
  })
})

describe('版本高于当前：只读锁定', () => {
  it('v > 当前版本 → status future，并带上对方的版本号', () => {
    const raw = JSON.stringify({ v: SCHEMA_VERSION + 1, words: ['x'] })
    const fake = createFake({ [SLOT_KEYS.wordbook]: raw })
    const result = createStorage(fake).read('wordbook')

    expect(result).toEqual({ status: 'future', version: SCHEMA_VERSION + 1 })
    expect(fake.dump()[SLOT_KEYS.wordbook]).toBe(raw)
  })

  it('读取未来版本不会顺手写回任何东西', () => {
    const fake = createFake({ [SLOT_KEYS.recentQuiz]: JSON.stringify({ v: 9, entries: [] }) })
    const store = createStorage(fake)
    store.read('recentQuiz')
    expect(fake.stats.writes).toBeLessThanOrEqual(1) // 只有可用性探测那一次
    expect(JSON.parse(fake.dump()[SLOT_KEYS.recentQuiz] as string).v).toBe(9)
  })
})

describe('迁移机制（纯函数）', () => {
  const step1: Migration = (envelope) => ({ ...envelope, v: 2, migratedFrom1: true })
  const step2: Migration = (envelope) => ({ ...envelope, v: 3, migratedFrom2: true })
  const table: Record<number, Migration> = { 1: step1, 2: step2 }

  it('缺少迁移函数 → 失败（调用方据此判定不可读，不改写原值）', () => {
    const result = migrateValue({ v: 1, words: [] }, 1, {}, 2)
    expect(result.ok).toBe(false)
  })

  it('链式迁移 1 → 3', () => {
    const result = migrateValue({ v: 1, words: ['a'] }, 1, table, 3)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ v: 3, words: ['a'], migratedFrom1: true, migratedFrom2: true })
    }
  })

  it('某一步返回 null → 失败', () => {
    const tableWithNull: Record<number, Migration> = { 1: () => null }
    expect(migrateValue({ v: 1 }, 1, tableWithNull, 2).ok).toBe(false)
  })

  it('已经是最新版本时不需要迁移', () => {
    const result = migrateValue({ v: 3, words: [] }, 3, table, 3)
    expect(result.ok).toBe(true)
  })

  it('信封不是对象 → 失败', () => {
    expect(migrateValue('nope', 1, table, 2).ok).toBe(false)
  })
})

describe('写入失败归类', () => {
  it('QuotaExceededError → quota', () => {
    const fake = createQuotaFake(60)
    const store = createStorage(fake)
    expect(store.available).toBe(true) // 探测那点字节放得下
    const result = store.write('wordbook', { words: ['x'.repeat(200)] })
    expect(result).toMatchObject({ ok: false, reason: 'quota' })
  })

  it('其它异常 → unknown', () => {
    const fake = createFailingFake(new Error('boom'), 2)
    const store = createStorage(fake)
    const result = store.write('wordbook', { words: ['x'] })
    expect(result).toMatchObject({ ok: false, reason: 'unknown' })
  })
})
