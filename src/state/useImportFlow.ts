/**
 * 导入流程：文本 → parser → 报告 → （用户确认）→ 写入最近导入 → 进入对应入口。
 *
 * 分层位置：state 层。UI 只调这里，**绝不在 View 里自己调 parser 或 storage**。
 * core/parse 与 core/storage 的规则完全没被改动，这里只是把它们串起来。
 *
 * 两个概念分得很清楚：
 *  - pending：刚解析出来、等用户看报告并确认的结果
 *  - current：已确认、准备进入学习页的文档
 * 只有 current 会被学习页消费；只有用户点「开始」时才会写最近导入。
 */
import { shallowRef, type ShallowRef } from 'vue'
import type { EnvelopeStore } from '@/core/storage/local'
import { saveRecent, type RecentImport, type RecentKind } from '@/core/storage/recent'
import { parseQuizText } from '@/core/parse/quiz-parse'
import { parseVocabText } from '@/core/parse/vocab-parse'
import { summarize, type ImportReport } from '@/core/parse/report'
import type { QuizItem } from '@/core/model/quiz'
import type { VocabItem } from '@/core/model/vocab'

export type ImportKind = RecentKind

/**
 * 可辨识联合：kind 与 report 是一起产生的，绑定在一起，
 * 这样 View 里 `doc.kind === 'quiz'` 就能自动收窄 report 类型，不需要强制转换。
 */
export type ImportDoc =
  | {
      kind: 'quiz'
      title: string
      raw: string
      filename: string | null
      report: ImportReport<QuizItem>
    }
  | {
      kind: 'vocab'
      title: string
      raw: string
      filename: string | null
      report: ImportReport<VocabItem>
    }

export interface ConfirmOutcome {
  ok: boolean
  kind: ImportKind | null
  /** 需要告诉用户但不阻塞流程的提示（例如最近导入没记上） */
  notice: string | null
}

export interface ImportFlowDeps {
  store: EnvelopeStore
  /** 便于测试注入固定时间 */
  now?: () => number
  /** 最近导入写入成功后通知响应式列表刷新 */
  onRecentChanged?: (kind: ImportKind) => void
}

export function createImportFlow(deps: ImportFlowDeps) {
  // 用 shallowRef：报告对象是不可变的，不需要深度响应式；
  // 同时保住对象身份（阶段 4 会用它们当 Map 的键、做身份比较）。
  const pending: ShallowRef<ImportDoc | null> = shallowRef(null)
  const current: ShallowRef<ImportDoc | null> = shallowRef(null)
  const notice: ShallowRef<string | null> = shallowRef(null)

  function parseQuizDoc(text: string, filename: string | null): ImportDoc {
    const report = parseQuizText(text)
    return { kind: 'quiz', title: report.title, raw: text, filename, report }
  }

  function parseVocabDoc(text: string, filename: string | null): ImportDoc {
    const report = parseVocabText(text)
    return { kind: 'vocab', title: report.title, raw: text, filename, report }
  }

  function parse(kind: ImportKind, text: string, filename: string | null): ImportDoc {
    const doc = kind === 'quiz' ? parseQuizDoc(text, filename) : parseVocabDoc(text, filename)
    pending.value = doc
    notice.value = null
    return doc
  }

  /** 用户点了「开始」：写最近导入（存 raw）+ 设置 current。写最近导入失败不影响本次导入。 */
  function confirm(): ConfirmOutcome {
    const doc = pending.value
    if (doc === null) return { ok: false, kind: null, notice: '还没有可确认的导入结果' }

    const summary = summarize(doc.report)
    if (summary.accepted === 0) {
      return { ok: false, kind: doc.kind, notice: '没有可导入的内容，请检查 JSON' }
    }

    const saved = saveRecent(deps.store, doc.kind, {
      raw: doc.raw,
      title: doc.title,
      filename: doc.filename,
      counts: { accepted: summary.accepted, skipped: summary.skipped },
      importedAt: deps.now?.() ?? Date.now()
    })

    const noticeText = saved.ok ? null : `已进入学习，但这次没有记入「最近导入」：${saved.detail}`
    if (saved.ok) deps.onRecentChanged?.(doc.kind)

    current.value = doc
    pending.value = null
    notice.value = noticeText
    return { ok: true, kind: doc.kind, notice: noticeText }
  }

  /**
   * 打开一条历史记录：拿它保存的 raw **重新 parse**，绝不使用保存下来的解析模型。
   * 所以 parser 改进后，旧记录会自动按新规则呈现。
   */
  function openRecent(kind: ImportKind, entry: RecentImport): ImportDoc {
    const doc =
      kind === 'quiz'
        ? parseQuizDoc(entry.raw, entry.filename)
        : parseVocabDoc(entry.raw, entry.filename)
    const withTitle: ImportDoc = doc.title !== '' ? doc : { ...doc, title: entry.title }
    current.value = withTitle
    pending.value = null
    notice.value = null
    return withTitle
  }

  function reset() {
    pending.value = null
    notice.value = null
  }

  function clearCurrent() {
    current.value = null
  }

  return { pending, current, notice, parse, confirm, openRecent, reset, clearCurrent }
}
