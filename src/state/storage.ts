/**
 * 全局唯一的存储实例。
 * 只探测一次可用性；两个 state 模块共用它，避免各自探一遍。
 */
import { createStorage } from '@/core/storage/local'

export const storage = createStorage()
