/**
 * 站点内部的做题数据模型。
 *
 * 这是「边界之内」的形状：只由 core/parse 生产，只被 core/grade 与 UI 消费。
 * 它有意与任何 GPT/外部 JSON 的字段名解耦——外部格式的差异全部在 parse 层被消化。
 */

export type ChoiceMode = 'single' | 'multi'

export interface ChoiceOption {
  /** 题内唯一，形如 q3-o2 */
  id: string
  text: string
  correct: boolean
}

export interface ChoiceItem {
  kind: 'choice'
  id: string
  mode: ChoiceMode
  prompt: string
  options: ChoiceOption[]
  /** 解析说明，可选；缺失时为 null */
  explanation?: string | null
}

export interface TrueFalseItem {
  kind: 'true-false'
  id: string
  prompt: string
  answer: boolean
  /** 解析说明，可选；缺失时为 null */
  explanation?: string | null
}

export interface ClozeBlank {
  /** 与段落里的 {{index}} 一一对应，从 1 开始 */
  index: number
  answer: string
  /** 该空的可选词库；为空数组表示自由填空 */
  choices: string[]
  /** 该空的解析说明，可选；缺失时为 null */
  explanation?: string | null
}

export interface ClozeItem {
  kind: 'cloze'
  id: string
  /** 原始段落，保留 {{1}} / {{2}} 标记，由渲染器替换成输入位 */
  passage: string
  blanks: ClozeBlank[]
  /** 整篇的解析说明，可选；缺失时为 null */
  explanation?: string | null
}

export type QuizItem = ChoiceItem | TrueFalseItem | ClozeItem

export type QuizItemKind = QuizItem['kind']

export function correctOptionIds(item: ChoiceItem): string[] {
  return item.options.filter((o) => o.correct).map((o) => o.id)
}

/** 统计各题型数量（纯函数；导入报告与做题入口共用，避免两处各写一份） */
export function countByKind(items: readonly QuizItem[]): Record<QuizItemKind, number> {
  const counts: Record<QuizItemKind, number> = { choice: 0, 'true-false': 0, cloze: 0 }
  for (const item of items) counts[item.kind] += 1
  return counts
}
