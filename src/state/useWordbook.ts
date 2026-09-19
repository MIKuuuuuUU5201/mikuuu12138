/**
 * 生词本的响应式外壳。
 *
 * 这里是**唯一**允许把存储接到 Vue 的地方：页面只通过它读写，不直接碰 localStorage。
 * 用 Vue 原生的 ref/computed，不引入 Pinia（本项目没有这个依赖，不为它增加复杂度）。
 *
 * 写入纪律：先写盘成功再更新 ref（见 updateWordbook），失败时 ref 保持旧值。
 */
import { computed, ref } from 'vue'
import { storage } from './storage'
import {
  addWord,
  buildLookup,
  exportJson,
  importWordbook,
  loadWordbook,
  removeWord,
  toggleWord,
  updateWordbook,
  wordKey,
  type WordbookSnapshot
} from '@/core/storage/wordbook'
import type { WriteResult } from '@/core/storage/local'

const words = ref<string[]>([])
const status = ref<WordbookSnapshot['status']>('missing')
const detail = ref<string | null>(null)
let initialized = false

function applySnapshot(snapshot: WordbookSnapshot) {
  words.value = snapshot.words
  status.value = snapshot.status
  detail.value = snapshot.detail
}

export function useWordbook() {
  if (!initialized) {
    initialized = true
    applySnapshot(loadWordbook(storage))
  }

  const lookup = computed(() => buildLookup(words.value))

  function add(text: string): WriteResult {
    const outcome = updateWordbook(storage, (current) => addWord(current, text))
    words.value = outcome.words
    return outcome.result
  }

  function remove(text: string): WriteResult {
    const outcome = updateWordbook(storage, (current) => removeWord(current, text))
    words.value = outcome.words
    return outcome.result
  }

  function toggle(text: string): { result: WriteResult; added: boolean } {
    let added = false
    const outcome = updateWordbook(storage, (current) => {
      const next = toggleWord(current, text)
      added = next.added
      return next.words
    })
    words.value = outcome.words
    return { result: outcome.result, added: outcome.result.ok ? added : false }
  }

  return {
    /** false = 当前处在内存降级模式（存储不可用），数据关掉页面即失 */
    storageAvailable: storage.available,
    words,
    status,
    detail,
    count: computed(() => words.value.length),
    has: (text: string) => lookup.value.has(wordKey(text)),
    add,
    remove,
    toggle,
    importJson(text: string) {
      const outcome = importWordbook(storage, text)
      if (outcome.ok) {
        applySnapshot({ status: 'ok', words: outcome.words, detail: null })
      }
      return outcome
    },
    exportJson: () => exportJson(words.value),
    reload: () => applySnapshot(loadWordbook(storage))
  }
}
