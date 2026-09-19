export interface NavItem {
  path: string
  label: string
  icon: string
}

// 导航项的唯一来源：桌面侧栏与手机标签栏都从这里读，避免两处各写一份
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '首页', icon: 'home' },
  { path: '/import', label: '导入', icon: 'import' },
  { path: '/quiz', label: '做题', icon: 'quiz' },
  { path: '/vocab', label: '背单词', icon: 'vocab' },
  { path: '/wordbook', label: '生词本', icon: 'wordbook' }
]
