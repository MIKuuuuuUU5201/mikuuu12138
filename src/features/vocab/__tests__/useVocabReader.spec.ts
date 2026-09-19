/**
 * 词汇阅读器的交互规则测试。
 *
 * 这里只测逻辑：显示/隐藏的语义、全局开关、复制内容、生词本委托、以及给屏幕阅读器的提示。
 * 滚动进度与真实指针交互属于浏览器行为，靠实际交互验证（见 README 验证记录）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { VocabItem } from '@/core/model/vocab'
import { useWordbook } from '@/state/useWordbook'
import { COPY_FEEDBACK_MS, useVocabReader } from '../useVocabReader'

function item(id: string, word: string, translation: string | null = `${word} 的翻译`): VocabItem {
  return { id, word, example: `${word} in a sentence.`, translation }
}

const ITEMS: VocabItem[] = [
  item('v1', 'confidence'),
  item('v2', 'private'),
  item('v3', 'in my opinion')
]

interface Harness {
  reader: ReturnType<typeof useVocabReader>
  saved: Set<string>
  copied: string[]
  failCopy: boolean
  failSave: boolean
}

function harness(items: VocabItem[] = ITEMS): Harness {
  const state: Harness = {
    reader: null as unknown as ReturnType<typeof useVocabReader>,
    saved: new Set<string>(),
    copied: [],
    failCopy: false,
    failSave: false
  }

  state.reader = useVocabReader(() => items, {
    isSaved: (word) => state.saved.has(word),
    toggleSaved: (word) => {
      if (state.failSave) return { ok: false, added: false }
      const added = !state.saved.has(word)
      if (added) state.saved.add(word)
      else state.saved.delete(word)
      return { ok: true, added }
    },
    writeText: async (text) => {
      if (state.failCopy) return false
      state.copied.push(text)
      return true
    }
  })

  return state
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('词汇阅读器：显示 / 隐藏翻译', () => {
  it('默认全部隐藏', () => {
    const { reader } = harness()
    expect(reader.isRevealed('v1')).toBe(false)
    expect(reader.allRevealed.value).toBe(false)
  })

  it('单个词可以独立显示与再次隐藏，互不影响', () => {
    const { reader } = harness()
    reader.toggleReveal('v2')
    expect(reader.isRevealed('v2')).toBe(true)
    expect(reader.isRevealed('v1')).toBe(false)

    reader.toggleReveal('v2')
    expect(reader.isRevealed('v2')).toBe(false)
  })

  it('全局开关：还有隐藏的就全部显示，已全部显示则全部隐藏', () => {
    const { reader } = harness()

    reader.toggleAllReveal()
    expect(ITEMS.every((entry) => reader.isRevealed(entry.id))).toBe(true)
    expect(reader.allRevealed.value).toBe(true)

    reader.toggleAllReveal()
    expect(ITEMS.every((entry) => reader.isRevealed(entry.id))).toBe(false)
    expect(reader.allRevealed.value).toBe(false)
  })

  it('单个显示之后按全局 → 全部显示；再按一次 → 全部隐藏', () => {
    const { reader } = harness()
    reader.toggleReveal('v3')
    expect(reader.allRevealed.value).toBe(false)

    reader.toggleAllReveal()
    expect(reader.allRevealed.value).toBe(true)

    reader.toggleAllReveal()
    expect(reader.allRevealed.value).toBe(false)
  })

  it('空词表时全局开关不炸、也不显示任何东西', () => {
    const { reader } = harness([])
    reader.toggleAllReveal()
    expect(reader.allRevealed.value).toBe(false)
  })

  it('换一份词表会重置显示状态（新的一次阅读会话）', async () => {
    const target = ref(ITEMS)
    const reader = useVocabReader(() => target.value, {
      isSaved: () => false,
      toggleSaved: () => ({ ok: true, added: true }),
      writeText: async () => true
    })
    reader.toggleAllReveal()
    expect(reader.allRevealed.value).toBe(true)

    target.value = [item('v9', 'another')]
    await nextTick()
    expect(reader.isRevealed('v9')).toBe(false)
    expect(reader.allRevealed.value).toBe(false)
  })
})

describe('词汇阅读器：当前词（键盘作用对象）', () => {
  it('默认跟随视口中心；悬停时以悬停为准，移开后回到中心', () => {
    const { reader } = harness()
    reader.setCenter('v2')
    expect(reader.activeId.value).toBe('v2')

    reader.setHover('v3')
    expect(reader.activeId.value).toBe('v3')

    reader.setHover(null)
    expect(reader.activeId.value).toBe('v2')
  })
})

describe('词汇阅读器：复制', () => {
  it('只复制 word / phrase 本身，不带例句与翻译', async () => {
    const state = harness()
    await state.reader.copy(ITEMS[2]!)
    expect(state.copied).toEqual(['in my opinion'])
  })

  it('复制成功后该条进入 copied 反馈态，并在超时后自动恢复', async () => {
    vi.useFakeTimers()
    const state = harness()
    await state.reader.copy(ITEMS[0]!)

    expect(state.reader.copiedId.value).toBe('v1')
    expect(state.reader.message.value).toContain('已复制')

    vi.advanceTimersByTime(COPY_FEEDBACK_MS)
    expect(state.reader.copiedId.value).toBeNull()
  })

  it('复制失败时不冒充成功，只提示失败', async () => {
    const state = harness()
    state.failCopy = true
    const ok = await state.reader.copy(ITEMS[0]!)

    expect(ok).toBe(false)
    expect(state.reader.copiedId.value).toBeNull()
    expect(state.reader.message.value).toContain('复制失败')
  })
})

describe('词汇阅读器：生词本（走 state/useWordbook 的规则）', () => {
  it('加入与移除都按 word 去重，且反馈说明是加了还是移了', () => {
    const state = harness()

    expect(state.reader.toggleSave(ITEMS[0]!).added).toBe(true)
    expect(state.reader.isSaved(ITEMS[0]!)).toBe(true)
    expect(state.reader.message.value).toContain('已加入生词本')

    expect(state.reader.toggleSave(ITEMS[0]!).added).toBe(false)
    expect(state.reader.isSaved(ITEMS[0]!)).toBe(false)
    expect(state.reader.message.value).toContain('已从生词本移除')
  })

  it('大小写与多余空格不影响「已收藏」的判断（不注入 deps，走真实 state/useWordbook）', () => {
    const wordbook = useWordbook()
    const reader = useVocabReader(() => ITEMS)
    try {
      reader.toggleSave(item('a', '  Confidence '))
      expect(reader.isSaved(item('b', 'confidence'))).toBe(true)
      expect(reader.isSaved(item('c', 'CONFIDENCE'))).toBe(true)
      expect(wordbook.has('confidence')).toBe(true)
    } finally {
      wordbook.remove('  Confidence ')
    }
    expect(reader.isSaved(item('b', 'confidence'))).toBe(false)
  })

  it('写入失败时不改状态，也不谎报成功', () => {
    const state = harness()
    state.failSave = true
    const outcome = state.reader.toggleSave(ITEMS[1]!)

    expect(outcome.ok).toBe(false)
    expect(state.reader.isSaved(ITEMS[1]!)).toBe(false)
    expect(state.reader.message.value).toContain('失败')
  })
})
