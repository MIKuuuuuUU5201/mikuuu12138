<script setup lang="ts">
import GlassCard from '@/ui/primitives/GlassCard.vue'
import Icon from '@/ui/primitives/Icon.vue'
import RecentList from './RecentList.vue'

// 首页 = 4 个入口 + 「最近导入」区块（同页，不单独开路由）
const ENTRIES = [
  { to: '/vocab', icon: 'vocab', label: '背单词', desc: '连续纵向阅读 · 翻译默认隐藏' },
  { to: '/quiz', icon: 'quiz', label: '做题', desc: '选择题 · 判断题 · 完形填空' },
  { to: '/wordbook', icon: 'wordbook', label: '生词本', desc: '本地保存 · 可导入导出' },
  { to: '/import', icon: 'import', label: '导入', desc: '粘贴 / 选择 / 拖拽 JSON' }
]
</script>

<template>
  <div class="stack-lg">
    <GlassCard tone="glass">
      <h2>英语学习</h2>
      <p class="muted">背单词 · 做题 · 生词本 ｜ 纯本地、无账号、无云同步</p>
    </GlassCard>

    <section class="stack">
      <p class="section-label">开始</p>
      <GlassCard v-for="entry in ENTRIES" :key="entry.to" :to="entry.to" interactive>
        <div class="row">
          <span class="entry__icon"><Icon :name="entry.icon" :size="22" /></span>
          <span class="entry__text">
            <span class="entry__label">{{ entry.label }}</span>
            <span class="entry__desc">{{ entry.desc }}</span>
          </span>
          <Icon name="chevron" :size="18" class="entry__chev" />
        </div>
      </GlassCard>
    </section>

    <section class="stack">
      <p class="section-label">最近导入</p>
      <RecentList />
    </section>
  </div>
</template>

<style scoped>
.entry__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-control);
  background: var(--accent-soft);
  color: var(--accent);
  flex: none;
}

.entry__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.entry__label {
  font-size: 16px;
  font-weight: 590;
  letter-spacing: -0.01em;
}

.entry__desc {
  font-size: 13px;
  color: var(--text-3);
}

.entry__chev {
  color: var(--text-3);
  flex: none;
}
</style>
