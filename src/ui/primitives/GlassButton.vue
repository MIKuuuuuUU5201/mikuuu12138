<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost'
    size?: 'md' | 'lg'
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', disabled: false, block: false }
)

const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    type="button"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block }]"
    :disabled="disabled"
    @click="emit('click')"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: var(--r-pill);
  font-weight: 590;
  letter-spacing: -0.005em;
  background: var(--surface-solid);
  color: var(--text-1);
  transition:
    transform var(--dur-press) ease-out,
    background-color var(--dur-fast) var(--ease-out),
    opacity var(--dur-fast) var(--ease-out);
}

.btn--md {
  height: 40px;
  padding: 0 18px;
  font-size: 15px;
}

.btn--lg {
  height: 50px;
  padding: 0 26px;
  font-size: 17px;
}

.btn--primary {
  background: var(--accent);
  color: #fff;
}

.btn--ghost {
  background: var(--surface-solid);
  border: 1px solid var(--line);
  color: var(--text-1);
}

.btn--block {
  width: 100%;
}

/* 按下立即可见（不等抬起），且用 transform 保证合成层平滑 */
.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* hover 只在真有指针悬停的设备上生效（触屏点完不留下 hover 态） */
@media (hover: hover) and (pointer: fine) {
  .btn--primary:hover:not(:disabled) {
    background: var(--accent-strong);
  }

  .btn--ghost:hover:not(:disabled) {
    background: var(--surface-quiet);
    border-color: var(--line-strong);
  }
}
</style>
