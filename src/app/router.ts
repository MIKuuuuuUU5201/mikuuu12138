import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/features/home/HomeView.vue'
import ImportView from '@/features/import/ImportView.vue'
import QuizRunView from '@/features/quiz/QuizRunView.vue'
import VocabReaderView from '@/features/vocab/VocabReaderView.vue'
import WordbookView from '@/features/wordbook/WordbookView.vue'

// 纯静态托管（GitHub Pages）没有 SPA fallback，hash 模式可以彻底避免深链/刷新 404
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: '英语学习' } },
    { path: '/import', name: 'import', component: ImportView, meta: { title: '导入' } },
    { path: '/quiz', name: 'quiz', component: QuizRunView, meta: { title: '做题' } },
    { path: '/vocab', name: 'vocab', component: VocabReaderView, meta: { title: '背单词' } },
    { path: '/wordbook', name: 'wordbook', component: WordbookView, meta: { title: '生词本' } },
    { path: '/:pathMatch(.*)*', redirect: { path: '/' } }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
