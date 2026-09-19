<script setup lang="ts">
/**
 * 做题：一份题库按题型自动分组（选择题 / 判断题 / 完形填空），
 * 顺着一条纵向流做下去——没有「下一题」按钮、没有翻页、没有成绩统计。
 *
 * 数据来自 state/useImport 的 current；作答状态来自 useQuizSession（内存态，刷新即失）。
 * 完形填空是「做题」里的一种题型，不是独立模块。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/ui/primitives/EmptyState.vue'
import GlassButton from '@/ui/primitives/GlassButton.vue'
import GlassCard from '@/ui/primitives/GlassCard.vue'
import InlineBanner from '@/ui/primitives/InlineBanner.vue'
import { countByKind } from '@/core/model/quiz'
import type { ChoiceItem, ClozeItem, QuizItem, TrueFalseItem } from '@/core/model/quiz'
import { summarize } from '@/core/parse/report'
import { useImportFlow } from '@/state/useImport'
import ChoiceQuestion from './ChoiceQuestion.vue'
import ClozeQuestion from './ClozeQuestion.vue'
import TrueFalseQuestion from './TrueFalseQuestion.vue'
import { useQuizSession } from './useQuizSession'

const router = useRouter()
const { current, notice } = useImportFlow()

const doc = computed(() => (current.value?.kind === 'quiz' ? current.value : null))
const items = computed<QuizItem[]>(() => doc.value?.report.accepted ?? [])

const choiceItems = computed(() =>
  items.value.filter((item): item is ChoiceItem => item.kind === 'choice')
)
const trueFalseItems = computed(() =>
  items.value.filter((item): item is TrueFalseItem => item.kind === 'true-false')
)
const clozeItems = computed(() =>
  items.value.filter((item): item is ClozeItem => item.kind === 'cloze')
)

const summary = computed(() => (doc.value === null ? null : summarize(doc.value.report)))
const counts = computed(() => (doc.value === null ? null : countByKind(doc.value.report.accepted)))

/** 连续题号，按导入顺序（分组只是视觉分段，不改题号） */
const indexMap = computed(() => {
  const map = new Map<string, number>()
  items.value.forEach((item, i) => map.set(item.id, i + 1))
  return map
})

const quiz = useQuizSession(() => items.value)

function isCopied(id: string): boolean {
  return quiz.copiedId.value === id
}

function isCopyFailed(id: string): boolean {
  return quiz.copyFailedId.value === id
}

const emptyTitle = computed(() =>
  current.value === null ? '还没有可做的题' : '当前导入的是词表，不是题目'
)
</script>

<template>
  <div v-if="doc === null" class="stack-lg">
    <InlineBanner v-if="notice" tone="warn">{{ notice }}</InlineBanner>
    <EmptyState
      :title="emptyTitle"
      hint="先导入一份做题 JSON（粘贴、选择文件或拖拽都行），再回到这里。"
    >
      <GlassButton class="empty-cta" @click="router.push('/import')">去导入</GlassButton>
    </EmptyState>
  </div>

  <div v-else class="quiz">
    <!-- 判定与复制的反馈只念给屏幕阅读器，界面上不弹提示 -->
    <p class="sr-only" aria-live="polite">{{ quiz.message.value }}</p>

    <GlassCard tone="glass" class="quiz__head">
      <h2>{{ doc.title !== '' ? doc.title : '(无标题)' }}</h2>
      <p class="muted">
        共 {{ summary?.accepted ?? 0 }} 题<template v-if="(summary?.skipped ?? 0) > 0"
          >，跳过 {{ summary?.skipped }} 题</template
        >。单选与判断题点选即判定，多选与完形填空填好后点「提交」。
      </p>
      <ul v-if="counts" class="chips">
        <li v-if="choiceItems.length > 0">选择题 {{ choiceItems.length }}</li>
        <li v-if="trueFalseItems.length > 0">判断题 {{ trueFalseItems.length }}</li>
        <li v-if="clozeItems.length > 0">完形填空 {{ clozeItems.length }}</li>
      </ul>
    </GlassCard>

    <section v-if="choiceItems.length > 0" class="group">
      <h3 class="group__label">选择题 · {{ choiceItems.length }} 题</h3>
      <div class="group__list">
        <div v-for="item in choiceItems" :key="item.id" class="qitem">
          <ChoiceQuestion
            :item="item"
            :index="indexMap.get(item.id) ?? 0"
            :selected="quiz.stateOf(item.id).selected"
            :judged="quiz.stateOf(item.id).judged"
            :verdict="quiz.stateOf(item.id).verdict"
            :copied="isCopied(item.id)"
            :copy-failed="isCopyFailed(item.id)"
            @pick="(optionId) => quiz.pickChoice(item, optionId)"
            @submit="quiz.submitChoice(item)"
            @copy="quiz.copy(item)"
          />
        </div>
      </div>
    </section>

    <section v-if="trueFalseItems.length > 0" class="group">
      <h3 class="group__label">判断题 · {{ trueFalseItems.length }} 题</h3>
      <div class="group__list">
        <div v-for="item in trueFalseItems" :key="item.id" class="qitem">
          <TrueFalseQuestion
            :item="item"
            :index="indexMap.get(item.id) ?? 0"
            :selected="quiz.stateOf(item.id).trueFalse"
            :judged="quiz.stateOf(item.id).judged"
            :verdict="quiz.stateOf(item.id).verdict"
            :copied="isCopied(item.id)"
            :copy-failed="isCopyFailed(item.id)"
            @pick="(value) => quiz.pickTrueFalse(item, value)"
            @copy="quiz.copy(item)"
          />
        </div>
      </div>
    </section>

    <section v-if="clozeItems.length > 0" class="group">
      <h3 class="group__label">完形填空 · {{ clozeItems.length }} 题</h3>
      <div class="group__list">
        <div v-for="item in clozeItems" :key="item.id" class="qitem">
          <ClozeQuestion
            :item="item"
            :index="indexMap.get(item.id) ?? 0"
            :blanks="quiz.stateOf(item.id).blanks"
            :judged="quiz.stateOf(item.id).judged"
            :verdict="quiz.stateOf(item.id).verdict"
            :blank-verdicts="quiz.stateOf(item.id).blankVerdicts"
            :copied="isCopied(item.id)"
            :copy-failed="isCopyFailed(item.id)"
            @pick-blank="(blankIndex, value) => quiz.setBlank(item, blankIndex, value)"
            @submit="quiz.submitCloze(item)"
            @copy="quiz.copy(item)"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.quiz {
  /* 做题列：手机占满，宽屏居中并限宽 */
  max-width: 720px;
  margin: 0 auto;
}

.quiz__head h2 {
  font-size: 20px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.chips li {
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
}

.group {
  margin-top: 8px;
}

/* 分组标签吸顶，滚动时始终知道自己在做哪一题型 */
.group__label {
  position: sticky;
  top: var(--chrome-top, 0px);
  z-index: 10;
  padding: 16px 0 8px;
  background: var(--bg);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.02em;
}

.qitem + .qitem {
  border-top: 1px solid var(--line);
}

.empty-cta {
  margin-top: 16px;
}
</style>
