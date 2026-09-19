<script setup lang="ts">
// 选择题：单选点选即判定；多选先选、再提交。
import { computed } from 'vue'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import QuestionCard from './QuestionCard.vue'
import QuestionOptions from './QuestionOptions.vue'
import type { OptionView } from './types'
import type { ChoiceItem } from '@/core/model/quiz'
import type { Verdict } from '@/core/model/verdict'

const props = defineProps<{
  item: ChoiceItem
  index: number
  selected: string[]
  judged: boolean
  verdict: Verdict | null
  copied: boolean
  copyFailed: boolean
}>()

const emit = defineEmits<{
  (e: 'pick', optionId: string): void
  (e: 'submit'): void
  (e: 'copy'): void
}>()

const isMulti = computed(() => props.item.mode === 'multi')
const options = computed<OptionView[]>(() =>
  props.item.options.map((option) => ({ id: option.id, text: option.text }))
)
const correctIds = computed(() => props.item.options.filter((o) => o.correct).map((o) => o.id))
</script>

<template>
  <QuestionCard
    :index="index"
    :kind="isMulti ? '选择题 · 多选' : '选择题 · 单选'"
    :judged="judged"
    :verdict="verdict"
    :verdict-text="verdict === 'correct' ? '回答正确' : '回答错误'"
    :explanation="item.explanation ?? null"
    :copied="copied"
    :copy-failed="copyFailed"
    @copy="emit('copy')"
  >
    <p class="prompt">{{ item.prompt }}</p>

    <QuestionOptions
      :options="options"
      :selected-ids="selected"
      :correct-ids="judged ? correctIds : []"
      :judged="judged"
      @pick="(option) => emit('pick', option.id)"
    />

    <div v-if="isMulti && !judged" class="row row--wrap submit-row">
      <GlassButton :disabled="selected.length === 0" @click="emit('submit')">提交答案</GlassButton>
      <span class="submit-hint">{{
        selected.length > 0 ? `已选 ${selected.length} 项` : '可多选，选好后一起提交'
      }}</span>
    </div>
    <p v-else-if="isMulti" class="submit-hint">已提交，答案已锁定</p>
  </QuestionCard>
</template>

<style scoped>
.prompt {
  font-size: clamp(16px, 4.2vw, 18px);
  font-weight: 500;
  line-height: 1.55;
  letter-spacing: -0.005em;
  /* 超长题目 / 连续无空格字符串也不能撑出横向滚动 */
  overflow-wrap: anywhere;
}

.submit-row {
  margin-top: 14px;
}

.submit-hint {
  font-size: 13px;
  color: var(--text-3);
}
</style>
