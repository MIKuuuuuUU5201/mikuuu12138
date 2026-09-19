<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { RouterLink } from 'vue-router'
import { NAV_ITEMS } from '@/app/nav'
import Icon from '@/ui/primitives/Icon.vue'

// iPhone 上的导航：顶部液态玻璃（标题行 + 可横向滚动的导航行）。
// 刻意不做底部标签栏。桌面 / iPad 用左侧栏（NavSideBar）。
const route = useRoute()
const title = computed(() => (route.meta.title as string | undefined) ?? '英语学习')
</script>

<template>
  <header class="topbar">
    <div class="topbar__title-row">
      <h1 class="topbar__title">{{ title }}</h1>
    </div>
    <nav class="topbar__nav" aria-label="主导航">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.path"
        :to="item.path"
        class="topbar__item"
        active-class="topbar__item--on"
      >
        <Icon :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  /* 安全区：内容不从刘海下面钻出来 */
  padding-top: var(--safe-t);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--blur-strong)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(180%);
  border-bottom: 1px solid var(--glass-edge);
}

.topbar__title-row {
  display: flex;
  align-items: center;
  height: var(--topbar-h);
  padding: 0 16px;
}

.topbar__title {
  font-size: 17px;
  letter-spacing: -0.01em;
}

.topbar__nav {
  display: flex;
  gap: 6px;
  align-items: center;
  height: var(--navrow-h);
  padding: 0 12px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.topbar__nav::-webkit-scrollbar {
  display: none;
}

.topbar__item {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.005em;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.topbar__item:active {
  transform: scale(0.97);
}

.topbar__item--on {
  color: var(--accent);
  background: var(--accent-soft);
}

@media (hover: hover) and (pointer: fine) {
  .topbar__item:hover {
    background: var(--row-hover);
    color: var(--text-1);
  }

  .topbar__item--on:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
}
</style>
