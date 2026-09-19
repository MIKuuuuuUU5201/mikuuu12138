<script setup lang="ts">
// 生词本的一行：只有 word / phrase 本身 + 两个图标操作。不展开、不显示翻译或例句。
import IconButton from '@/ui/primitives/IconButton.vue'

defineProps<{
  word: string
  copied: boolean
  copyFailed: boolean
  removeFailed: boolean
}>()

const emit = defineEmits<{ (e: 'copy'): void; (e: 'remove'): void }>()
</script>

<template>
  <div class="wrow">
    <span class="wrow__word">{{ word }}</span>
    <span v-if="copyFailed" class="wrow__fail">复制失败</span>
    <span v-else-if="removeFailed" class="wrow__fail">删除失败</span>
    <span class="wrow__grow" />
    <IconButton
      variant="quiet"
      :icon="copied ? 'check' : 'copy'"
      :size="40"
      :highlight="copied"
      :label="copied ? `已复制 ${word}` : `复制 ${word}`"
      @click="emit('copy')"
    />
    <IconButton
      variant="quiet"
      icon="trash"
      :size="40"
      :label="`删除 ${word}`"
      @click="emit('remove')"
    />
  </div>
</template>

<style scoped>
.wrow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 2px 8px 4px;
}

.wrow__word {
  flex: 0 1 auto;
  min-width: 0;
  padding-left: 8px;
  font-size: 17px;
  line-height: 1.5;
  /* 长短语换行，绝不撑出横向滚动 */
  overflow-wrap: anywhere;
}

.wrow__grow {
  flex: 1;
}

.wrow__fail {
  flex: none;
  font-size: 12px;
  color: var(--wrong);
}
</style>
