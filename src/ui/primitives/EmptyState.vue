<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <div class="empty">
    <p class="empty__title">{{ title }}</p>
    <p v-if="hint" class="empty__hint">{{ hint }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  padding: 28px 20px;
  border-radius: var(--r-card);
  border: 1px dashed var(--line-strong);
  background: var(--surface-quiet);
  text-align: center;
}

.empty__title {
  font-size: 16px;
  font-weight: 590;
  letter-spacing: -0.01em;
}

.empty__hint {
  margin-top: 6px;
  font-size: 14px;
  color: var(--text-3);
  line-height: 1.6;
}
</style>
