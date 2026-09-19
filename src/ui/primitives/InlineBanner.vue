<script setup lang="ts">
// 轻量提示条：用于「最近导入没记上」这类不阻塞流程的提示
withDefaults(defineProps<{ tone?: 'info' | 'warn' }>(), { tone: 'info' })
</script>

<template>
  <p class="banner" :class="`banner--${tone}`" role="status">
    <slot />
  </p>
</template>

<style scoped>
.banner {
  padding: 10px 14px;
  border-radius: var(--r-control);
  font-size: 13px;
  line-height: 1.6;
}

.banner--info {
  background: var(--accent-soft);
  color: var(--text-1);
}

.banner--warn {
  background: var(--wrong-soft);
  color: var(--text-1);
}
</style>
