/**
 * 做题会话：作答状态 + 判定 + 复制。
 *
 * 只做内存态：不保存答题历史 / 分数 / 答题进度（产品要求），刷新即重置。
 * 判定一律交给 core/grade 的纯函数，UI 不自己判断对错。
 *
 * 判定时机：
 *  - 单选 / 判断题：点选即判定
 *  - 多选 / 完形填空：先选择，点「提交」后统一判定
 *  - 判定之后锁定该题（避免状态反复横跳）
 */
import { ref, watch, type Ref } from 'vue'
import {
  gradeCloze,
  gradeMultipleChoice,
  gradeSingleChoice,
  gradeTrueFalse
} from '@/core/grade/grading'
import type { ChoiceItem, ClozeItem, QuizItem, TrueFalseItem } from '@/core/model/quiz'
import type { Verdict } from '@/core/model/verdict'
import { copyText } from '@/ui/clipboard'
import { buildCopyText } from './copy-text'

export const COPY_FEEDBACK_MS = 1400

export interface ItemState {
  /** 选择题：已选选项 id（单选只会有一个） */
  selected: string[]
  /** 判断题：true / false；null = 未作答 */
  trueFalse: boolean | null
  /** 完形填空：空号 → 用户填的内容 */
  blanks: Record<number, string>
  /** 是否已判定 */
  judged: boolean
  verdict: Verdict | null
  /** 完形填空：每个空各自的判定 */
  blankVerdicts: Record<number, Verdict | null>
}

export interface QuizSessionDeps {
  writeText?: (text: string) => Promise<boolean>
}

function newState(): ItemState {
  return {
    selected: [],
    trueFalse: null,
    blanks: {},
    judged: false,
    verdict: null,
    blankVerdicts: {}
  }
}

/** 还没初始化的题（只读占位，避免渲染时凭空创建状态） */
const EMPTY_STATE: ItemState = {
  selected: [],
  trueFalse: null,
  blanks: {},
  judged: false,
  verdict: null,
  blankVerdicts: {}
}

export function useQuizSession(getItems: () => QuizItem[], deps: QuizSessionDeps = {}) {
  const writeText = deps.writeText ?? copyText
  const states = ref<Record<string, ItemState>>({})
  const copiedId = ref<string | null>(null)
  const copyFailedId = ref<string | null>(null)
  const message = ref<string>('')
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  function init(): void {
    const next: Record<string, ItemState> = {}
    for (const item of getItems()) next[item.id] = newState()
    states.value = next
  }

  // 换一份题库（重新导入）＝ 新的一次做题：清掉全部作答
  watch(
    () =>
      getItems()
        .map((item) => item.id)
        .join(','),
    init,
    { immediate: true }
  )

  function stateOf(id: string): ItemState {
    return states.value[id] ?? EMPTY_STATE
  }

  function judgeChoice(item: ChoiceItem, state: ItemState): void {
    state.judged = true
    state.verdict =
      item.mode === 'single'
        ? gradeSingleChoice(item, state.selected[0] ?? null)
        : gradeMultipleChoice(item, state.selected)
    message.value = state.verdict === 'correct' ? '回答正确' : '回答错误'
  }

  /** 单选点选即判定；多选只切换选择，等提交 */
  function pickChoice(item: ChoiceItem, optionId: string): void {
    const state = stateOf(item.id)
    if (state.judged) return
    if (item.mode === 'single') {
      state.selected = [optionId]
      judgeChoice(item, state)
      return
    }
    state.selected = state.selected.includes(optionId)
      ? state.selected.filter((id) => id !== optionId)
      : [...state.selected, optionId]
  }

  function submitChoice(item: ChoiceItem): void {
    const state = stateOf(item.id)
    if (state.judged || state.selected.length === 0) return
    judgeChoice(item, state)
  }

  function pickTrueFalse(item: TrueFalseItem, value: boolean): void {
    const state = stateOf(item.id)
    if (state.judged) return
    state.trueFalse = value
    state.judged = true
    state.verdict = gradeTrueFalse(item, value)
    message.value = state.verdict === 'correct' ? '回答正确' : '回答错误'
  }

  /** 完形填空：先填，全部填完才能提交 */
  function setBlank(item: ClozeItem, index: number, value: string): void {
    const state = stateOf(item.id)
    if (state.judged) return
    state.blanks = { ...state.blanks, [index]: value }
  }

  function filledBlankCount(item: ClozeItem): number {
    const state = stateOf(item.id)
    return item.blanks.filter((blank) => (state.blanks[blank.index] ?? '').trim() !== '').length
  }

  function submitCloze(item: ClozeItem): void {
    const state = stateOf(item.id)
    if (state.judged) return
    if (filledBlankCount(item) < item.blanks.length) return

    const result = gradeCloze(
      item,
      item.blanks.map((blank) => state.blanks[blank.index] ?? null)
    )
    const verdicts: Record<number, Verdict | null> = {}
    for (const entry of result.blankResults) verdicts[entry.index] = entry.verdict

    state.judged = true
    state.verdict = result.overall
    state.blankVerdicts = verdicts

    const wrong = result.blankResults.filter((entry) => entry.verdict === 'wrong').length
    message.value = wrong === 0 ? '全部正确' : `有 ${wrong} 个空回答错误`
  }

  /** 复制题目：只含题目 / 选项 / 我的答案，绝不含正确答案与 explanation */
  async function copy(item: QuizItem): Promise<boolean> {
    const state = stateOf(item.id)
    const ok = await writeText(
      buildCopyText({
        item,
        selected: state.selected,
        trueFalse: state.trueFalse,
        blanks: state.blanks
      })
    )

    if (copyTimer !== null) {
      clearTimeout(copyTimer)
      copyTimer = null
    }
    if (!ok) {
      // 剪贴板可能被浏览器拒绝（窗口不在前台 / 没有用户手势）：给一条可见的短提示，
      // 不要静默失败，也不要弹 toast。
      copyFailedId.value = item.id
      message.value = '复制失败，请手动选中文本'
      copyTimer = setTimeout(() => {
        copyFailedId.value = null
        copyTimer = null
      }, COPY_FEEDBACK_MS)
      return false
    }
    copiedId.value = item.id
    copyFailedId.value = null
    message.value = '已复制题目与我的答案（不含正确答案与解析）'
    copyTimer = setTimeout(() => {
      copiedId.value = null
      copyTimer = null
    }, COPY_FEEDBACK_MS)
    return true
  }

  return {
    states: states as Ref<Record<string, ItemState>>,
    copiedId,
    copyFailedId,
    message,
    stateOf,
    pickChoice,
    submitChoice,
    pickTrueFalse,
    setBlank,
    filledBlankCount,
    submitCloze,
    copy
  }
}
