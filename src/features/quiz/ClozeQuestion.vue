<script setup lang="ts">
// 完形填空：上方整篇 passage，下方每个空的选项；全部填完后一次性提交，
// 提交后每个空各自给出对错、正确答案与该空的 explanation（注意：不是逐空立即判定）。
import { computed } from 'vue'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import QuestionCard from './QuestionCard.vue'
import QuestionOptions from './QuestionOptions.vue'
import ClozePassage from './ClozePassage.vue'
import type { OptionView } from './types'
import { normalizeAnswer } from '@/core/grade/grading'
import type { ClozeBlank, ClozeItem } from '@/core/model/quiz'
import type { Verdict } from '@/core/model/verdict'

const props = defineProps<{
  item: ClozeItem
  index: number
  blanks: Record<number, string>
  judged: boolean
  verdict: Verdict | null
  blankVerdicts: Record<number, Verdict | null>
  copied: boolean
  copyFailed: boolean
}>()

const emit = defineEmits<{
  (e: 'pick-blank', index: number, value: string): void
  (e: 'submit'): void
  (e: 'copy'): void
}>()

const filled = computed(
  () => props.item.blanks.filter((blank) => (props.blanks[blank.index] ?? '').trim() !== '').length
)
const canSubmit = computed(() => filled.value === props.item.blanks.length)
const remaining = computed(() => props.item.blanks.length - filled.value)
const wrongCount = computed(
  () => props.item.blanks.filter((blank) => props.blankVerdicts[blank.index] === 'wrong').length
)
const verdictText = computed(() =>
  props.verdict === 'correct' ? '全部正确' : `有 ${wrongCount.value} 个空错误`
)

/** 空里选中的答案存的是选项文本（模型里 ClozeBlank.answer 就是文本） */
function chosen(blank: ClozeBlank): string {
  return normalizeAnswer(props.blanks[blank.index] ?? '')
}

function optionsOf(blank: ClozeBlank): OptionView[] {
  return blank.choices.map((choice, i) => ({ id: `${blank.index}-${i}`, text: choice }))
}

function correctIdsOf(blank: ClozeBlank): string[] {
  return props.judged
    ? blank.choices.flatMap((choice, i) =>
        normalizeAnswer(choice) === normalizeAnswer(blank.answer) ? [`${blank.index}-${i}`] : []
      )
    : []
}

function selectedIdsOf(blank: ClozeBlank): string[] {
  return blank.choices.flatMap((choice, i) =>
    normalizeAnswer(choice) === chosen(blank) ? [`${blank.index}-${i}`] : []
  )
}

function blankVerdictText(blank: ClozeBlank): string {
  return props.blankVerdicts[blank.index] === 'correct' ? '正确' : '错误'
}
</script>

<template>
  <QuestionCard
    :index="index"
    kind="完形填空"
    :judged="judged"
    :verdict="verdict"
    :verdict-text="verdictText"
    :explanation="item.explanation ?? null"
    :copied="copied"
    :copy-failed="copyFailed"
    @copy="emit('copy')"
  >
    <ClozePassage
      :passage="item.passage"
      :answers="blanks"
      :judged="judged"
      :blank-verdicts="blankVerdicts"
    />

    <ol class="blanks">
      <li v-for="blank in item.blanks" :key="blank.index" class="blank">
        <div class="blank__head">
          <span class="blank__no">{{ blank.index }}</span>
          <span
            v-if="judged"
            class="blank__verdict"
            :class="`blank__verdict--${blankVerdicts[blank.index] ?? 'wrong'}`"
            >{{ blankVerdictText(blank) }}</span
          >
        </div>

        <QuestionOptions
          v-if="blank.choices.length > 0"
          compact
          :options="optionsOf(blank)"
          :selected-ids="selectedIdsOf(blank)"
          :correct-ids="correctIdsOf(blank)"
          :judged="judged"
          @pick="(option) => emit('pick-blank', blank.index, option.text)"
        />

        <input
          v-else
          class="blank__input"
          type="text"
          :value="blanks[blank.index] ?? ''"
          :readonly="judged"
          placeholder="填写答案"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          @input="emit('pick-blank', blank.index, ($event.target as HTMLInputElement).value)"
        />

        <p v-if="judged" class="blank__answer">
          正确答案：<span class="blank__answer-text">{{ blank.answer }}</span>
        </p>
        <p v-if="judged && blank.explanation" class="blank__explain">{{ blank.explanation }}</p>
      </li>
    </ol>

    <div v-if="!judged" class="row row--wrap submit-row">
      <GlassButton :disabled="!canSubmit" @click="emit('submit')">提交答案</GlassButton>
      <span class="submit-hint">{{
        canSubmit ? `已填完 ${item.blanks.length} 个空` : `还剩 ${remaining} 个空`
      }}</span>
    </div>
    <p v-else class="submit-hint">已提交，答案已锁定</p>
  </QuestionCard>
</template>

<style scoped>
.blanks {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.blank {
  padding-top: 2px;
}

.blank__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.blank__no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--surface-quiet);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.blank__verdict {
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 590;
}

.blank__verdict--correct {
  color: var(--correct);
  background: var(--correct-soft);
}

.blank__verdict--wrong {
  color: var(--wrong);
  background: var(--wrong-soft);
}

.blank__input {
  width: 100%;
  margin-top: 10px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-control);
  background: var(--surface-solid);
  color: var(--text-1);
  /* 16px 起，避免 iOS 聚焦输入框时把整页放大 */
  font-size: 16px;
}

.blank__input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.blank__answer {
  margin-top: 10px;
  font-size: 14px;
  color: var(--text-2);
}

.blank__answer-text {
  font-weight: 590;
  color: var(--correct);
}

.blank__explain {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-3);
}

.submit-row {
  margin-top: 16px;
}

.submit-hint {
  font-size: 13px;
  color: var(--text-3);
}
</style>
