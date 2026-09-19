/**
 * 解析层的失败归类。
 *
 * 分两类，因为它们对用户的意义完全不同：
 *  - FatalReason：整个文件不可用（JSON 语法错、骨架都认不出）
 *  - SkipReason：只有某一条不可用，其余照常导入
 */

export type FatalReason = 'invalid-json' | 'not-an-object' | 'no-items' | 'empty-items'

export type SkipReason =
  /** 条目本身不是对象 */
  | 'not-an-object'
  /** 题型无法唯一判断 */
  | 'unknown-type'
  /** 显式题型与结构/标记冲突 */
  | 'conflicting-type'
  /** 题干缺失 */
  | 'missing-prompt'
  /** 选项数组缺失或选项文本不完整 */
  | 'incomplete-options'
  /** 没有任何正确答案标记，且没有答案键可解析 */
  | 'missing-answer-key'
  /** 答案键指向多个选项，无法唯一确定 */
  | 'ambiguous-answer-key'
  /** 所有选项都被标记为 false */
  | 'no-correct-option'
  /** 结构明显不合法（例如 choices 不是数组） */
  | 'malformed-item'
  /** 完形填空的 {{n}} 标记不连续或有重复 */
  | 'cloze-marker-mismatch'
  /** 完形填空某个空没有答案 */
  | 'cloze-missing-answer'
  /** 词汇条目没有 word 字段 */
  | 'missing-word'

/** 单条解析失败。抛出它 → 该条进入 skipped 列表，不影响其它条目。 */
export class ItemError extends Error {
  constructor(
    public readonly reason: SkipReason,
    message: string
  ) {
    super(message)
    this.name = 'ItemError'
  }
}
