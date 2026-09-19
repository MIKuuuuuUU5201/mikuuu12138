<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { NAV_ITEMS } from '@/app/nav'
import Icon from '@/ui/primitives/Icon.vue'
</script>

<template>
  <nav class="nav" aria-label="主导航">
    <RouterLink
      v-for="item in NAV_ITEMS"
      :key="item.path"
      :to="item.path"
      class="nav__item"
      active-class="nav__item--on"
      :aria-label="item.label"
    >
      <Icon :name="item.icon" :size="22" />
      <span class="nav__label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.nav {
  flex-direction: column;
  gap: 4px;
  padding: 14px 10px;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--blur-strong)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(180%);
  border-right: 1px solid var(--line);
}

.nav__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--r-control);
  color: var(--text-2);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.005em;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.nav__item:active {
  transform: scale(0.97);
}

.nav__item--on {
  color: var(--accent);
  background: var(--accent-soft);
}

.nav__label {
  white-space: nowrap;
}

@media (hover: hover) and (pointer: fine) {
  .nav__item:hover {
    background: var(--row-hover);
    color: var(--text-1);
  }

  .nav__item--on:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
}
</style>
