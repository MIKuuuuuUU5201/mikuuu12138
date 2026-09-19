/**
 * 复制文本到剪贴板（UI 层的浏览器 API 工具；core 层禁止碰 DOM）。
 *
 * 优先异步 Clipboard API；它在非安全上下文或被拒权限时会失败，
 * 这时退回旧的 textarea + execCommand 方案，保证「复制」这个动作不会静默失败。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落到下面的兜底方案
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
