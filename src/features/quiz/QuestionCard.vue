<script setup lang="ts">
// 通用题卡外壳：题号 / 题型标签 / 判定胶囊 / 复制按钮 / 解析区。
// 三种题型的差异都在各自组件里，这里只管共用的结构与样式。
import IconButton from '@/ui/primitives/IconButton.vue'
import type { Verdict } from '@/core/model/verdict'

defineProps<{
  index: number
  kind: string
  judged: boolean
  verdict: Verdict | null
  verdictText: string
  explanation: string | null
  copied: boolean
  copyFailed: boolean
}>()

const emit = defineEmits<{ (e: 'copy'): void }>()
</script>

<template>
  <article class="qcard">
    <header class="qcard__head">
      <span class="qcard__no">{{ index }}</span>
      <span class="qcard__kind">{{ kind }}</span>
      <span
        v-if="judged && verdict !== null"
        class="qcard__verdict"
        :class="`qcard__verdict--${verdict}`"
        >{{ verdictText }}</span
      >
      <span class="qcard__grow" />
      <span v-if="copyFailed" class="qcard__copyfail">复制失败</span>
      <IconButton
        variant="quiet"
        :icon="copied ? 'check' : 'copy'"
        :size="34"
        :highlight="copied"
        label="复制这道题（不含正确答案与解析）"
        hint="复制题目、选项与我的答案"
        @click="emit('copy')"
      />
    </header>

    <div class="qcard__body">
      <slot />
    </div>

    <div v-if="judged && explanation" class="qcard__explain">
      <p class="qcard__explain-label">解析</p>
      <p class="qcard__explain-text">{{ explanation }}</p>
    </div>
  </article>
</template>

<style scoped>
.qcard {
  padding: 20px 0 22px;
}

.qcard__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qcard__no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--surface-quiet);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.qcard__kind {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.02em;
}

.qcard__grow {
  flex: 1;
}

/* 剪贴板被浏览器拒绝时的唯一提示：一行小字，不做 toast */
.qcard__copyfail {
  font-size: 12px;
  color: var(--wrong);
}

.qcard__verdict {
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 590;
  letter-spacing: -0.005em;
}

.qcard__verdict--correct {
  color: var(--correct);
  background: var(--correct-soft);
}

.qcard__verdict--wrong {
  color: var(--wrong);
  background: var(--wrong-soft);
}

.qcard__body {
  margin-top: 12px;
}

.qcard__explain {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--r-control);
  background: var(--surface-quiet);
}

.qcard__explain-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.04em;
}

.qcard__explain-text {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-2);
  overflow-wrap: anywhere;
}
</style>
