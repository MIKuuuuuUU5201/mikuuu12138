<script setup lang="ts">
/**
 * 生词本：永久保存的单词 / 短语集合。
 *
 * 每一项**只有 word / phrase 本身**（不存 translation / example / 来源 / 时间 / 学习进度）。
 * 数据、顺序、去重、导入校验全部来自 state/useWordbook → core/storage/wordbook；
 * 这个页面只负责渲染与交互，自己不算、不去重、不校验。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/ui/primitives/EmptyState.vue'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import GlassCard from '@/ui/primitives/GlassCard.vue'
import InlineBanner from '@/ui/primitives/InlineBanner.vue'
import WordbookImportPanel from './WordbookImportPanel.vue'
import WordbookRow from './WordbookRow.vue'
import { useWordbookTools } from './useWordbookTools'

const router = useRouter()
const {
  words,
  count,
  status,
  detail,
  storageAvailable,
  copiedAll,
  copyFailedAll,
  copied,
  copyFailed,
  removeFailed,
  message,
  importResult,
  copyWord,
  copyAll,
  removeWord,
  exportToFile,
  importFromText,
  resetImportResult
} = useWordbookTools()

const importOpen = ref(false)
const draggedFile = ref<File | null>(null)
const dragging = ref(false)

const hasWords = computed(() => words.value.length > 0)
/** 生词本自身数据有问题（损坏 / 未来版本 / 读不出来）时，只有「导入覆盖」这一条修复通道 */
const broken = computed(() => status.value !== 'ok' && status.value !== 'missing')

function openImport() {
  importOpen.value = true
}

function closeImport() {
  importOpen.value = false
  resetImportResult()
}

function onDragOver() {
  dragging.value = true
  if (!importOpen.value) importOpen.value = true
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file === undefined) return
  draggedFile.value = file
  importOpen.value = true
}
</script>

<template>
  <div
    class="book"
    @dragover.prevent="onDragOver"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <GlassCard tone="glass" class="book__head">
      <h2>生词本</h2>
      <p class="muted">
        永久保存在这台设备上的单词与短语。新加入的排在最前，按大小写与空格不敏感去重。
      </p>
      <p class="book__count">共 {{ count }} 条</p>
      <div class="row row--wrap">
        <GlassButton :disabled="!hasWords" @click="copyAll">
          {{ copiedAll ? '已复制' : '复制全部' }}
        </GlassButton>
        <GlassButton variant="ghost" @click="importOpen ? closeImport() : openImport()">
          {{ importOpen ? '收起导入' : '导入' }}
        </GlassButton>
        <GlassButton variant="ghost" :disabled="!hasWords" @click="exportToFile">导出</GlassButton>
      </div>
      <!-- 一行状态：既是可见反馈，也是 aria-live 播报内容；预留高度避免布局跳动 -->
      <p class="book__status" aria-live="polite">{{ message }}</p>
    </GlassCard>

    <InlineBanner v-if="!storageAvailable" tone="info">
      浏览器本地存储不可用，当前是内存模式：功能照常，关掉页面即失。
    </InlineBanner>
    <InlineBanner v-else-if="broken" tone="warn">
      {{ detail }}（可以导入一份生词本 JSON 覆盖修复）
    </InlineBanner>

    <WordbookImportPanel
      v-if="importOpen"
      :file="draggedFile"
      :result="importResult"
      :dragging="dragging"
      @import="importFromText"
      @clear-file="draggedFile = null"
      @clear-result="resetImportResult"
      @close="closeImport"
    />

    <ul v-if="hasWords" class="book__list">
      <li v-for="word in words" :key="word" class="book__item">
        <WordbookRow
          :word="word"
          :copied="copied === word"
          :copy-failed="copyFailed === word"
          :remove-failed="removeFailed === word"
          @copy="copyWord(word)"
          @remove="removeWord(word)"
        />
      </li>
    </ul>

    <EmptyState
      v-else
      title="还没有生词"
      hint="在「背单词」里点词条右侧的书签图标加入，或导入一份生词本 JSON。"
    >
      <div class="row row--center book__empty-actions">
        <GlassButton @click="openImport">导入生词本</GlassButton>
        <GlassButton variant="ghost" @click="router.push('/vocab')">去背单词</GlassButton>
      </div>
    </EmptyState>

    <p v-if="copyFailedAll" class="book__fail">复制失败，请手动选中文本</p>
  </div>
</template>

<style scoped>
.book {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.book__head h2 {
  font-size: 20px;
}

.book__count {
  margin-top: 8px;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}

.book__status {
  min-height: 18px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-3);
}

.book__fail {
  font-size: 13px;
  color: var(--wrong);
}

.book__list {
  list-style: none;
  padding: 0;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
  background: var(--surface-solid);
  overflow: hidden;
}

.book__item + .book__item {
  border-top: 1px solid var(--line);
}

.book__empty-actions {
  margin-top: 14px;
}
</style>
