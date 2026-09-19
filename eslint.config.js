/**
 * ESLint（flat config）。
 *
 * 取向：
 *  - 用 Vue 3 + TypeScript 的标准组合（@eslint/js + typescript-eslint + eslint-plugin-vue）
 *  - **不做类型感知检查**（不开 projectService）：这个项目有 vue-tsc 负责类型，
 *    lint 只抓真实代码问题，不值得为它引入复杂配置与更慢的运行
 *  - 格式化交给 Prettier，最后一份 eslint-config-prettier 只关掉与 Prettier 冲突的规则
 *  - 不为了 0 warning 去关规则；只关两条与项目约定有意的冲突（见下）
 */
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig(
  globalIgnores(['dist/**', 'node_modules/**', 'coverage/**']),

  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],

  {
    // 浏览器全局（window / document / 各类 DOM 构造器）——页面代码本来就在浏览器里跑，
    // 这不是"未定义变量"，只是需要声明环境
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { parser: tseslint.parser }
    }
  },

  // 必须放最后：关掉与 Prettier 冲突的格式化规则（格式化只有一个来源）
  prettier,

  {
    rules: {
      // 组件名不强求多词：App.vue / Icon.vue 这类单词名是这里的既定约定
      'vue/multi-word-component-names': 'off',
      // 与 Prettier 的取舍一致：允许 void 前缀显式忽略 Promise
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  }
)
