<script setup lang="ts">
/**
 * 生词本导入面板：粘贴 / 选择文件 / 拖拽 → 交给页面调 state 层验证 → 显示结果。
 *
 * 这里**不做任何校验、不做任何写入**：完整校验与整体覆盖都在 core/storage/wordbook
 * （经 state/useWordbook 门面）。校验不通过时一个字节都不会写，所以这里只负责把原因说清楚。
 * 拖拽由页面根节点统一接（拖到哪都能导入），本组件只负责显示拖拽高亮。
 */
import { computed, ref, watch } from 'vue'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import InlineBanner from '@/ui/primitives/InlineBanner.vue'
import type { ImportOutcome } from './useWordbookTools'

const props = defineProps<{
  /** 页面接到的拖拽文件（消费后由页面清空） */
  file: File | null
  result: ImportOutcome | null
  dragging: boolean
}>()

const emit = defineEmits<{
  (e: 'import', text: string): void
  (e: 'clear-file'): void
  (e: 'clear-result'): void
  (e: 'close'): void
}>()

const MAX_SHOWN_ERRORS = 6

const text = ref('')
const filename = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const canImport = computed(() => text.value.trim() !== '')
const errors = computed(() =>
  props.result !== null && !props.result.ok ? props.result.errors : []
)
const shownErrors = computed(() => errors.value.slice(0, MAX_SHOWN_ERRORS))
const hiddenErrorCount = computed(() => Math.max(0, errors.value.length - MAX_SHOWN_ERRORS))

watch(
  () => props.file,
  async (file) => {
    if (file === null) return
    filename.value = file.name
    text.value = await file.text()
    emit('clear-file')
    emit('import', text.value)
  }
)

function runImport() {
  if (!canImport.value) return
  emit('import', text.value)
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file !== undefined) {
    filename.value = file.name
    void file.text().then((content) => {
      text.value = content
      emit('import', content)
    })
  }
  // 清空 value，否则再次选同一个文件不会触发 change
  input.value = ''
}

function clearAll() {
  text.value = ''
  filename.value = null
  emit('clear-result')
}
</script>

<template>
  <section class="panel">
    <div class="panel__head">
      <p class="panel__title">导入生词本 JSON</p>
      <GlassButton variant="ghost" @click="emit('close')">收起</GlassButton>
    </div>
    <p class="panel__note">
      导入会<strong>整体替换</strong>当前生词本。格式只用导出文件那一种：
      <code>{ "type": "wordbook", "version": 1, "words": [ … ] }</code>。整份验证通过才写入，
      任何一条不合法就整次失败，原来的生词本完全不变。
    </p>

    <InlineBanner v-if="result !== null && result.ok" tone="info">
      已导入 {{ result.count }} 条{{
        result.duplicates > 0 ? `，跳过重复 ${result.duplicates} 条` : ''
      }}，当前生词本已整体替换。
    </InlineBanner>
    <InlineBanner v-else-if="result !== null" tone="warn">
      导入失败，生词本未做任何改动：
      <span v-for="(error, index) in shownErrors" :key="index" class="panel__error">{{
        error
      }}</span>
      <span v-if="hiddenErrorCount > 0" class="panel__error"
        >还有 {{ hiddenErrorCount }} 条问题…</span
      >
    </InlineBanner>

    <textarea
      v-model="text"
      class="paste"
      rows="7"
      spellcheck="false"
      aria-label="粘贴生词本 JSON"
      placeholder='{ "type": "wordbook", "version": 1, "words": ["confidence"] }'
    />
    <div class="row row--wrap">
      <GlassButton :disabled="!canImport" @click="runImport">解析并导入</GlassButton>
      <GlassButton v-if="text !== '' || filename !== null" variant="ghost" @click="clearAll">
        清空
      </GlassButton>
      <span v-if="filename" class="panel__filename">{{ filename }}</span>
    </div>

    <div class="drop" :class="{ 'drop--on': dragging }">
      <p class="drop__text">
        {{ dragging ? '松手即可导入' : '把 .json 文件拖到这里（拖到页面任意位置都行）' }}
      </p>
      <GlassButton variant="ghost" @click="fileInput?.click()">选择文件…</GlassButton>
      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept=".json,application/json"
        @change="onFileChange"
      />
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
  background: var(--surface-solid);
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel__title {
  font-size: 15px;
  font-weight: 590;
  letter-spacing: -0.01em;
}

.panel__note {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-3);
}

.panel__note code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--text-2);
}

.panel__error {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
}

.panel__filename {
  font-size: 13px;
  color: var(--text-3);
}

.paste {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--r-control);
  border: 1px solid var(--line);
  background: var(--surface-solid);
  color: var(--text-1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.6;
  resize: vertical;
  /* 防止 iOS 聚焦输入时把整页放大 */
  font-size: max(13px, 16px);
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
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
  text-align: center;
}

/*
 * 1px 裁剪式隐藏，而不是 display:none：
 * 这样它仍然有可交互的盒子（屏幕阅读器与自动化上传文件都能用），只是看不见。
 */
.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  clip-path: inset(50%);
  overflow: hidden;
}
</style>
