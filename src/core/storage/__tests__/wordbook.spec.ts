import { describe, expect, it } from 'vitest'
import { SLOT_KEYS, createStorage } from '../local'
import {
  addWord,
  buildLookup,
  exportJson,
  hasWord,
  importWordbook,
  loadWordbook,
  normalizeDisplay,
  removeWord,
  saveWordbook,
  toggleWord,
  updateWordbook,
  validateImportText,
  wordKey
} from '../wordbook'
import { createFake, createQuotaFake } from './fake-storage'

const KEY = SLOT_KEYS.wordbook

function setup(initial: Record<string, string> = {}) {
  const fake = createFake(initial)
  return { fake, store: createStorage(fake) }
}

function storedWords(fake: ReturnType<typeof createFake>): string[] {
  const raw = fake.dump()[KEY]
  return raw === undefined ? [] : (JSON.parse(raw) as { words: string[] }).words
}

describe('归一化规则', () => {
  it('wordKey：trim + 连续空白折叠 + lowercase', () => {
    expect(wordKey('  Take   Off ')).toBe('take off')
    expect(wordKey('In\tmy\nopinion')).toBe('in my opinion')
    expect(wordKey('Confidence')).toBe('confidence')
  })

  it('入库形态只做 trim + 空白折叠，保留大小写', () => {
    expect(normalizeDisplay('  In   my opinion ')).toBe('In my opinion')
  })
})

describe('增删：最新在前，按 wordKey 去重', () => {
  it('加入后最新的排在最前', () => {
    let words: string[] = []
    words = addWord(words, 'alpha')
    words = addWord(words, 'beta')
    expect(words).toEqual(['beta', 'alpha'])
  })

  it('大小写不同视为同一个词，且保留最先录入的写法', () => {
    const words = ['Confidence']
    const next = addWord(words, 'confidence')
    expect(next).toBe(words) // 没有变化，返回同一个引用
    expect(next).toEqual(['Confidence'])
  })

  it('空白差异同样视为同一个词', () => {
    const words = ['in my opinion']
    expect(addWord(words, '  in   my   opinion ')).toBe(words)
  })

  it('空白输入不产生条目', () => {
    const words = ['a']
    expect(addWord(words, '   ')).toBe(words)
  })

  it('删除存在的词 / 不存在的词', () => {
    expect(removeWord(['a', 'b'], 'A')).toEqual(['b'])
    const words = ['a']
    expect(removeWord(words, 'zzz')).toBe(words)
  })

  it('toggle：加入与移除', () => {
    const empty: string[] = []
    const added = toggleWord(empty, 'word')
    expect(added).toEqual({ words: ['word'], added: true })
    const removed = toggleWord(added.words, 'WORD')
    expect(removed).toEqual({ words: [], added: false })
  })

  it('hasWord / buildLookup 与去重规则一致', () => {
    const words = ['Take Off', 'confidence']
    expect(hasWord(words, '  take   off ')).toBe(true)
    expect(hasWord(words, 'missing')).toBe(false)
    expect(buildLookup(words).size).toBe(2)
  })
})

describe('导出', () => {
  it('导出我们自己的形状', () => {
    const json = exportJson(['a', 'b'])
    expect(JSON.parse(json)).toEqual({ type: 'wordbook', version: 1, words: ['a', 'b'] })
  })

  it('导出 → 校验 → 往返一致（顺序保持）', () => {
    const words = ['Take Off', 'in my opinion', 'confidence']
    const validation = validateImportText(exportJson(words))
    expect(validation.ok).toBe(true)
    if (validation.ok) {
      expect(validation.words).toEqual(words)
      expect(validation.duplicates).toBe(0)
    }
  })
})

describe('导入校验：任何一条不合法就整体失败', () => {
  const wrap = (payload: unknown) => JSON.stringify(payload)

  it('空内容', () => {
    const result = validateImportText('   ')
    expect(result.ok).toBe(false)
  })

  it('不是合法 JSON', () => {
    const result = validateImportText('{oops')
    expect(result.ok).toBe(false)
  })

  it('顶层不是对象', () => {
    const result = validateImportText('["a"]')
    expect(result.ok).toBe(false)
  })

  it('type 标记不对', () => {
    const result = validateImportText(wrap({ version: 1, words: ['a'] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('wordbook')
  })

  it('version 非法', () => {
    expect(validateImportText(wrap({ type: 'wordbook', words: [] })).ok).toBe(false)
    expect(validateImportText(wrap({ type: 'wordbook', version: 0, words: [] })).ok).toBe(false)
    expect(validateImportText(wrap({ type: 'wordbook', version: 1.5, words: [] })).ok).toBe(false)
  })

  it('version 来自更新版本 → 拒绝', () => {
    const result = validateImportText(wrap({ type: 'wordbook', version: 2, words: ['a'] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('更新版本')
  })

  it('words 不是数组', () => {
    expect(validateImportText(wrap({ type: 'wordbook', version: 1, words: 'a' })).ok).toBe(false)
  })

  it('含非字符串项 / 空白项 → 报出下标', () => {
    const result = validateImportText(
      wrap({ type: 'wordbook', version: 1, words: ['ok', 42, '   ', null] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(3)
      expect(result.errors[0]).toContain('words[1]')
      expect(result.errors[1]).toContain('words[2]')
      expect(result.errors[2]).toContain('words[3]')
    }
  })

  it('文件内部重复：保留首次出现并计数', () => {
    const result = validateImportText(
      wrap({ type: 'wordbook', version: 1, words: ['Take Off', 'take  off', 'confidence'] })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.words).toEqual(['Take Off', 'confidence'])
      expect(result.duplicates).toBe(1)
    }
  })

  it('接受带 BOM 的文件', () => {
    const text = `\uFEFF${wrap({ type: 'wordbook', version: 1, words: ['a'] })}`
    expect(validateImportText(text).ok).toBe(true)
  })
})

describe('读取生词本', () => {
  it('没有数据 → missing', () => {
    const { store } = setup()
    expect(loadWordbook(store)).toEqual({ status: 'missing', words: [], detail: null })
  })

  it('写入后读回', () => {
    const { store } = setup()
    expect(saveWordbook(store, ['a', 'b'])).toEqual({ ok: true })
    expect(loadWordbook(store)).toEqual({ status: 'ok', words: ['a', 'b'], detail: null })
  })

  it('形状不对（words 不是字符串数组）→ corrupt，且不改盘', () => {
    const raw = JSON.stringify({ v: 1, words: [1, 2] })
    const { fake, store } = setup({ [KEY]: raw })
    expect(loadWordbook(store).status).toBe('corrupt')
    expect(fake.dump()[KEY]).toBe(raw)
  })

  it('未来版本 → future 且给出说明', () => {
    const { store } = setup({ [KEY]: JSON.stringify({ v: 2, words: ['a'] }) })
    const snapshot = loadWordbook(store)
    expect(snapshot.status).toBe('future')
    expect(snapshot.words).toEqual([])
    expect(snapshot.detail).toContain('更新版本')
  })
})

describe('唯一写入口 updateWordbook', () => {
  it('写盘前重新读取当前值，不会用过期副本覆盖（模拟两个标签页各加一个词）', () => {
    // 外部（另一个标签页）先写进了 external
    const { fake, store } = setup({ [KEY]: JSON.stringify({ v: 1, words: ['external'] }) })

    const outcome = updateWordbook(store, (words) => addWord(words, 'mine'))

    expect(outcome.result).toEqual({ ok: true })
    expect(outcome.words).toEqual(['mine', 'external'])
    expect(storedWords(fake)).toEqual(['mine', 'external'])
  })

  it('没有变化时不写盘', () => {
    const { fake, store } = setup()
    saveWordbook(store, ['a'])
    const writesBefore = fake.stats.writes

    updateWordbook(store, (words) => addWord(words, 'A'))
    expect(fake.stats.writes).toBe(writesBefore)
  })

  it('落盘失败（配额）→ 状态回滚为磁盘上的旧值，旧数据不变', () => {
    const fake = createQuotaFake(60)
    const store = createStorage(fake)
    // 探测已通过（60 字节放得下探针）；首次写入就超限
    const outcome = updateWordbook(store, (words) => addWord(words, 'x'.repeat(200)))

    expect(outcome.result).toMatchObject({ ok: false, reason: 'quota' })
    expect(outcome.words).toEqual([])
    expect(fake.dump()[KEY]).toBeUndefined()
  })

  it('数据损坏时拒绝增量修改，原值一个字节都不动', () => {
    const raw = 'not json at all'
    const { fake, store } = setup({ [KEY]: raw })
    const outcome = updateWordbook(store, (words) => addWord(words, 'mine'))

    expect(outcome.result).toMatchObject({ ok: false, reason: 'corrupt' })
    expect(fake.dump()[KEY]).toBe(raw)
  })

  it('未来版本时拒绝写入（只读锁定）', () => {
    const raw = JSON.stringify({ v: 2, words: ['a'] })
    const { fake, store } = setup({ [KEY]: raw })
    const outcome = updateWordbook(store, (words) => addWord(words, 'mine'))

    expect(outcome.result).toMatchObject({ ok: false, reason: 'readonly' })
    expect(fake.dump()[KEY]).toBe(raw)
  })
})

describe('导入生词本：先完整校验，再一次性整体覆盖', () => {
  const exportOf = (words: string[]) => exportJson(words)

  it('校验失败 → 旧生词本完全不变（磁盘与内存都不动）', () => {
    const { fake, store } = setup()
    saveWordbook(store, ['keep-me'])
    const before = fake.dump()

    const result = importWordbook(store, '{"type":"wordbook","version":1,"words":["ok",42]}')

    expect(result.ok).toBe(false)
    expect(fake.dump()).toEqual(before)
    expect(loadWordbook(store).words).toEqual(['keep-me'])
  })

  it('校验成功 → 整体覆盖（不是合并）', () => {
    const { fake, store } = setup()
    saveWordbook(store, ['old-1', 'old-2'])

    const result = importWordbook(store, exportOf(['new-1', 'new-2', 'new-3']))

    expect(result).toMatchObject({ ok: true, count: 3 })
    expect(loadWordbook(store).words).toEqual(['new-1', 'new-2', 'new-3'])
    expect(storedWords(fake)).toEqual(['new-1', 'new-2', 'new-3'])
  })

  it('导入到空生词本', () => {
    const { store } = setup()
    const result = importWordbook(store, exportOf(['a']))
    expect(result).toMatchObject({ ok: true, count: 1, duplicates: 0 })
  })

  it('写入失败 → 报错且旧数据不变', () => {
    const fake = createQuotaFake(120)
    const store = createStorage(fake)
    // 先塞进一条（小到能放）
    saveWordbook(store, ['a'])
    const before = fake.dump()

    const result = importWordbook(store, exportOf(['x'.repeat(500)]))

    expect(result.ok).toBe(false)
    expect(fake.dump()).toEqual(before)
  })

  it('未来版本时拒绝导入覆盖', () => {
    const raw = JSON.stringify({ v: 2, words: ['a'] })
    const { fake, store } = setup({ [KEY]: raw })
    const result = importWordbook(store, exportOf(['mine']))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('更新版本')
    expect(fake.dump()[KEY]).toBe(raw)
  })
})
