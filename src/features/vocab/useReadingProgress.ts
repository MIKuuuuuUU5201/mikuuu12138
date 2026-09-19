/**
 * 阅读进度：滚动 → 进度条；拖动进度条 → 跳转阅读位置。
 *
 * 本项目的 AppShell 不创建内部滚动容器，滚动发生在文档上，所以这里直接用 window。
 * 进度数值只用于进度条和 aria，界面上不显示任何百分比数字。
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface ReadingProgress {
  /** 0–100，保留一位小数 */
  percent: Ref<number>
  /** 正在拖动：拖动期间不再用滚动位置反过来覆盖进度 */
  scrubbing: Ref<boolean>
  onScrubInput: (event: Event) => void
  onScrubStart: () => void
  onScrubEnd: () => void
}

export function useReadingProgress(): ReadingProgress {
  const percent = ref(0)
  const scrubbing = ref(false)
  let frame = 0

  function scrollRange(): number {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  }

  function measure(): void {
    const range = scrollRange()
    if (range <= 0) {
      // 内容不足一屏：没有可滚动距离，就当作已经读完
      percent.value = 100
      return
    }
    const ratio = window.scrollY / range
    const clamped = Math.min(1, Math.max(0, ratio))
    percent.value = Math.round(clamped * 1000) / 10
  }

  function schedule(): void {
    if (scrubbing.value || frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      measure()
    })
  }

  function onScrubInput(event: Event): void {
    const target = event.target as HTMLInputElement
    const value = Number(target.value)
    if (Number.isNaN(value)) return
    percent.value = value
    window.scrollTo({ top: (value / 100) * scrollRange(), behavior: 'auto' })
  }

  onMounted(() => {
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    if (frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  })

  return {
    percent,
    scrubbing,
    onScrubInput,
    onScrubStart: () => {
      scrubbing.value = true
    },
    onScrubEnd: () => {
      scrubbing.value = false
      measure()
    }
  }
}
