/**
 * 词汇模块的内部模型。
 * example / translation 用 null 表示“该条没有提供”，与“提供了空字符串”区分开。
 */

export interface VocabItem {
  /** 文档内唯一，形如 v3 */
  id: string
  word: string
  example: string | null
  translation: string | null
}

export interface VocabDoc {
  title: string
  items: VocabItem[]
}
