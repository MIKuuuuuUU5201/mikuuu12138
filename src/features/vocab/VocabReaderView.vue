<script setup lang="ts">
/**
 * 背单词：把导进来的词表当成一条连续的纵向阅读流。
 *
 * 没有「下一词」按钮、没有翻卡模式、没有底部标签栏；
 * 翻译默认隐藏，靠每个词右侧的眼睛按钮或左上角的眼睛做全局开关。
 *
 * 这里只组装：数据来自 state/useImport，交互状态来自 useVocabReader（它再接 useWordbook）。
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComponentPublicInstance
} from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/ui/primitives/EmptyState.vue'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import InlineBanner from '@/ui/primitives/InlineBanner.vue'
import { useImportFlow } from '@/state/useImport'
import ReaderHud from './ReaderHud.vue'
import VocabEntry from './VocabEntry.vue'
import { useVocabReader } from './useVocabReader'

const router = useRouter()
const { current, notice } = useImportFlow()

const doc = computed(() => (current.value?.kind === 'vocab' ? current.value : null))
const items = computed(() => doc.value?.report.accepted ?? [])

const {
  allRevealed,
  activeId,
  copiedId,
  message,
  isRevealed,
  toggleReveal,
  toggleAllReveal,
  isSaved,
  toggleSave,
  copy,
  setHover,
  setCenter
} = useVocabReader(() => items.value)

/* ── 「当前词」跟随视口中心 ──
   一次性量好每条的文档坐标并缓存，滚动时只做一次比较，不在每帧里读布局。 */
const entryEls = new Map<string, HTMLElement>()
const offsets = ref<{ id: string; top: number }[]>([])
let frame = 0

function setEntryRef(id: string, el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLElement) entryEls.set(id, el)
  else entryEls.delete(id)
}

function measure(): void {
  const list: { id: string; top: number }[] = []
  for (const [id, el] of entryEls) {
    list.push({ id, top: el.getBoundingClientRect().top + window.scrollY })
  }
  list.sort((a, b) => a.top - b.top)
  offsets.value = list
}

function updateCenter(): void {
  if (offsets.value.length === 0) {
    setCenter(null)
    return
  }
  const center = window.scrollY + window.innerHeight / 2
  let currentId: string | null = offsets.value[0]?.id ?? null
  for (const entry of offsets.value) {
    if (entry.top <= center) currentId = entry.id
    else break
  }
  setCenter(currentId)
}

function scheduleCenter(): void {
  if (frame !== 0) return
  frame = requestAnimationFrame(() => {
    frame = 0
    updateCenter()
  })
}

function onResize(): void {
  measure()
  scheduleCenter()
}

/* ── Mac 上的键盘快捷键：G 全局翻译，C 复制当前词，W 加/移生词本 ── */
function onKeydown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
  const target = event.target as HTMLElement | null
  if (target !== null) {
    if (target.isContentEditable || target.tagName === 'TEXTAREA') return
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') return
  }

  const key = event.key.toLowerCase()
  if (key === 'g') {
    event.preventDefault()
    toggleAllReveal()
    return
  }
  if (key !== 'c' && key !== 'w') return

  const item = items.value.find((entry) => entry.id === activeId.value)
  if (item === undefined) return
  event.preventDefault()
  if (key === 'c') void copy(item)
  else toggleSave(item)
}

onMounted(async () => {
  await nextTick()
  measure()
  updateCenter()
  window.addEventListener('scroll', scheduleCenter, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleCenter)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
  if (frame !== 0) cancelAnimationFrame(frame)
})

// 重新导入一份词表后重新量一次
watch(
  () => items.value.length,
  async () => {
    await nextTick()
    measure()
    updateCenter()
  }
)

const emptyTitle = computed(() =>
  current.value === null ? '还没有可阅读的词汇' : '当前导入的是题目，不是词表'
)
</script>

<template>
  <div v-if="doc === null" class="stack-lg">
    <InlineBanner v-if="notice" tone="warn">{{ notice }}</InlineBanner>
    <EmptyState
      :title="emptyTitle"
      hint="先导入一份词汇 JSON（粘贴、选择文件或拖拽都行），再回到这里。"
    >
      <GlassButton class="empty-cta" @click="router.push('/import')">去导入</GlassButton>
    </EmptyState>
  </div>

  <div v-else class="reader">
    <ReaderHud :all-revealed="allRevealed" @toggle-all="toggleAllReveal" />

    <!-- 操作反馈只念给屏幕阅读器听，界面上不出现文字 -->
    <p class="sr-only" aria-live="polite">{{ message }}</p>

    <p v-if="doc.title" class="reader__title">{{ doc.title }}</p>

    <ul class="reader__list" @mouseleave="setHover(null)">
      <li
        v-for="item in items"
        :key="item.id"
        :ref="(el) => setEntryRef(item.id, el)"
        class="reader__item"
      >
        <VocabEntry
          :item="item"
          :revealed="isRevealed(item.id)"
          :saved="isSaved(item)"
          :copied="copiedId === item.id"
          :active="activeId === item.id"
          @toggle-reveal="toggleReveal(item.id)"
          @copy="copy(item)"
          @toggle-save="toggleSave(item)"
          @hover="setHover(item.id)"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.reader {
  /* 阅读列：手机占满，宽屏居中并限制阅读宽度 */
  max-width: 720px;
  margin: 0 auto;
}

.reader__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.04em;
  margin-bottom: 2px;
  /* 词表标题来自导入文件，同样不允许撑出横向滚动 */
  overflow-wrap: anywhere;
}

.reader__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.reader__item {
  border-bottom: 1px solid var(--line);
}

.reader__item:last-child {
  border-bottom: none;
}

.empty-cta {
  margin-top: 16px;
}
</style>
