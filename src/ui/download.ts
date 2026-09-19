/**
 * 触发浏览器下载一个文本文件（UI 层的浏览器 API 工具；core 层禁止碰 DOM）。
 *
 * 导出必须是「真的落成一个文件」，所以用 Blob + <a download>，而不是只把 JSON
 * 复制到剪贴板。调用必须在用户手势里（点击），否则浏览器会拦。
 */
export function downloadText(filename: string, text: string, mime = 'application/json'): boolean {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // 等浏览器把 blob 读走之后再释放
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}
