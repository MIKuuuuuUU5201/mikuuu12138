<script setup lang="ts">
import { RouterLink } from 'vue-router'

// 容器卡片。tone 默认 plain（实色 + 细边框）——玻璃是少数派，只给需要浮在内容之上的地方用。
withDefaults(
  defineProps<{
    tone?: 'plain' | 'glass'
    to?: string
    interactive?: boolean
  }>(),
  { tone: 'plain', interactive: false, to: undefined }
)
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="card"
    :class="[`card--${tone}`, { 'card--interactive': interactive || !!to }]"
  >
    <slot />
  </component>
</template>

<style scoped>
.card {
  display: block;
  padding: 16px;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
  color: inherit;
  background: var(--surface-solid);
  box-shadow: var(--shadow-1);
  transition:
    transform var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.card--glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--blur)) saturate(180%);
  border-color: var(--glass-edge);
  box-shadow: var(--shadow-2);
}

.card--interactive:active {
  transform: scale(0.985);
  box-shadow: var(--shadow-1);
}

/* 可点卡片在指针设备上轻微抬起，明确「这里可以点」 */
@media (hover: hover) and (pointer: fine) {
  .card--interactive:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-2);
    border-color: var(--line-strong);
  }
}
</style>
