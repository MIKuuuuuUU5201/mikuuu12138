<script setup lang="ts">
/**
 * 最近导入列表：点击某条 → 交给 state 层用它的 raw 重新 parse → 进入对应入口。
 * 这里不解析、不落盘，也不提供手动删除（产品要求：只做自动淘汰）。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/ui/primitives/EmptyState.vue'
import GlassCard from '@/ui/primitives/GlassCard.vue'
import Icon from '@/ui/primitives/Icon.vue'
import { readCounts, RECENT_LIMIT, type RecentImport, type RecentKind } from '@/core/storage/recent'
import { useImportFlow } from '@/state/useImport'
import { useRecent } from '@/state/useRecent'

const router = useRouter()
const recent = useRecent()
const flow = useImportFlow()

const groups = computed(() => [
  { kind: 'quiz' as RecentKind, label: '做题', entries: recent.quiz.value },
  { kind: 'vocab' as RecentKind, label: '词汇', entries: recent.vocab.value }
])

const total = computed(() => groups.value.reduce((sum, group) => sum + group.entries.length, 0))

function formatTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

function open(kind: RecentKind, entry: RecentImport) {
  flow.openRecent(kind, entry)
  void router.push(kind === 'quiz' ? '/quiz' : '/vocab')
}
</script>

<template>
  <EmptyState
    v-if="total === 0"
    title="还没有记录"
    hint="导入后，做题与词汇 JSON 会各自保留最近 5 条，点开时用原始 JSON 重新解析。"
  />

  <template v-else>
    <div v-for="group in groups" :key="group.kind" class="stack">
      <p v-if="group.entries.length > 0" class="section-label">
        {{ group.label }} · {{ group.entries.length }}/{{ RECENT_LIMIT }}
      </p>
      <GlassCard
        v-for="entry in group.entries"
        :key="entry.id"
        interactive
        @click="open(group.kind, entry)"
      >
        <div class="row">
          <span class="entry__text">
            <span class="entry__title">{{ entry.title !== '' ? entry.title : '(无标题)' }}</span>
            <span class="entry__meta">
              {{ entry.filename ?? '粘贴导入' }} · {{ formatTime(entry.importedAt) }}
            </span>
            <span class="entry__counts">
              导入 {{ readCounts(entry).accepted }} 条<template
                v-if="readCounts(entry).skipped > 0"
              >
                · 跳过 {{ readCounts(entry).skipped }} 条</template
              >
            </span>
          </span>
          <Icon name="chevron" :size="18" class="entry__chev" />
        </div>
      </GlassCard>
    </div>
  </template>
</template>

<style scoped>
.entry__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.entry__title {
  font-size: 15px;
  font-weight: 590;
  letter-spacing: -0.01em;
  /* 超长标题最多两行，不做单行截断（那是内容损失），也不会撑出横向滚动 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.entry__meta,
.entry__counts {
  font-size: 12px;
  color: var(--text-3);
}

.entry__chev {
  color: var(--text-3);
  flex: none;
}
</style>
