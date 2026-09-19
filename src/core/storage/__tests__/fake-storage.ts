/**
 * 测试替身：用内存实现 StorageBackend，并可以确定性地复现各种失败。
 */
import type { StorageBackend } from '../local'

export interface FakeStorage extends StorageBackend {
  dump(): Record<string, string>
  stats: { writes: number; failures: number }
}

export function quotaError(): Error {
  const error = new Error('Quota exceeded')
  error.name = 'QuotaExceededError'
  return error
}

export function createFake(initial: Record<string, string> = {}): FakeStorage {
  const map = new Map(Object.entries(initial))
  const stats = { writes: 0, failures: 0 }
  return {
    stats,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      stats.writes += 1
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
    dump: () => Object.fromEntries(map)
  }
}

/** 总容量受限：写入会让「所有 key + value 的字符数」超过 limitBytes 时抛配额错误 */
export function createQuotaFake(
  limitBytes: number,
  initial: Record<string, string> = {}
): FakeStorage {
  const map = new Map(Object.entries(initial))
  const stats = { writes: 0, failures: 0 }
  const totalSize = () => [...map.entries()].reduce((sum, [k, v]) => sum + k.length + v.length, 0)

  return {
    stats,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      stats.writes += 1
      const previous = map.get(key)
      if (previous !== undefined) map.delete(key)
      if (totalSize() + key.length + value.length > limitBytes) {
        if (previous !== undefined) map.set(key, previous)
        stats.failures += 1
        throw quotaError()
      }
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
    dump: () => Object.fromEntries(map)
  }
}

/**
 * 只放得下 N 条最近导入：写入的 entries 超过 N 条时抛配额错误。
 * 用来确定性地测试「淘汰最旧一条再重试」这条路径。
 */
export function createCapacityFake(
  maxEntries: number,
  initial: Record<string, string> = {}
): FakeStorage {
  const map = new Map(Object.entries(initial))
  const stats = { writes: 0, failures: 0 }

  return {
    stats,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      stats.writes += 1
      if (countEntries(value) > maxEntries) {
        stats.failures += 1
        throw quotaError()
      }
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
    dump: () => Object.fromEntries(map)
  }
}

function countEntries(serialized: string): number {
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (typeof parsed !== 'object' || parsed === null) return 0
    const entries = (parsed as { entries?: unknown }).entries
    return Array.isArray(entries) ? entries.length : 0
  } catch {
    return 0
  }
}

/** 从第 n 次 setItem 开始报一个普通错误（不叫 QuotaExceededError） */
export function createFailingFake(
  error: Error,
  failFromWrite: number,
  initial: Record<string, string> = {}
): FakeStorage {
  const map = new Map(Object.entries(initial))
  const stats = { writes: 0, failures: 0 }
  return {
    stats,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      stats.writes += 1
      if (stats.writes >= failFromWrite) {
        stats.failures += 1
        throw error
      }
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
    dump: () => Object.fromEntries(map)
  }
}

/** 存储被禁用：连可用性探测都会失败 */
export function createBrokenFake(): FakeStorage {
  const stats = { writes: 0, failures: 0 }
  const boom = () => {
    throw new Error('storage disabled')
  }
  return {
    stats,
    getItem: boom,
    setItem: boom,
    removeItem: boom,
    dump: () => ({})
  }
}
