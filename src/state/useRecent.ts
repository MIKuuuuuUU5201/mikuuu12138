/**
 * 最近导入的响应式外壳（做题 / 词汇各自独立）。
 *
 * 只负责把 storage 里的「原始文本 + 元数据」搬进 Vue，**不做解析**：
 * 点击某条时由 feature 层拿 entry.raw 去调 parseQuizText / parseVocabText。
 */
import { ref, type Ref } from 'vue'
import { storage } from './storage'
import {
  loadRecent,
  saveRecent,
  type RecentImport,
  type RecentKind,
  type RecentSaveResult
} from '@/core/storage/recent'

const lists: Record<RecentKind, Ref<RecentImport[]>> = {
  quiz: ref<RecentImport[]>([]),
  vocab: ref<RecentImport[]>([])
}

const details: Record<RecentKind, Ref<string | null>> = {
  quiz: ref<string | null>(null),
  vocab: ref<string | null>(null)
}

let initialized = false

function reload(kind: RecentKind) {
  const snapshot = loadRecent(storage, kind)
  lists[kind].value = snapshot.entries
  details[kind].value = snapshot.detail
}

export function useRecent() {
  if (!initialized) {
    initialized = true
    reload('quiz')
    reload('vocab')
  }

  return {
    storageAvailable: storage.available,
    quiz: lists.quiz,
    vocab: lists.vocab,
    detail: (kind: RecentKind) => details[kind],
    /** 记一条导入；返回 ok:false 只表示「没记进最近导入」，不影响本次实际导入 */
    remember(
      kind: RecentKind,
      input: {
        raw: string
        title: string
        filename: string | null
        counts: { accepted: number; skipped: number }
      }
    ): RecentSaveResult {
      const outcome = saveRecent(storage, kind, { ...input, importedAt: Date.now() })
      if (outcome.ok) lists[kind].value = outcome.entries
      return outcome
    },
    reload
  }
}
