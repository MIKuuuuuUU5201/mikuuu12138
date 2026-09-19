/**
 * 导入流程的单例。store 用全局存储实例，最近导入写成功后让响应式列表刷新。
 */
import { storage } from './storage'
import { useRecent } from './useRecent'
import { createImportFlow } from './useImportFlow'

// View 只用这一层：类型也从门面再导出，不要直接 import 到 state 内部文件
export type { ConfirmOutcome, ImportDoc, ImportKind } from './useImportFlow'
export { createImportFlow } from './useImportFlow'

export const importFlow = createImportFlow({
  store: storage,
  onRecentChanged: (kind) => {
    useRecent().reload(kind)
  }
})

export function useImportFlow() {
  return importFlow
}
