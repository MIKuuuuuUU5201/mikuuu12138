/**
 * 生词本页面的动作层：复制（单个 / 全部）、删除、导出成文件、导入覆盖。
 *
 * 这里只做两件事：调 state/useWordbook（它再调 core/storage/wordbook）+ 维护反馈状态。
 * **绝不自己实现去重、顺序或导入校验** —— 那些规则都在 core/storage/wordbook 里，全项目只有一份。
 *
 * 反馈纪律：行内换图标 / 一行小字 + aria-live，不弹 toast。
 */
import { ref } from 'vue'
import { copyText } from '@/ui/clipboard'
import { downloadText } from '@/ui/download'
import { useWordbook } from '@/state/useWordbook'

export const FEEDBACK_MS = 1400

export type WordbookApi = ReturnType<typeof useWordbook>
export type ImportOutcome = ReturnType<WordbookApi['importJson']>
export type RemoveOutcome = ReturnType<WordbookApi['remove']>

export interface WordbookToolsDeps {
  /** 默认用真实的 useWordbook；测试可注入 */
  book?: WordbookApi
  writeText?: (text: string) => Promise<boolean>
  download?: (filename: string, text: string) => boolean
  now?: () => Date
}

/** 导出文件名：english-site-wordbook-20260919-1730.json */
export function exportFilename(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `english-site-wordbook-${stamp}.json`
}

export function useWordbookTools(deps: WordbookToolsDeps = {}) {
  const book = deps.book ?? useWordbook()
  const writeText = deps.writeText ?? copyText
  const download = deps.download ?? downloadText
  const now = deps.now ?? (() => new Date())

  /** 刚复制成功的那一条（词的原文），用于把图标换成对勾 */
  const copied = ref<string | null>(null)
  const copiedAll = ref(false)
  /** 复制失败的那一条（词的原文）；旧浏览器 / 窗口不在前台时会出现 */
  const copyFailed = ref<string | null>(null)
  const copyFailedAll = ref(false)
  /** 删除失败的那一条（写盘失败时旧数据保持不动，界面也不该假装删掉了） */
  const removeFailed = ref<string | null>(null)
  /** 顶部一行状态文字，同时作为 aria-live 播报内容 */
  const message = ref('')
  /** 上一次导入的结果（成功计数或失败原因列表） */
  const importResult = ref<ImportOutcome | null>(null)

  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function clearTransient() {
    copied.value = null
    copiedAll.value = false
    copyFailed.value = null
    copyFailedAll.value = false
    removeFailed.value = null
  }

  /**
   * 每个动作开始时调用：清掉上一次的瞬时反馈（定时器 + 图标态）。
   * 必须在设置本次标记**之前**调用，否则会把刚设好的标记一起清掉。
   */
  function beginFeedback() {
    clearTimer()
    clearTransient()
  }

  /** 即时反馈：过一会儿自动消失（连图标态一起）。导入结果这类要留着的走 keep() */
  function flash(text: string) {
    message.value = text
    timer = setTimeout(() => {
      if (message.value === text) message.value = ''
      clearTransient()
      timer = null
    }, FEEDBACK_MS)
  }

  /** 留在页面上的结果（导入 / 导出），不自动消失 */
  function keep(text: string) {
    message.value = text
  }

  async function copyWord(word: string): Promise<boolean> {
    const ok = await writeText(word)
    beginFeedback()
    if (ok) {
      copied.value = word
      flash(`已复制 ${word}`)
    } else {
      copyFailed.value = word
      flash('复制失败，请手动选中文本')
    }
    return ok
  }

  async function copyAll(): Promise<boolean> {
    const list = book.words.value
    if (list.length === 0) return false
    // 一行一个、按当前列表顺序、不追加任何额外内容
    const ok = await writeText(list.join('\n'))
    beginFeedback()
    if (ok) {
      copiedAll.value = true
      flash(`已复制全部 ${list.length} 条`)
    } else {
      copyFailedAll.value = true
      flash('复制失败，请手动选中文本')
    }
    return ok
  }

  function removeWord(word: string): boolean {
    const outcome: RemoveOutcome = book.remove(word)
    beginFeedback()
    if (!outcome.ok) {
      removeFailed.value = word
      flash(`删除失败：${outcome.detail}`)
      return false
    }
    flash(`已删除 ${word}`)
    return true
  }

  function exportToFile(): { ok: boolean; filename: string } {
    const filename = exportFilename(now())
    const ok = download(filename, book.exportJson())
    beginFeedback()
    if (ok) keep(`已导出 ${filename}`)
    else flash('导出失败，请重试')
    return { ok, filename }
  }

  /** 导入即「整体覆盖」：校验不通过时 core 层一个字节都不会写，这里也只是显示原因 */
  function importFromText(text: string): ImportOutcome {
    const outcome = book.importJson(text)
    beginFeedback()
    importResult.value = outcome
    if (outcome.ok) {
      keep(
        `已导入 ${outcome.count} 条` +
          (outcome.duplicates > 0 ? `，跳过重复 ${outcome.duplicates} 条` : '') +
          '，生词本已整体替换'
      )
    } else {
      keep(`导入失败，生词本未做任何改动（${outcome.errors.length} 个问题）`)
    }
    return outcome
  }

  function resetImportResult() {
    importResult.value = null
    if (message.value.startsWith('导入失败') || message.value.startsWith('已导入'))
      message.value = ''
  }

  return {
    words: book.words,
    count: book.count,
    status: book.status,
    detail: book.detail,
    storageAvailable: book.storageAvailable,
    reload: book.reload,
    copied,
    copiedAll,
    copyFailed,
    copyFailedAll,
    removeFailed,
    message,
    importResult,
    copyWord,
    copyAll,
    removeWord,
    exportToFile,
    importFromText,
    resetImportResult
  }
}
