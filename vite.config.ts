import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 部署到 GitHub Pages 项目仓库（例如 mikuuuuuuu5201.github.io/english-site/）时，
// 在构建前设置环境变量：VITE_BASE=/english-site/ npm run build
// 部署到用户站根目录（mikuuuuuuu5201.github.io）时保持默认 '/'。
// 路由使用 hash 模式，因此 base 只影响静态资源路径，不影响深链。
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    // core 层是纯 TypeScript，不需要 DOM，因此用 node 环境即可（不引入 jsdom）
    environment: 'node',
    include: ['src/**/*.spec.ts']
  }
})
