<script setup lang="ts">
// 词汇页顶部的浮动 HUD：左边是全局翻译（眼睛），右边是极薄的阅读进度条。
// 玻璃只用在这一层浮于正文之上的 chrome 上。
import IconButton from '@/ui/primitives/IconButton.vue'
import { useReadingProgress } from './useReadingProgress'

defineProps<{ allRevealed: boolean }>()
const emit = defineEmits<{ (e: 'toggle-all'): void }>()

const { percent, scrubbing, onScrubInput, onScrubStart, onScrubEnd } = useReadingProgress()
</script>

<template>
  <!-- 零高度 sticky 容器：HUD 浮在正文之上，但不占正文的排版空间 -->
  <div class="hud">
    <div class="hud__bar" :class="{ 'hud__bar--scrubbing': scrubbing }">
      <IconButton
        variant="quiet"
        icon="eye"
        :size="36"
        :active="allRevealed"
        :label="allRevealed ? '隐藏全部翻译' : '显示全部翻译'"
        hint="全局翻译（G）"
        @click="emit('toggle-all')"
      />

      <input
        class="hud__scrub"
        type="range"
        min="0"
        max="100"
        step="0.1"
        :value="percent"
        :style="{ '--fill': `${percent}%` }"
        aria-label="阅读进度"
        @input="onScrubInput"
        @pointerdown="onScrubStart"
        @pointerup="onScrubEnd"
        @pointercancel="onScrubEnd"
        @change="onScrubEnd"
      />
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: sticky;
  top: var(--chrome-top, 0px);
  z-index: 15;
  height: 0;
  /* 零高度浮层：用下外边距给正文留位，这样标题不会被胶囊压住 */
  margin-bottom: 54px;
}

.hud__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  /* 紧凑 HUD：宽度跟着内容走，不做成整行输入框的样子 */
  width: fit-content;
  max-width: 100%;
  margin: 6px auto 0 0;
  padding: 4px 14px 4px 5px;
  border-radius: var(--r-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--blur)) saturate(180%);
  box-shadow: var(--shadow-1);
  transition: background-color var(--dur) var(--ease-out);
}

.hud__bar--scrubbing {
  background: var(--glass-bg-strong);
}

/* 进度条：命中区域 32px 高（好点好拖），可见轨道只有 4px */
.hud__scrub {
  flex: none;
  width: min(260px, 48vw);
  height: 32px;
  margin: 0;
  padding: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
  /* 纵向留给页面滚动，横向（拖动进度）自己处理 */
  touch-action: pan-y;
}

.hud__scrub::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--r-pill);
  background: linear-gradient(
    90deg,
    var(--accent) var(--fill, 0%),
    rgba(60, 60, 67, 0.15) var(--fill, 0%)
  );
}

.hud__scrub::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 13px;
  height: 13px;
  margin-top: -4.5px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.hud__scrub::-moz-range-track {
  height: 4px;
  border-radius: var(--r-pill);
  background: rgba(60, 60, 67, 0.15);
}

.hud__scrub::-moz-range-progress {
  height: 4px;
  border-radius: var(--r-pill);
  background: var(--accent);
}

.hud__scrub::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: none;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
  opacity: 0;
}

/* 拖动 / 悬停 / 键盘聚焦时才露出小球，平时只有一根细线 */
@media (hover: hover) and (pointer: fine) {
  .hud__scrub:hover::-webkit-slider-thumb {
    opacity: 1;
    transform: scale(1);
  }
}

.hud__scrub:focus-visible::-webkit-slider-thumb {
  opacity: 1;
  transform: scale(1);
}

.hud__bar--scrubbing .hud__scrub::-webkit-slider-thumb {
  opacity: 1;
  transform: scale(1);
}
</style>
