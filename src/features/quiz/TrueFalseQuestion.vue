<script setup lang="ts">
// 判断题：True / False 两个大按钮，点选即判定。
import { computed } from 'vue'
import Icon from '@/ui/primitives/Icon.vue'
import QuestionCard from './QuestionCard.vue'
import type { TrueFalseItem } from '@/core/model/quiz'
import type { Verdict } from '@/core/model/verdict'

const props = defineProps<{
  item: TrueFalseItem
  index: number
  selected: boolean | null
  judged: boolean
  verdict: Verdict | null
  copied: boolean
  copyFailed: boolean
}>()

const emit = defineEmits<{
  (e: 'pick', value: boolean): void
  (e: 'copy'): void
}>()

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong'

function stateOf(value: boolean): OptionState {
  if (props.judged) {
    if (props.item.answer === value) return 'correct'
    return props.selected === value ? 'wrong' : 'idle'
  }
  return props.selected === value ? 'selected' : 'idle'
}

const trueState = computed(() => stateOf(true))
const falseState = computed(() => stateOf(false))
</script>

<template>
  <QuestionCard
    :index="index"
    kind="判断题"
    :judged="judged"
    :verdict="verdict"
    :verdict-text="verdict === 'correct' ? '回答正确' : '回答错误'"
    :explanation="item.explanation ?? null"
    :copied="copied"
    :copy-failed="copyFailed"
    @copy="emit('copy')"
  >
    <p class="prompt">{{ item.prompt }}</p>

    <div class="tf">
      <button
        v-for="option in [
          { value: true, label: 'True', state: trueState },
          { value: false, label: 'False', state: falseState }
        ]"
        :key="option.label"
        type="button"
        class="tf__option"
        :class="`tf__option--${option.state}`"
        :aria-disabled="judged"
        @click="emit('pick', option.value)"
      >
        <span class="tf__label">{{ option.label }}</span>
        <Icon
          v-if="option.state === 'correct'"
          name="check"
          :size="18"
          class="tf__mark tf__mark--correct"
        />
        <Icon
          v-else-if="option.state === 'wrong'"
          name="close"
          :size="18"
          class="tf__mark tf__mark--wrong"
        />
      </button>
    </div>
  </QuestionCard>
</template>

<style scoped>
.prompt {
  font-size: clamp(16px, 4.2vw, 18px);
  font-weight: 500;
  line-height: 1.55;
  letter-spacing: -0.005em;
}

.tf {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

/* 大触控区域：两个按钮各占一半，最小高度 56px */
.tf__option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 56px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-control);
  background: var(--surface-solid);
  transition:
    transform var(--dur-press) ease-out,
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.tf__option:active:not([aria-disabled='true']) {
  transform: scale(0.99);
}

.tf__option[aria-disabled='true'] {
  cursor: default;
}

.tf__label {
  font-size: 16px;
  font-weight: 590;
  letter-spacing: -0.005em;
}

.tf__option--selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.tf__option--correct {
  border-color: rgba(26, 143, 74, 0.45);
  background: var(--correct-soft);
  color: var(--correct);
}

.tf__option--wrong {
  border-color: rgba(200, 54, 47, 0.4);
  background: var(--wrong-soft);
  color: var(--wrong);
}

.tf__mark--correct {
  color: var(--correct);
}

.tf__mark--wrong {
  color: var(--wrong);
}

@media (hover: hover) and (pointer: fine) {
  .tf__option:hover:not([aria-disabled='true']) {
    border-color: var(--line-strong);
    background: var(--surface-quiet);
  }

  .tf__option--selected:hover:not([aria-disabled='true']) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
}
</style>
