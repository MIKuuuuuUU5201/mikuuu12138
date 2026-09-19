<script setup lang="ts">
// 完形填空的段落：把 {{n}} 位置渲染成可读的空位（而不是把标记原样显示），
// 空位里显示用户填的内容；判定后按对错着色。
import { computed } from 'vue'
import type { Verdict } from '@/core/model/verdict'

const props = defineProps<{
  passage: string
  answers: Record<number, string>
  judged: boolean
  blankVerdicts: Record<number, Verdict | null>
}>()

interface Part {
  text: string
  /** null = 普通文本；数字 = 第几个空 */
  index: number | null
}

const parts = computed<Part[]>(() => {
  const out: Part[] = []
  const pattern = /\{\{(\d+)\}\}/g
  let cursor = 0
  let match = pattern.exec(props.passage)

  while (match !== null) {
    if (match.index > cursor) {
      out.push({ text: props.passage.slice(cursor, match.index), index: null })
    }
    out.push({ text: '', index: Number(match[1]) })
    cursor = match.index + match[0].length
    match = pattern.exec(props.passage)
  }

  if (cursor < props.passage.length) {
    out.push({ text: props.passage.slice(cursor), index: null })
  }
  return out
})

function slotState(index: number): 'empty' | 'filled' | 'correct' | 'wrong' {
  const filled = (props.answers[index] ?? '').trim() !== ''
  if (props.judged) {
    const verdict = props.blankVerdicts[index] ?? null
    if (verdict === 'correct') return 'correct'
    if (verdict === 'wrong') return 'wrong'
  }
  return filled ? 'filled' : 'empty'
}
</script>

<template>
  <p class="passage">
    <template v-for="(part, i) in parts" :key="i">
      <template v-if="part.index === null">{{ part.text }}</template>
      <span v-else class="slot" :class="`slot--${slotState(part.index)}`">
        <span class="slot__no">{{ part.index }}</span>
        <span class="slot__text">{{ (answers[part.index] ?? '').trim() }}</span>
      </span>
    </template>
  </p>
</template>

<style scoped>
.passage {
  font-size: clamp(16px, 4.3vw, 18px);
  line-height: 2;
  letter-spacing: -0.005em;
  overflow-wrap: anywhere;
}

/* 空位：看起来像一条待填的横线，而不是一堆花括号 */
.slot {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  min-width: 72px;
  max-width: 100%;
  margin: 0 3px;
  padding: 1px 8px 2px;
  border-bottom: 1.5px solid var(--line-strong);
  border-radius: var(--r-small) var(--r-small) 0 0;
  background: var(--surface-quiet);
  font-weight: 500;
  vertical-align: baseline;
  overflow-wrap: anywhere;
}

.slot__no {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}

.slot--filled {
  border-bottom-color: var(--accent);
  background: var(--accent-soft);
}

.slot--correct {
  border-bottom-color: var(--correct);
  background: var(--correct-soft);
  color: var(--correct);
}

.slot--wrong {
  border-bottom-color: var(--wrong);
  background: var(--wrong-soft);
  color: var(--wrong);
}
</style>
