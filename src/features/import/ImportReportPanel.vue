<script setup lang="ts">
/**
 * 导入报告面板：只负责展示 state 层给的报告，以及把「开始」按钮的点击往上抛。
 * 它不解析、不落盘、不认识 parser 规则。
 */
import { computed, ref } from 'vue'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import GlassCard from '@/ui/primitives/GlassCard.vue'
import Icon from '@/ui/primitives/Icon.vue'
import { FATAL_REASON_LABEL, SKIP_REASON_LABEL, summarize } from '@/core/parse/report'
import { countByKind } from '@/core/model/quiz'
import type { ImportDoc } from '@/state/useImport'

const props = defineProps<{ doc: ImportDoc }>()
const emit = defineEmits<{ (e: 'start'): void }>()

const showSkipped = ref(false)

const summary = computed(() => summarize(props.doc.report))
const fatal = computed(() => props.doc.report.fatal)
const skipped = computed(() => props.doc.report.skipped)

/** 题型分布（只有做题 JSON 才有意义） */
const kindBreakdown = computed(() => {
  if (props.doc.kind !== 'quiz') return null
  const counts = countByKind(props.doc.report.accepted)
  return [
    { label: '选择题', value: counts.choice },
    { label: '判断题', value: counts['true-false'] },
    { label: '完形填空', value: counts.cloze }
  ].filter((entry) => entry.value > 0)
})
</script>

<template>
  <GlassCard tone="glass" class="report">
    <template v-if="fatal">
      <p class="report__headline report__headline--bad">无法导入</p>
      <p class="report__detail">{{ FATAL_REASON_LABEL[fatal.reason] }}：{{ fatal.detail }}</p>
      <p class="report__hint">整个文件都不可用，没有任何内容被导入。</p>
    </template>

    <template v-else>
      <p class="report__headline">
        <span class="report__ok">成功导入 {{ summary.accepted }} 条</span>
        <span v-if="summary.skipped > 0" class="report__skip">· 跳过 {{ summary.skipped }} 条</span>
      </p>

      <p v-if="doc.title" class="report__title">{{ doc.title }}</p>

      <ul v-if="kindBreakdown" class="report__breakdown">
        <li v-for="entry in kindBreakdown" :key="entry.label">
          {{ entry.label }} {{ entry.value }}
        </li>
      </ul>

      <p v-if="summary.accepted === 0" class="report__hint">
        没有可安全识别的内容，因此不会导入任何东西——无法唯一判断的条目一律跳过，不猜答案。
      </p>

      <div v-if="skipped.length > 0" class="report__skipped">
        <button type="button" class="report__toggle" @click="showSkipped = !showSkipped">
          <Icon
            name="chevron"
            :size="16"
            class="report__chev"
            :class="{ 'report__chev--open': showSkipped }"
          />
          查看被跳过的 {{ skipped.length }} 条
        </button>
        <ul v-if="showSkipped" class="report__list">
          <li v-for="entry in skipped" :key="entry.index">
            <p class="report__list-head">
              #{{ entry.index + 1 }} · {{ SKIP_REASON_LABEL[entry.reason] }}
            </p>
            <p class="report__list-detail">{{ entry.detail }}</p>
            <p class="report__list-preview">{{ entry.preview }}</p>
          </li>
        </ul>
      </div>

      <div class="report__actions">
        <GlassButton :disabled="summary.accepted === 0" block size="lg" @click="emit('start')">
          {{ doc.kind === 'quiz' ? '开始做题' : '开始背单词' }}
        </GlassButton>
      </div>
    </template>
  </GlassCard>
</template>

<style scoped>
.report__headline {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.report__headline--bad {
  color: var(--wrong);
}

.report__ok {
  color: var(--correct);
}

.report__skip {
  color: var(--text-2);
  font-weight: 500;
}

.report__title {
  margin-top: 4px;
  font-size: 14px;
  color: var(--text-2);
  overflow-wrap: anywhere;
}

.report__detail,
.report__hint {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.report__breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.report__breakdown li {
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--surface-quiet);
  border: 1px solid var(--line);
  font-size: 12px;
  color: var(--text-2);
}

.report__skipped {
  margin-top: 12px;
}

.report__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
}

.report__chev {
  transform: rotate(0deg);
  transition: transform var(--dur-fast) var(--ease-out);
}

.report__chev--open {
  transform: rotate(90deg);
}

.report__list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report__list-head {
  font-size: 13px;
  font-weight: 590;
}

.report__list-detail {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.report__list-preview {
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--text-3);
  word-break: break-all;
}

.report__actions {
  margin-top: 14px;
}
</style>
