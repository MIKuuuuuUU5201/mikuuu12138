/**
 * 词汇阅读器的交互状态。
 *
 * 只做 UI 状态：哪些翻译显示了、哪一条是「当前词」、哪个刚复制过、给屏幕阅读器念什么。
 * 不落盘 —— 产品要求不保存阅读进度 / 学习历史。
 *
 * 生词本一律走 state/useWordbook（Stage 2 的既有 storage 与 wordKey 去重规则），
 * 这里不新建任何 wordbook state、不碰 localStorage。
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { VocabItem } from '@/core/model/vocab'
import { copyText } from '@/ui/clipboard'
import { useWordbook } from '@/state/useWordbook'

/** 复制成功的图标反馈停留时长 */
export const COPY_FEEDBACK_MS = 1400

export interface SaveOutcome {
  ok: boolean
  added: boolean
}

export interface VocabReaderDeps {
  isSaved?: (word: string) => boolean
  toggleSaved?: (word: string) => SaveOutcome
  writeText?: (text: string) => Promise<boolean>
}

export function useVocabReader(getItems: () => VocabItem[], deps: VocabReaderDeps = {}) {
  const wordbook = useWordbook()
  const savedLookup = deps.isSaved ?? ((word: string) => wordbook.has(word))
  const saveToggle =
    deps.toggleSaved ??
    ((word: string): SaveOutcome => {
      const outcome = wordbook.toggle(word)
      return { ok: outcome.result.ok, added: outcome.added }
    })
  const writeText = deps.writeText ?? copyText

  const revealedIds = ref<Set<string>>(new Set())
  const hoverId = ref<string | null>(null)
  const centerId = ref<string | null>(null)
  const copiedId = ref<string | null>(null)
  const message = ref('')
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  /** 键盘 / 复制 / 生词的「当前词」：鼠标悬停优先，否则跟着滚动取视口中间那一条 */
  const activeId = computed(() => hoverId.value ?? centerId.value)

  const allRevealed = computed(() => {
    const list = getItems()
    return list.length > 0 && list.every((item) => revealedIds.value.has(item.id))
  })

  // 换了一份词表（重新导入）＝ 新的阅读会话：清掉显示状态，避免上一份的 id 泄漏过来
  watch(
    () =>
      getItems()
        .map((item) => item.id)
        .join(','),
    () => {
      revealedIds.value = new Set()
      hoverId.value = null
      centerId.value = null
      copiedId.value = null
      message.value = ''
    }
  )

  function isRevealed(id: string): boolean {
    return revealedIds.value.has(id)
  }

  function toggleReveal(id: string): void {
    const next = new Set(revealedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    revealedIds.value = next
    message.value = next.has(id) ? '已显示这个单词的翻译' : '已隐藏这个单词的翻译'
  }

  /** 全部显示 / 全部隐藏：只要还有没显示的，就全部显示；已经全显示了，就全部隐藏 */
  function toggleAllReveal(): void {
    const list = getItems()
    if (list.length === 0) return
    const showAll = !allRevealed.value
    revealedIds.value = showAll ? new Set(list.map((item) => item.id)) : new Set()
    message.value = showAll ? '已显示全部翻译' : '已隐藏全部翻译'
  }

  function isSaved(item: VocabItem): boolean {
    return savedLookup(item.word)
  }

  function toggleSave(item: VocabItem): SaveOutcome {
    const outcome = saveToggle(item.word)
    if (!outcome.ok) {
      message.value = '生词本写入失败，请稍后再试'
      return outcome
    }
    message.value = outcome.added ? `已加入生词本：${item.word}` : `已从生词本移除：${item.word}`
    return outcome
  }

  /** 复制只复制 word / phrase 本身，不带例句与翻译 */
  async function copy(item: VocabItem): Promise<boolean> {
    const ok = await writeText(item.word)
    if (copyTimer !== null) {
      clearTimeout(copyTimer)
      copyTimer = null
    }
    if (!ok) {
      message.value = '复制失败，请手动选中文本'
      return false
    }
    copiedId.value = item.id
    message.value = `已复制：${item.word}`
    copyTimer = setTimeout(() => {
      copiedId.value = null
      copyTimer = null
    }, COPY_FEEDBACK_MS)
    return true
  }

  return {
    revealedIds: revealedIds as Ref<Set<string>>,
    allRevealed: allRevealed as ComputedRef<boolean>,
    activeId: activeId as ComputedRef<string | null>,
    copiedId,
    message,
    isRevealed,
    toggleReveal,
    toggleAllReveal,
    isSaved,
    toggleSave,
    copy,
    setHover: (id: string | null) => {
      hoverId.value = id
    },
    setCenter: (id: string | null) => {
      centerId.value = id
    }
  }
}
