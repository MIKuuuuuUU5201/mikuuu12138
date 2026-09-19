<script setup lang="ts">
/**
 * 导入页：粘贴 / 选择文件 / 拖拽 → state 层解析 → 报告 → 确认后进入对应入口。
 *
 * 这个 View 里没有任何解析或存储逻辑：全部通过 state/useImport（它再调 core）完成。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import GlassCard from '@/ui/primitives/GlassCard.vue'
import InlineBanner from '@/ui/primitives/InlineBanner.vue'
import SegmentedControl from '@/ui/primitives/SegmentedControl.vue'
import ImportReportPanel from './ImportReportPanel.vue'
import { useImportFlow, type ImportKind } from '@/state/useImport'

const router = useRouter()
const { pending, parse, confirm, reset } = useImportFlow()

const kind = ref<ImportKind>('quiz')
const text = ref('')
const filename = ref<string | null>(null)
const dragging = ref(false)
const rejection = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const OPTIONS = [
  { value: 'quiz', label: '做题 JSON' },
  { value: 'vocab', label: '词汇 JSON' }
]

const canParse = computed(() => text.value.trim() !== '')

function runParse() {
  rejection.value = null
  parse(kind.value, text.value, filename.value)
}

function pickFile() {
  fileInput.value?.click()
}

/** 选文件 / 拖文件都直接解析，省掉一次点击 */
async function useFile(file: File) {
  filename.value = file.name
  text.value = await file.text()
  runParse()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file !== undefined) void useFile(file)
  // 清空 value，否则再次选择同一个文件不会触发 change
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file !== undefined) void useFile(file)
}

function clearAll() {
  text.value = ''
  filename.value = null
  rejection.value = null
  reset()
}

function start() {
  const outcome = confirm()
  if (!outcome.ok) {
    rejection.value = outcome.notice
    return
  }
  void router.push(outcome.kind === 'quiz' ? '/quiz' : '/vocab')
}
</script>

<template>
  <div
    class="stack-lg"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <GlassCard tone="glass">
      <h2>导入</h2>
      <p class="muted">
        粘贴 JSON、选择 .json
        文件，或把文件拖进来。宽松兼容：能安全识别的都导入，识别不了的跳过并列出原因，绝不猜答案。
      </p>
    </GlassCard>

    <SegmentedControl v-model="kind" :options="OPTIONS" />

    <ImportReportPanel v-if="pending" :doc="pending" @start="start" />
    <InlineBanner v-if="rejection" tone="warn">{{ rejection }}</InlineBanner>

    <section class="stack">
      <p class="section-label">粘贴 JSON</p>
      <textarea
        v-model="text"
        class="paste"
        rows="8"
        spellcheck="false"
        placeholder='{ "title": "Lesson 01", "questions": [ … ] }'
      />
      <div class="row row--wrap">
        <GlassButton :disabled="!canParse" @click="runParse">解析并预览</GlassButton>
        <GlassButton v-if="text !== ''" variant="ghost" @click="clearAll">清空</GlassButton>
        <span v-if="filename" class="filename">{{ filename }}</span>
      </div>
    </section>

    <section class="stack">
      <p class="section-label">文件</p>
      <div class="drop" :class="{ 'drop--on': dragging }">
        <p class="drop__text">{{ dragging ? '松手即可导入' : '把 .json 文件拖到这里' }}</p>
        <GlassButton variant="ghost" @click="pickFile">选择文件…</GlassButton>
        <input
          ref="fileInput"
          class="hidden-input"
          type="file"
          accept=".json,application/json"
          @change="onFileChange"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.paste {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--r-control);
  border: 1px solid var(--line);
  background: var(--surface-solid);
  color: var(--text-1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  /* 防止 iOS 聚焦输入时把整页放大 */
  font-size: max(13px, 16px);
}

.paste:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.filename {
  font-size: 13px;
  color: var(--text-3);
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-radius: var(--r-card);
  border: 1.5px dashed var(--line-strong);
  background: var(--surface-quiet);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.drop--on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.drop__text {
  font-size: 14px;
  color: var(--text-2);
}

.hidden-input {
  display: none;
}
</style>
