/**
 * 判定结果。null 表示“还没有作答”——所以 UI 可以据此禁用「提交 / 揭晓」。
 * 刻意不使用枚举类，字面量联合更轻，也天然可 JSON 化。
 */
export type Verdict = 'correct' | 'wrong'

export type Graded = Verdict | null
