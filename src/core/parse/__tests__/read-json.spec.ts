import { describe, expect, it } from 'vitest'
import { readJson } from '../read-json'

describe('readJson：文本 → JSON 值', () => {
  it('读普通对象', () => {
    const result = readJson('{"title":"t","questions":[]}')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ title: 't', questions: [] })
  })

  it('读顶层数组', () => {
    const result = readJson('[{"q":1}]')
    expect(result.ok).toBe(true)
    expect(Array.isArray(result.ok && result.value)).toBe(true)
  })

  it('剥掉 BOM 与首尾空白', () => {
    const result = readJson('\uFEFF\n  {"a":1}  \n')
    expect(result.ok).toBe(true)
  })

  it('剥掉 ```json 围栏', () => {
    const result = readJson('```json\n{"a":1}\n```')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ a: 1 })
  })

  it('剥掉无语言标记的围栏', () => {
    const result = readJson('```\n{"a":2}\n```')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ a: 2 })
  })

  it('JSON 前后带解释文字时取最外层结构', () => {
    const result = readJson('好的，这是你要的 JSON：\n{"a":3}\n希望有帮助！')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ a: 3 })
  })

  it('围栏 + 解释文字混在一起也能读', () => {
    const result = readJson('Here you go:\n```json\n{"a":4,"b":[1,2]}\n```\nEnjoy.')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual({ a: 4, b: [1, 2] })
  })

  it('空文本 → invalid-json', () => {
    const result = readJson('   \n  ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid-json')
  })

  it('语法错误 → invalid-json，并带上原始报错信息', () => {
    const result = readJson('{"a":1,}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-json')
      expect(result.detail.length).toBeGreaterThan(0)
    }
  })

  it('顶层是字符串 / 数字 / null → not-an-object（不是语法错）', () => {
    for (const text of ['"hello"', '42', 'null', 'true']) {
      const result = readJson(text)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('not-an-object')
    }
  })
})
