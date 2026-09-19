<script setup lang="ts">
import { computed } from 'vue'

// 内联 SVG 图标集（不引入 @mdi/font 这类图标字体，少一个依赖、少一次请求）
const PATHS: Record<string, string[]> = {
  home: ['M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.4v-5.6H9.4V21H5a1 1 0 0 1-1-1z'],
  import: ['M12 3v10', 'm8.5 9.5 3.5 3.5 3.5-3.5', 'M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'],
  quiz: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'm8.4 12.2 2.6 2.6 4.6-5.2'],
  vocab: [
    'M12 6.6C10.4 5.3 8.3 4.5 5.5 4.5H4v13h1.5c2.8 0 4.9.7 6.5 2 1.6-1.3 3.7-2 6.5-2H20v-13h-1.5c-2.8 0-4.9.8-6.5 2.1z',
    'M12 6.6v13'
  ],
  wordbook: ['M6.5 4.5h11v16l-5.5-4-5.5 4z'],
  chevron: ['m9.5 7 5 5-5 5'],
  // 以下三个用在词汇阅读器的条目操作上
  copy: [
    'M9.2 5.6h6.4c1.1 0 2 .9 2 2v6.4',
    'M6 10.2c0-1.1.9-2 2-2h6.4c1.1 0 2 .9 2 2v6.4c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2z'
  ],
  check: ['m5.6 12.7 4.2 4.2 8.6-9.2'],
  close: ['m7 7 10 10', 'M17 7 7 17'],
  eye: [
    'M12 5.6c4.6 0 7.9 4.3 8.9 6.1a.6.6 0 0 1 0 .6c-1 1.8-4.3 6.1-8.9 6.1S4.1 14.1 3.1 12.3a.6.6 0 0 1 0-.6C4.1 9.9 7.4 5.6 12 5.6z',
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'
  ],
  // 生词本用到的删除
  trash: [
    'M4.8 7.2h14.4',
    'M9.7 4.8h4.6',
    'M6.9 7.2l.8 11.4a1.7 1.7 0 0 0 1.7 1.6h5.2a1.7 1.7 0 0 0 1.7-1.6l.8-11.4',
    'M10.5 10.7v6.1',
    'M13.5 10.7v6.1'
  ]
}

const props = withDefaults(defineProps<{ name: string; size?: number; filled?: boolean }>(), {
  size: 20,
  filled: false
})

const paths = computed(() => PATHS[props.name] ?? [])
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    :fill="props.filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
