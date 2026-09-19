/** 做题模块内部共用的小类型（只给 UI 层用，不属于 core 模型）。 */
export interface OptionView {
  /** 选项在本次渲染中的唯一 id（选择题用选项 id；完形填空用「空号-序号」） */
  id: string
  text: string
}
