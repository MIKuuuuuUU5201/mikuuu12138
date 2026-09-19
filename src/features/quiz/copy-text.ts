/**
 * 生成「复制这道题」的纯文本。
 *
 * 只包含：题目 / statement / passage + 所有选项 + 用户当前答案。
 * **绝不包含**：正确答案、网站显示的 explanation、空号对应的正确文本。
 *
 * 与作答状态无关的部分都在这里算，方便单独测试（尤其是「不含答案」这条约束）。
 */
import type { ChoiceItem, ClozeItem, QuizItem, TrueFalseItem } from '@/core/model/quiz'

export interface CopyInput {
  item: QuizItem
  /** 选择题：已选选项 id */
  selected?: readonly string[]
  /** 判断题：true / false / null（未作答） */
  trueFalse?: boolean | null
  /** 完形填空：空号 → 用户填的内容 */
  blanks?: Readonly<Record<number, string>>
}

export const UNSET_LABEL = '（未作答）'

export function buildCopyText(input: CopyInput): string {
  const item = input.item
  if (item.kind === 'choice') return choiceText(item, input.selected ?? [])
  if (item.kind === 'true-false') return trueFalseText(item, input.trueFalse ?? null)
  return clozeText(item, input.blanks ?? {})
}

function letter(index: number): string {
  return String.fromCharCode(65 + index)
}

function choiceText(item: ChoiceItem, selected: readonly string[]): string {
  const picked = item.options.flatMap((option, i) =>
    selected.includes(option.id) ? [`${letter(i)}. ${option.text}`] : []
  )
  return [
    item.prompt,
    '',
    ...item.options.map((option, i) => `${letter(i)}. ${option.text}`),
    '',
    `我的答案：${picked.length > 0 ? picked.join('，') : UNSET_LABEL}`
  ].join('\n')
}

function trueFalseText(item: TrueFalseItem, value: boolean | null): string {
  const answer = value === null ? UNSET_LABEL : value ? 'True' : 'False'
  return [item.prompt, '', 'A. True', 'B. False', '', `我的答案：${answer}`].join('\n')
}

function clozeText(item: ClozeItem, blanks: Readonly<Record<number, string>>): string {
  const lines: string[] = [item.passage, '']

  for (const blank of item.blanks) {
    lines.push(`${blank.index}.`)
    blank.choices.forEach((choice, i) => lines.push(`${letter(i)}. ${choice}`))
    lines.push('')
  }

  const mine = item.blanks.map((blank) => {
    const value = (blanks[blank.index] ?? '').trim()
    return `${blank.index}) ${value !== '' ? value : UNSET_LABEL}`
  })

  lines.push(`我的答案：${mine.join('  ')}`)
  return lines.join('\n')
}
