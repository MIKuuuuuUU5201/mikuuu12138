/**
 * 生词本动作层的规则测试。
 *
 * 存储本身的规则（完整校验 / 顺序 / 去重 / 失败不改旧值）已经由 core/storage 的测试覆盖，
 * 这里验的是「页面接线」：复制的内容、导出的内容与文件名、删除是否真的落到 storage、
 * 导入结果怎么呈现、以及反馈状态的生命周期。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FEEDBACK_MS, exportFilename, useWordbookTools } from '../useWordbookTools'
import { useWordbook } from '@/state/useWordbook'

const wordbookText = (words: string[]) => JSON.stringify({ type: 'wordbook', version: 1, words })

/** 用真实 storage（测试环境里是内存降级模式）播种数据 */
function seed(words: string[]) {
  const book = useWordbook()
  book.importJson(wordbookText(words))
  return book
}

function harness(writeText: () => Promise<boolean> = async () => true) {
  const written: string[] = []
  const downloads: { filename: string; text: string }[] = []
  const tools = useWordbookTools({
    writeText: async (text: string) => {
      written.push(text)
      return writeText()
    },
    download: (filename: string, text: string) => {
      downloads.push({ filename, text })
      return true
    },
    now: () => new Date('2026-09-19T17:30:00')
  })
  return { tools, written, downloads }
}

beforeEach(() => {
  seed([])
})

describe('复制单个词', () => {
  it('只复制这个词本身，不附加任何内容', async () => {
    seed(['confidence', 'take off'])
    const { tools, written } = harness()

    await tools.copyWord('take off')

    expect(written).toEqual(['take off'])
    expect(tools.copied.value).toBe('take off')
    expect(tools.copyFailed.value).toBeNull()
    expect(tools.message.value).toBe('已复制 take off')
  })

  it('复制失败时不冒充成功，给一行提示', async () => {
    seed(['confidence'])
    const { tools } = harness(async () => false)

    const ok = await tools.copyWord('confidence')

    expect(ok).toBe(false)
    expect(tools.copied.value).toBeNull()
    expect(tools.copyFailed.value).toBe('confidence')
    expect(tools.message.value).toBe('复制失败，请手动选中文本')
  })

  it('反馈过一会儿自动消失', async () => {
    vi.useFakeTimers()
    seed(['confidence'])
    const { tools } = harness()

    await tools.copyWord('confidence')
    expect(tools.copied.value).toBe('confidence')

    vi.advanceTimersByTime(FEEDBACK_MS)
    expect(tools.copied.value).toBeNull()
    expect(tools.message.value).toBe('')
    vi.useRealTimers()
  })
})

describe('复制全部', () => {
  it('一行一个、按当前列表顺序、不追加额外内容', async () => {
    seed(['confidence', 'take off', 'In my opinion'])
    const { tools, written } = harness()

    await tools.copyAll()

    expect(written).toEqual(['confidence\ntake off\nIn my opinion'])
    expect(written[0].endsWith('\n')).toBe(false)
    expect(tools.copiedAll.value).toBe(true)
    expect(tools.message.value).toBe('已复制全部 3 条')
  })

  it('列表为空时不复制（不写空字符串到剪贴板）', async () => {
    seed([])
    const { tools, written } = harness()

    const ok = await tools.copyAll()

    expect(ok).toBe(false)
    expect(written).toEqual([])
  })

  it('复制失败时给出可辨的失败态', async () => {
    seed(['confidence'])
    const { tools } = harness(async () => false)

    await tools.copyAll()

    expect(tools.copyFailedAll.value).toBe(true)
    expect(tools.copiedAll.value).toBe(false)
    expect(tools.message.value).toBe('复制失败，请手动选中文本')
  })
})

describe('删除单个词', () => {
  it('真的从 storage 移除，其余顺序不变', () => {
    const book = seed(['confidence', 'take off', 'In my opinion'])
    const { tools } = harness()

    expect(tools.removeWord('take off')).toBe(true)

    expect(book.words.value).toEqual(['confidence', 'In my opinion'])
    expect(tools.message.value).toBe('已删除 take off')
    expect(tools.removeFailed.value).toBeNull()
  })

  it('写盘失败时旧数据保持不动，界面也不假装删掉了', () => {
    const real = seed(['confidence', 'take off'])
    const failing: ReturnType<typeof useWordbook> = {
      ...real,
      remove: () => ({ ok: false, reason: 'quota', detail: '模拟配额不足' })
    }
    const tools = useWordbookTools({
      book: failing,
      writeText: async () => true,
      download: () => true
    })

    expect(tools.removeWord('confidence')).toBe(false)

    expect(real.words.value).toEqual(['confidence', 'take off'])
    expect(tools.removeFailed.value).toBe('confidence')
    expect(tools.message.value).toContain('删除失败')
  })
})

describe('导出', () => {
  it('文件名带时间戳，内容就是现有导出格式（不改格式）', () => {
    seed(['confidence', 'in my opinion', 'take off'])
    const { tools, downloads } = harness()

    const outcome = tools.exportToFile()

    expect(outcome.ok).toBe(true)
    expect(outcome.filename).toBe('english-site-wordbook-20260919-1730.json')
    expect(downloads).toEqual([
      {
        filename: 'english-site-wordbook-20260919-1730.json',
        text: JSON.stringify(
          { type: 'wordbook', version: 1, words: ['confidence', 'in my opinion', 'take off'] },
          null,
          2
        )
      }
    ])
    // 格式本身：type / version / words 三个字段，顺序就是当前列表顺序
    expect(JSON.parse(downloads[0].text)).toEqual({
      type: 'wordbook',
      version: 1,
      words: ['confidence', 'in my opinion', 'take off']
    })
    expect(tools.message.value).toContain('已导出')
  })

  it('非法日期也能生成合法文件名', () => {
    expect(exportFilename(new Date('2026-01-02T03:04:00'))).toBe(
      'english-site-wordbook-20260102-0304.json'
    )
  })
})

describe('导入', () => {
  it('合法 JSON：整体覆盖并报告条数', () => {
    const book = seed(['旧词'])
    const { tools } = harness()

    const outcome = tools.importFromText(wordbookText(['confidence', 'take off', 'confidence']))

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('应当成功')
    expect(outcome.count).toBe(2)
    expect(outcome.duplicates).toBe(1)
    expect(book.words.value).toEqual(['confidence', 'take off'])
    expect(tools.importResult.value).toEqual(outcome)
    expect(tools.message.value).toContain('已导入 2 条')
    expect(tools.message.value).toContain('跳过重复 1 条')
  })

  it('非法 JSON：整次失败，旧生词本一个字节都不变', () => {
    const book = seed(['confidence', 'take off'])
    const { tools } = harness()

    const outcome = tools.importFromText('{ 这不是 JSON')

    expect(outcome.ok).toBe(false)
    expect(book.words.value).toEqual(['confidence', 'take off'])
    expect(tools.importResult.value?.ok).toBe(false)
    expect(tools.message.value).toBe('导入失败，生词本未做任何改动（1 个问题）')
  })

  it('格式对但内容不合法（type 不对 / words 里有空串）：同样整体拒绝', () => {
    const book = seed(['confidence'])
    const { tools } = harness()

    const wrongType = tools.importFromText(JSON.stringify({ type: 'quiz', version: 1, words: [] }))
    expect(wrongType.ok).toBe(false)
    expect(book.words.value).toEqual(['confidence'])

    const badWords = tools.importFromText(
      JSON.stringify({ type: 'wordbook', version: 1, words: ['ok', '   ', 7] })
    )
    expect(badWords.ok).toBe(false)
    if (badWords.ok) throw new Error('应当失败')
    expect(badWords.errors.length).toBe(2)
    expect(book.words.value).toEqual(['confidence'])
  })

  it('收起面板会清掉上一次的导入结果', () => {
    seed([])
    const { tools } = harness()

    tools.importFromText('不是 JSON')
    expect(tools.importResult.value).not.toBeNull()

    tools.resetImportResult()
    expect(tools.importResult.value).toBeNull()
    expect(tools.message.value).toBe('')
  })
})

describe('新增后立即可见（跨页面共用同一份 state）', () => {
  it('在别处 add 进来的词，列表里立刻出现且排在最前', () => {
    const book = seed(['take off'])
    const { tools } = harness()

    book.add('confidence')

    expect(tools.words.value).toEqual(['confidence', 'take off'])
    expect(tools.count.value).toBe(2)
  })
})
