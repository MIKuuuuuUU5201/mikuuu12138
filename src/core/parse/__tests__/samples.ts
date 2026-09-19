import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** 读取 samples/ 下的样本文件（测试与样本要绑在一起，样本才是活的） */
export function readSample(name: string): string {
  const url = new URL(`../../../../samples/${name}`, import.meta.url)
  return readFileSync(fileURLToPath(url), 'utf-8')
}

/** 把对象序列化成 JSON 文本，方便内联构造用例 */
export function json(value: unknown): string {
  return JSON.stringify(value)
}
