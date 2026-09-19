<script setup lang="ts">
// 词汇条目：word / example / translation（默认隐藏）+ 右侧三个图标按钮。
// 纯展示 + 事件上报，自身不认识 wordbook、不认识 storage。
import { onBeforeUnmount, ref, watch } from 'vue'
import type { VocabItem } from '@/core/model/vocab'
import IconButton from '@/ui/primitives/IconButton.vue'

const props = defineProps<{
  item: VocabItem
  revealed: boolean
  saved: boolean
  copied: boolean
  /** 是否是「当前词」（键盘 C / W 作用的对象） */
  active: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-reveal'): void
  (e: 'copy'): void
  (e: 'toggle-save'): void
  (e: 'hover'): void
}>()

/** 收藏态真的发生了变化才弹一下：反馈对应「状态确实变了」，不是「点了一下」 */
const popping = ref(false)
let popTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.saved,
  (now, before) => {
    if (now === before) return
    popping.value = false
    if (popTimer !== null) clearTimeout(popTimer)
    requestAnimationFrame(() => {
      popping.value = true
    })
    popTimer = setTimeout(() => {
      popping.value = false
      popTimer = null
    }, 320)
  }
)

onBeforeUnmount(() => {
  if (popTimer !== null) clearTimeout(popTimer)
})

/** 只有真鼠标悬停才更新「当前词」，触屏点一下不算悬停 */
function onPointerEnter(event: PointerEvent): void {
  if (event.pointerType === 'mouse') emit('hover')
}
</script>

<template>
  <article
    class="entry"
    :class="{ 'entry--active': active }"
    @pointerenter="onPointerEnter"
    @focusin="emit('hover')"
  >
    <div class="entry__text">
      <p class="entry__word">{{ item.word }}</p>
      <p v-if="item.example" class="entry__example">{{ item.example }}</p>

      <div class="entry__reveal" :class="{ 'entry__reveal--open': revealed }">
        <p class="entry__translation">{{ item.translation ?? '（这条没有翻译）' }}</p>
      </div>
    </div>

    <div class="entry__actions">
      <IconButton
        variant="quiet"
        :icon="copied ? 'check' : 'copy'"
        :size="36"
        :highlight="copied"
        :label="`复制 ${item.word}`"
        hint="复制这个单词（C）"
        @click="emit('copy')"
      />
      <span class="entry__save" :class="{ 'entry__save--pop': popping }">
        <IconButton
          variant="quiet"
          icon="wordbook"
          :size="36"
          :filled="saved"
          :active="saved"
          :label="saved ? `把 ${item.word} 移出生词本` : `把 ${item.word} 加入生词本`"
          hint="加入 / 移出生词本（W）"
          @click="emit('toggle-save')"
        />
      </span>
      <IconButton
        variant="quiet"
        icon="eye"
        :size="36"
        :active="revealed"
        :label="revealed ? `隐藏 ${item.word} 的翻译` : `显示 ${item.word} 的翻译`"
        @click="emit('toggle-reveal')"
      />
    </div>
  </article>
</template>

<style scoped>
.entry {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 0;
  position: relative;
}

/* 「当前词」（键盘 C / W 作用的对象）：细到几乎看不见的强调条，只在有鼠标的设备上出现 */
.entry::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 22px;
  bottom: 22px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
  opacity: 0;
  transition: opacity var(--dur) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .entry--active::before {
    opacity: 0.4;
  }
}

.entry__text {
  flex: 1;
  min-width: 0;
}

.entry__word {
  font-size: clamp(18px, 4.6vw, 21px);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.25;
  overflow-wrap: break-word;
}

.entry__example {
  margin-top: 5px;
  font-size: clamp(14px, 3.7vw, 16px);
  line-height: 1.5;
  color: var(--text-2);
  /* 例句里可能出现连续无空格的长串（URL / 长词）：必须能断行，否则顶破阅读列 */
  overflow-wrap: anywhere;
}

/* 默认隐藏：0fr → 1fr 让高度平滑展开，而不是硬跳 */
.entry__reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--dur) var(--ease-out);
}

.entry__reveal--open {
  grid-template-rows: 1fr;
}

.entry__translation {
  overflow: hidden;
  min-height: 0;
  font-size: clamp(14px, 3.7vw, 16px);
  /* 同理：译文里也不能出现横向溢出（这个容器 overflow:hidden，不换行就会被裁掉） */
  overflow-wrap: anywhere;
  line-height: 1.5;
  color: var(--text-1);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}

.entry__reveal--open .entry__translation {
  margin-top: 8px;
  opacity: 1;
}

.entry__actions {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 加入 / 移出生词本时的轻量弹一下 */
.entry__save--pop {
  animation: entry-save-pop 320ms var(--ease-out);
}

@keyframes entry-save-pop {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1);
  }
}
</style>
