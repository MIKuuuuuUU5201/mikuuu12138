/**
 * 做题会话的规则测试：判定时机、锁定、每空判定、复制、以及「换题库即清空」。
 * 判定本身走 core/grade 的纯函数，这里验的是接线与交互语义。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { ChoiceItem, ClozeItem, QuizItem, TrueFalseItem } from '@/core/model/quiz'
import { COPY_FEEDBACK_MS, useQuizSession } from '../useQuizSession'

const SINGLE: ChoiceItem = {
  kind: 'choice',
  id: 'q1',
  mode: 'single',
  prompt: 'She ____ to the theatre last night.',
  options: [
    { id: 'q1-o1', text: 'went', correct: true },
    { id: 'q1-o2', text: 'go', correct: false }
  ],
  explanation: '过去时。'
}

const MULTI: ChoiceItem = {
  kind: 'choice',
  id: 'q2',
  mode: 'multi',
  prompt: '选出所有正确的',
  options: [
    { id: 'q2-o1', text: 'A 正确', correct: true },
    { id: 'q2-o2', text: 'B 错误', correct: false },
    { id: 'q2-o3', text: 'C 正确', correct: true }
  ]
}

const TF: TrueFalseItem = {
  kind: 'true-false',
  id: 'q3',
  prompt: 'The past tense of "think" is "thinked".',
  answer: false
}

const CLOZE: ClozeItem = {
  kind: 'cloze',
  id: 'q4',
  passage: 'I {{1}} home and spoke {{2}}.',
  blanks: [
    { index: 1, answer: 'went', choices: ['went', 'go', 'goes'] },
    { index: 2, answer: 'loudly', choices: ['loud', 'loudly'] }
  ]
}

const ITEMS: QuizItem[] = [SINGLE, MULTI, TF, CLOZE]

function harness(items: QuizItem[] = ITEMS, writeText = async () => true) {
  const copied: string[] = []
  const session = useQuizSession(() => items, {
    writeText: async (text: string) => {
      copied.push(text)
      return writeText()
    }
  })
  return { session, copied }
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('单选：点选即判定并锁定', () => {
  it('选对 → 判定 correct', () => {
    const { session } = harness()
    session.pickChoice(SINGLE, 'q1-o1')
    expect(session.stateOf('q1').judged).toBe(true)
    expect(session.stateOf('q1').verdict).toBe('correct')
    expect(session.message.value).toBe('回答正确')
  })

  it('选错 → 判定 wrong', () => {
    const { session } = harness()
    session.pickChoice(SINGLE, 'q1-o2')
    expect(session.stateOf('q1').verdict).toBe('wrong')
    expect(session.message.value).toBe('回答错误')
  })

  it('判定后再点别的选项不会改变结果', () => {
    const { session } = harness()
    session.pickChoice(SINGLE, 'q1-o2')
    session.pickChoice(SINGLE, 'q1-o1')
    expect(session.stateOf('q1').selected).toEqual(['q1-o2'])
    expect(session.stateOf('q1').verdict).toBe('wrong')
  })
})

describe('多选：先选后提交', () => {
  it('点选不会立即判定', () => {
    const { session } = harness()
    session.pickChoice(MULTI, 'q2-o1')
    expect(session.stateOf('q2').judged).toBe(false)
    expect(session.stateOf('q2').verdict).toBeNull()
  })

  it('再点同一个选项会取消选择', () => {
    const { session } = harness()
    session.pickChoice(MULTI, 'q2-o1')
    session.pickChoice(MULTI, 'q2-o1')
    expect(session.stateOf('q2').selected).toEqual([])
  })

  it('提交全部正确 → correct', () => {
    const { session } = harness()
    session.pickChoice(MULTI, 'q2-o1')
    session.pickChoice(MULTI, 'q2-o3')
    session.submitChoice(MULTI)
    expect(session.stateOf('q2').verdict).toBe('correct')
  })

  it('漏选 → wrong', () => {
    const { session } = harness()
    session.pickChoice(MULTI, 'q2-o1')
    session.submitChoice(MULTI)
    expect(session.stateOf('q2').verdict).toBe('wrong')
  })

  it('一个都没选时提交不生效', () => {
    const { session } = harness()
    session.submitChoice(MULTI)
    expect(session.stateOf('q2').judged).toBe(false)
  })

  it('提交后再点选项不会改变结果', () => {
    const { session } = harness()
    session.pickChoice(MULTI, 'q2-o1')
    session.submitChoice(MULTI)
    session.pickChoice(MULTI, 'q2-o2')
    expect(session.stateOf('q2').selected).toEqual(['q2-o1'])
  })
})

describe('判断题：点选即判定', () => {
  it('选 False（正确）→ correct', () => {
    const { session } = harness()
    session.pickTrueFalse(TF, false)
    expect(session.stateOf('q3').verdict).toBe('correct')
  })

  it('选 True（错误）→ wrong', () => {
    const { session } = harness()
    session.pickTrueFalse(TF, true)
    expect(session.stateOf('q3').verdict).toBe('wrong')
  })

  it('判定后再点另一边不生效', () => {
    const { session } = harness()
    session.pickTrueFalse(TF, true)
    session.pickTrueFalse(TF, false)
    expect(session.stateOf('q3').trueFalse).toBe(true)
    expect(session.stateOf('q3').verdict).toBe('wrong')
  })
})

describe('完形填空：全部填完一次提交', () => {
  it('填一个空不会判定', () => {
    const { session } = harness()
    session.setBlank(CLOZE, 1, 'went')
    expect(session.stateOf('q4').judged).toBe(false)
    expect(session.filledBlankCount(CLOZE)).toBe(1)
  })

  it('没填完就提交不生效', () => {
    const { session } = harness()
    session.setBlank(CLOZE, 1, 'went')
    session.submitCloze(CLOZE)
    expect(session.stateOf('q4').judged).toBe(false)
  })

  it('全填对 → 整篇 correct，每空都 correct', () => {
    const { session } = harness()
    session.setBlank(CLOZE, 1, 'went')
    session.setBlank(CLOZE, 2, 'loudly')
    session.submitCloze(CLOZE)
    const state = session.stateOf('q4')
    expect(state.verdict).toBe('correct')
    expect(state.blankVerdicts).toEqual({ 1: 'correct', 2: 'correct' })
    expect(session.message.value).toBe('全部正确')
  })

  it('一空错 → 整篇 wrong，但另一空仍然是 correct（逐空判定）', () => {
    const { session } = harness()
    session.setBlank(CLOZE, 1, 'go')
    session.setBlank(CLOZE, 2, 'loudly')
    session.submitCloze(CLOZE)
    const state = session.stateOf('q4')
    expect(state.verdict).toBe('wrong')
    expect(state.blankVerdicts).toEqual({ 1: 'wrong', 2: 'correct' })
    expect(session.message.value).toBe('有 1 个空回答错误')
  })

  it('大小写与多余空格不影响判定（沿用 core/grade 的规则）', () => {
    const { session } = harness()
    session.setBlank(CLOZE, 1, '  WENT ')
    session.setBlank(CLOZE, 2, 'loudly')
    session.submitCloze(CLOZE)
    expect(session.stateOf('q4').verdict).toBe('correct')
  })

  it('提交后再改答案不生效', () => {
    const { session } = harness()
    session.setBlank(CLOZE, 1, 'go')
    session.setBlank(CLOZE, 2, 'loud')
    session.submitCloze(CLOZE)
    session.setBlank(CLOZE, 1, 'went')
    expect(session.stateOf('q4').blanks[1]).toBe('go')
  })
})

describe('题与题之间互不影响', () => {
  it('每道题各自独立判定', () => {
    const { session } = harness()
    session.pickChoice(SINGLE, 'q1-o1')
    session.pickTrueFalse(TF, true)
    expect(session.stateOf('q1').verdict).toBe('correct')
    expect(session.stateOf('q3').verdict).toBe('wrong')
    expect(session.stateOf('q2').judged).toBe(false)
    expect(session.stateOf('q4').judged).toBe(false)
  })

  it('换一份题库（重新导入）会清空全部作答', async () => {
    const items = ref(ITEMS)
    const session = useQuizSession(() => items.value, { writeText: async () => true })
    session.pickChoice(SINGLE, 'q1-o1')
    expect(session.stateOf('q1').judged).toBe(true)

    items.value = [SINGLE, TF]
    await nextTick()
    expect(session.stateOf('q1').judged).toBe(false)
    expect(session.stateOf('q3').trueFalse).toBeNull()
  })
})

describe('复制', () => {
  it('复制内容进入剪贴板，并给出反馈后自动恢复', async () => {
    vi.useFakeTimers()
    const { session, copied } = harness()
    const ok = await session.copy(SINGLE)

    expect(ok).toBe(true)
    expect(copied).toHaveLength(1)
    expect(copied[0]).toContain('She ____ to the theatre last night.')
    expect(copied[0]).not.toContain('过去时。')
    expect(session.copiedId.value).toBe('q1')

    vi.advanceTimersByTime(COPY_FEEDBACK_MS)
    expect(session.copiedId.value).toBeNull()
  })

  it('复制的是当前作答状态（选完之后再复制）', async () => {
    const { session, copied } = harness()
    session.pickChoice(MULTI, 'q2-o1')
    await session.copy(MULTI)
    expect(copied[0]).toContain('我的答案：A. A 正确')
  })

  it('复制失败时不冒充成功，只提示失败', async () => {
    const { session } = harness(ITEMS, async () => false)
    const ok = await session.copy(TF)
    expect(ok).toBe(false)
    expect(session.copiedId.value).toBeNull()
    expect(session.copyFailedId.value).toBe('q3')
    expect(session.message.value).toContain('复制失败')
  })

  it('复制成功后清掉失败标记', async () => {
    const { session } = harness(ITEMS, async () => false)
    await session.copy(TF)
    expect(session.copyFailedId.value).toBe('q3')

    const retry = harness(ITEMS, async () => true)
    await retry.session.copy(TF)
    expect(retry.session.copyFailedId.value).toBeNull()
    expect(retry.session.copiedId.value).toBe('q3')
  })
})
