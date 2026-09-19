<script setup lang="ts">
import Icon from './Icon.vue'

// 圆形图标按钮。两种用法：
//   solid（默认）= 有边框的实色圆钮，用在表单 / 面板里
//   quiet        = 低存在感的幽灵钮，用在正文里（词汇条目右侧）
withDefaults(
  defineProps<{
    icon: string
    label: string
    size?: number
    /** 切换类按钮的按下态；不传则不输出 aria-pressed（动作类按钮不该被当成开关） */
    active?: boolean | undefined
    /**
     * 只是视觉高亮（例如「刚复制成功」），不冒充切换语义：
     * 与 active 的区别是**不输出 aria-pressed**。
     */
    highlight?: boolean
    disabled?: boolean
    variant?: 'solid' | 'quiet'
    /** 图标是否填充（生词本的已收藏态） */
    filled?: boolean
    /** 原生 tooltip，用来提示快捷键之类 */
    hint?: string
  }>(),
  {
    size: 36,
    active: undefined,
    highlight: false,
    disabled: false,
    variant: 'solid',
    filled: false,
    hint: undefined
  }
)

const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    type="button"
    class="icon-btn"
    :class="[`icon-btn--${variant}`, { 'icon-btn--active': active === true || highlight }]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :aria-label="label"
    :aria-pressed="active"
    :title="hint"
    :disabled="disabled"
    @click="emit('click')"
  >
    <Icon :name="icon" :size="Math.round(size * 0.5)" :filled="filled" />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  background: var(--surface-solid);
  color: var(--text-2);
  transition:
    transform var(--dur-press) ease-out,
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

/* 按下立即可见（不等抬起） */
.icon-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.icon-btn--active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: transparent;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 幽灵钮：没有边框与底色，只留图标；触控区域由 width/height 保证 */
.icon-btn--quiet {
  border-color: transparent;
  background: transparent;
  color: var(--text-3);
}

.icon-btn--quiet.icon-btn--active {
  color: var(--accent);
  background: var(--accent-soft);
}

/* hover 只在真有指针悬停的设备上生效，避免触屏「粘住」 */
@media (hover: hover) and (pointer: fine) {
  .icon-btn--quiet:hover:not(:disabled) {
    background: var(--row-hover);
    color: var(--text-1);
  }

  .icon-btn--quiet.icon-btn--active:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .icon-btn--solid:hover:not(:disabled) {
    background: var(--surface-quiet);
  }
}
</style>
