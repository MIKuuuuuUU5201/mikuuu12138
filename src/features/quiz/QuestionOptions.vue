<script setup lang="ts">
// 选项列表（选择题与完形填空的空共用）。
// 只认识「选项 + 已选 + 正确项 + 是否已判定」，不认识题型，也不做判定。
import { computed } from 'vue'
import Icon from '@/ui/primitives/Icon.vue'
import type { OptionView } from './types'

const props = withDefaults(
  defineProps<{
    options: readonly OptionView[]
    selectedIds: readonly string[]
    /** 判定之后才知道哪些是正确项；未判定时传空数组 */
    correctIds: readonly string[]
    judged: boolean
    compact?: boolean
  }>(),
  { compact: false }
)

const emit = defineEmits<{ (e: 'pick', option: OptionView): void }>()

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong'

function stateOf(option: OptionView): OptionState {
  if (props.judged) {
    if (props.correctIds.includes(option.id)) return 'correct'
    return props.selectedIds.includes(option.id) ? 'wrong' : 'idle'
  }
  return props.selectedIds.includes(option.id) ? 'selected' : 'idle'
}

const states = computed(() => props.options.map((option) => stateOf(option)))

function letterAt(index: number): string {
  return String.fromCharCode(65 + index)
}
</script>

<template>
  <ul class="options" :class="{ 'options--compact': compact }">
    <li v-for="(option, i) in options" :key="option.id">
      <button
        type="button"
        class="option"
        :class="`option--${states[i]}`"
        :aria-disabled="judged"
        @click="emit('pick', option)"
      >
        <span class="option__letter">{{ letterAt(i) }}</span>
        <span class="option__text">{{ option.text }}</span>
        <Icon
          v-if="states[i] === 'correct'"
          name="check"
          :size="18"
          class="option__mark option__mark--correct"
        />
        <Icon
          v-else-if="states[i] === 'wrong'"
          name="close"
          :size="18"
          class="option__mark option__mark--wrong"
        />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.options--compact {
  gap: 6px;
  margin-top: 10px;
}

/* 整行可点：触控区域足够大 */
.option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 50px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-control);
  background: var(--surface-solid);
  text-align: left;
  transition:
    transform var(--dur-press) ease-out,
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.options--compact .option {
  min-height: 44px;
  padding: 9px 12px;
}

/* 按下即响应 */
.option:active:not([aria-disabled='true']) {
  transform: scale(0.99);
}

.option[aria-disabled='true'] {
  cursor: default;
}

.option__letter {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--surface-quiet);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

.option__text {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  line-height: 1.5;
  /* 超长单词 / 连续无空格字符串也必须换行，不能撑出横向滚动 */
  overflow-wrap: break-word;
}

.option__mark {
  flex: none;
}

.option__mark--correct {
  color: var(--correct);
}

.option__mark--wrong {
  color: var(--wrong);
}

/* 选中：只有描边与极浅底色，不用大色块 */
.option--selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.option--selected .option__letter {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
}

.option--correct {
  border-color: rgba(26, 143, 74, 0.45);
  background: var(--correct-soft);
}

.option--correct .option__letter {
  border-color: transparent;
  background: var(--correct);
  color: #fff;
}

.option--wrong {
  border-color: rgba(200, 54, 47, 0.4);
  background: var(--wrong-soft);
}

.option--wrong .option__letter {
  border-color: transparent;
  background: var(--wrong);
  color: #fff;
}

@media (hover: hover) and (pointer: fine) {
  .option:hover:not([aria-disabled='true']) {
    border-color: var(--line-strong);
    background: var(--surface-quiet);
  }

  .option--selected:hover:not([aria-disabled='true']) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
}
</style>
