/**
 * 判定：纯函数，不碰 DOM、不碰 Vue。
 *
 * 契约：
 *  - 只有用户真正提交了作答，才调用这些函数（UI 用 null 表示“未作答”并禁用提交）
 *  - 未作答一律返回 null，绝不返回 'wrong'——否则统计会凭空多出错误
 *  - 文本比较规则：去首尾空白、多空格归一、忽略大小写（写死在这里，不在 UI 里各写一份）
 */
import type { ChoiceItem, ClozeItem, TrueFalseItem } from '../model/quiz'
import { correctOptionIds } from '../model/quiz'
import type { Graded, Verdict } from '../model/verdict'

export function normalizeAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function gradeSingleChoice(item: ChoiceItem, selectedOptionId: string | null): Graded {
  if (selectedOptionId === null) return null
  const chosen = item.options.find((o) => o.id === selectedOptionId)
  if (chosen === undefined) return null
  return chosen.correct ? 'correct' : 'wrong'
}

/** 多选：所选集合与正确集合完全一致才算对（多选、漏选都算错；全不选 = 错） */
export function gradeMultipleChoice(
  item: ChoiceItem,
  selectedOptionIds: readonly string[]
): Verdict {
  const correct = correctOptionIds(item)
  const selected = [...new Set(selectedOptionIds)]
  return selected.length === correct.length && correct.every((id) => selected.includes(id))
    ? 'correct'
    : 'wrong'
}

export function gradeTrueFalse(item: TrueFalseItem, selected: boolean | null): Graded {
  if (selected === null) return null
  return selected === item.answer ? 'correct' : 'wrong'
}

export interface ClozeBlankResult {
  index: number
  verdict: Graded
}

export interface ClozeResult {
  blankResults: ClozeBlankResult[]
  /** 有任何空没填 → null（未作答）；全部填完才给整篇判定 */
  overall: Graded
}

export function gradeCloze(item: ClozeItem, answers: readonly (string | null)[]): ClozeResult {
  const blankResults: ClozeBlankResult[] = item.blanks.map((blank, i) => {
    const raw = answers[i] ?? null
    if (raw === null || raw.trim() === '') return { index: blank.index, verdict: null }
    return {
      index: blank.index,
      verdict: normalizeAnswer(raw) === normalizeAnswer(blank.answer) ? 'correct' : 'wrong'
    }
  })

  const incomplete = blankResults.some((r) => r.verdict === null)
  const overall: Graded = incomplete
    ? null
    : blankResults.every((r) => r.verdict === 'correct')
      ? 'correct'
      : 'wrong'

  return { blankResults, overall }
}
