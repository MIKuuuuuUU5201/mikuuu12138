<script setup lang="ts">
// 纯受控分段控件：不认识业务，只认识 options。
// 键盘行为按真 radiogroup 来：整组只有一个 Tab 停靠点，方向键切换并选中。
import { ref } from 'vue'

const props = defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const items = ref<(HTMLButtonElement | null)[]>([])

function setItem(el: unknown, index: number) {
  items.value[index] = el instanceof HTMLButtonElement ? el : null
}

function move(from: number, step: number) {
  const total = props.options.length
  if (total === 0) return
  const next = (from + step + total) % total
  const option = props.options[next]
  if (option === undefined) return
  emit('update:modelValue', option.value)
  items.value[next]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    move(index, 1)
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(index, -1)
  }
}
</script>

<template>
  <div class="segmented" role="radiogroup">
    <button
      v-for="(opt, index) in options"
      :key="opt.value"
      :ref="(el) => setItem(el, index)"
      type="button"
      role="radio"
      class="segmented__item"
      :class="{ 'segmented__item--on': opt.value === modelValue }"
      :tabindex="opt.value === modelValue ? 0 : -1"
      :aria-checked="opt.value === modelValue"
      @click="emit('update:modelValue', opt.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--r-control);
  background: var(--surface-quiet);
  border: 1px solid var(--line);
}

.segmented__item {
  border: none;
  background: transparent;
  border-radius: calc(var(--r-control) - 3px);
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-2);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.segmented__item--on {
  background: var(--surface-solid);
  color: var(--text-1);
  box-shadow: var(--shadow-1);
}

@media (hover: hover) and (pointer: fine) {
  .segmented__item:not(.segmented__item--on):hover {
    color: var(--text-1);
  }
}
</style>
