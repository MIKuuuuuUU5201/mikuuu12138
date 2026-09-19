/**
 * 分层解耦断言（项目级）。
 *
 * 这条测试的意义：架构约束如果不写成可执行的检查，三个月后一定会被破坏。
 *
 *   core/      纯 TypeScript，不认识 Vue / UI / 状态 / 浏览器存储（唯一例外 storage/local.ts）
 *   state/     唯一把 core 接到 Vue 的一层
 *   features/  只组装页面：不直接调 parser、不直接做存储 I/O
 *
 * 扫描时只看代码、不看注释（注释里提到 window / localStorage 不该触发规则），
 * 并跳过 __tests__（测试本身允许用 node:fs 等）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const coreFiles = listTsFiles(join(srcDir, 'core'))
const featureFiles = listTsFiles(join(srcDir, 'features'))

function listTsFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...listTsFiles(full))
    else if (entry.endsWith('.ts') || entry.endsWith('.vue')) found.push(full)
  }
  return found
}

/** 只扫描代码，不看注释 */
function codeOf(file: string): string {
  return readFileSync(file, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    .join('\n')
}

function offenders(files: string[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(codeOf(file))).map((file) => relative(srcDir, file))
}

describe('core/ 层依赖约束', () => {
  it('有源码可以检查（避免规则空转）', () => {
    expect(coreFiles.length, `core: ${coreFiles.join(' ')}`).toBeGreaterThan(10)
    expect(featureFiles.length, `features: ${featureFiles.join(' ')}`).toBeGreaterThan(5)
  })

  it('不依赖 Vue / 路由 / Pinia', () => {
    expect(offenders(coreFiles, /from\s+['"]vue['"]/)).toEqual([])
    expect(offenders(coreFiles, /from\s+['"]vue-router['"]/)).toEqual([])
    expect(offenders(coreFiles, /from\s+['"]pinia['"]/)).toEqual([])
  })

  it('不 import 任何 .vue 组件（原项目把 parser 与渲染器注册在一起，这里禁止）', () => {
    expect(offenders(coreFiles, /from\s+['"][^'"]*\.vue['"]/)).toEqual([])
  })

  it('不 import UI / state / features / app 层', () => {
    expect(offenders(coreFiles, /from\s+['"]@\/(ui|state|features|app)\//)).toEqual([])
  })

  it('不碰浏览器持久化与 DOM（唯一例外：storage/local.ts 这个适配器本身）', () => {
    const persistenceOffenders = offenders(
      coreFiles,
      /localStorage|sessionStorage|indexedDB/
    ).filter((file) => file !== 'core/storage/local.ts')
    expect(persistenceOffenders).toEqual([])
    expect(offenders(coreFiles, /\bdocument\.|\bwindow\./)).toEqual([])
  })

  it('storage/ 里只有 local.ts 能直接接触 localStorage', () => {
    for (const file of coreFiles.filter((f) => f.includes('/storage/'))) {
      const relativePath = relative(srcDir, file)
      if (relativePath === 'core/storage/local.ts') continue
      expect(readFileSync(file, 'utf-8'), relativePath).not.toMatch(/localStorage|sessionStorage/)
    }
  })

  it('parse/ 不依赖 storage（解析不落盘）', () => {
    const parseFiles = coreFiles.filter((f) => f.includes('/parse/'))
    expect(parseFiles.length).toBeGreaterThan(0)
    for (const file of parseFiles) {
      expect(readFileSync(file, 'utf-8')).not.toMatch(/from\s+['"][^'"]*storage/)
    }
  })

  it('storage/ 不依赖 parse/ 或 grade/（存储不参与解析的兼容逻辑）', () => {
    const storageFiles = coreFiles.filter((f) => f.includes('/storage/'))
    expect(storageFiles.length).toBeGreaterThan(0)
    for (const file of storageFiles) {
      const code = codeOf(file)
      expect(code).not.toMatch(/from\s+['"][^'"]*\/parse\//)
      expect(code).not.toMatch(/from\s+['"][^'"]*\/grade\//)
    }
  })

  it('parse/ 与 grade/ 互不依赖，只共享 model/', () => {
    for (const file of coreFiles.filter((f) => f.includes('/parse/'))) {
      expect(readFileSync(file, 'utf-8')).not.toMatch(/from\s+['"][^'"]*\/grade\//)
    }
    for (const file of coreFiles.filter((f) => f.includes('/grade/'))) {
      expect(readFileSync(file, 'utf-8')).not.toMatch(/from\s+['"][^'"]*\/parse\//)
    }
  })
})

describe('features/ 层依赖约束（UI 不自己实现解析与存储）', () => {
  it('不直接 import 任何 parser / 读取器', () => {
    expect(
      offenders(
        featureFiles,
        /from\s+['"]@\/core\/parse\/(quiz-parse|vocab-parse|read-json|skeleton|aliases)/
      )
    ).toEqual([])
  })

  it('不直接做存储读写（local / wordbook）', () => {
    expect(offenders(featureFiles, /from\s+['"]@\/core\/storage\/(local|wordbook)/)).toEqual([])
    expect(offenders(featureFiles, /\blocalStorage\b|\bsessionStorage\b/)).toEqual([])
  })

  it('不 import state 的内部实现文件，只走 useImport / useRecent / useWordbook 门面', () => {
    const internals = offenders(
      featureFiles,
      /from\s+['"]@\/state\/(useImportFlow|useImport\.ts|storage)/
    )
    expect(internals).toEqual([])
  })
})
