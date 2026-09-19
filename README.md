# 英语学习网站

个人英语学习网站：**背单词 / 做题 / 生词本**。
纯前端、无后端、无账号、无云同步，部署在 GitHub Pages。

---

## 当前进度

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| 0 | 项目骨架、Pages 部署、AppShell 三态导航、Liquid Glass 基础 UI | ✅ 完成 |
| 1 | 数据模型、宽松兼容解析、判定、导入报告 + 单元测试 + 样本 | ✅ 完成 |
| 2 | 本地存储（生词本 / 最近导入） | ✅ 完成 |
| 3 | 导入链路（粘贴 / 文件 / 拖拽 → 解析 → 报告 → 最近导入 → 进入入口） | ✅ 完成 |
| 4 | 背单词页面（纵向阅读流 / 翻译控制 / 生词本接入 / 阅读进度） | ✅ 完成 |
| 5 | 做题（选择题 / 判断题 / 完形填空，自动分组 + 判定 + 复制） | ✅ 完成 |
| 6 | 生词本页面（列表 / 复制 / 删除 / 导入导出） | ✅ 完成 |
| 7 | 全站响应式打磨 + 视觉统一 + ESLint + 最终回归 | ✅ 完成 |

题外话：当前阶段之外的功能**刻意没有实现**，占位页面会明确写出属于哪个阶段。

---

## 命令

```sh
npm install
npm run dev          # 开发服务器
npm test             # 单元测试（vitest，node 环境）
npm run type-check   # vue-tsc
npm run lint         # ESLint（flat config）
npm run format       # prettier 写入
npm run format-check # prettier 检查
npm run build        # 类型检查 + 构建到 dist/
npm run preview      # 预览 dist
```

工具约定：

- **ESLint** 用 flat config（`eslint.config.js`）：`@eslint/js` + `typescript-eslint` + `eslint-plugin-vue`，
  **不做类型感知检查**（类型交给 vue-tsc，lint 只抓真实代码问题，不为它引入 projectService）；
  格式化唯一来源是 Prettier，`eslint-config-prettier` 只负责关掉与之冲突的规则
- `.npmrc` 里 `ignore-scripts=true`：本机 postinstall 会卡在 fsevents 的 node-gyp 上
- CI（`.github/workflows/deploy.yml`）依次跑 type-check → lint → format-check → tests → build → deploy

---

## 数据格式

外部 JSON（通常是 GPT 产出）与站点内部模型是**两件事**：解析层的职责就是把前者翻译成后者。
所有字段别名集中在 `src/core/parse/aliases.ts`，所有判定规则集中在
`src/core/parse/quiz-parse.ts` 的文件头注释里。改格式只改这两个文件。

### Quiz JSON

**GPT 侧标准格式（必须 100% 支持）**——外层 `{ "title": "…", "items": [ … ] }`，items 里混装三种题型：

```json
{ "type": "multiple_choice", "question": "She ____ to the theatre last night.",
  "options": ["went", "go", "goes", "going"], "answer": 1, "explanation": "last night 用过去式。" }
```

```json
{ "type": "true_false", "statement": "The past tense of \"think\" is \"thinked\".",
  "answer": false, "explanation": "think 的过去式是 thought。" }
```

```json
{ "type": "cloze", "passage": "Last week I {{1}} to the theatre. He was talking {{2}}.",
  "blanks": [
    { "number": 1, "options": ["went", "go", "goes", "going"], "answer": 1, "explanation": "…" },
    { "number": 2, "options": ["loud", "loudly", "loudness", "louder"], "answer": 2, "explanation": "…" }
  ] }
```

这两份标准由 `samples/gpt-quiz-standard.json` 与 `samples/gpt-vocab-standard.json` 钉住，
测试见 `src/core/parse/__tests__/gpt-standard.spec.ts`。

顶层可以是对象或数组；数组字段名支持
`questions / items / exercises / list / data / rows / entries`；标题字段支持
`title / name / topic / lesson / unit`。整个文件只有一道题时，顶层对象本身也算一道题。

#### 题型判定规则（写死，不猜）

按顺序判断，命中即止：

1. 段落文本里出现 `{{1}}` `{{2}}` 这类标记 → **完形填空**
2. 有显式 `type` 字段 → 按别名归一化（大小写、空格、下划线、中文都认）
   - `single-choice` / `单选题` / `single` → 单选
   - `multi` / `multi-select` / `多选题` → 多选
   - `multiple_choice` / `multiple-choice` / `multiple choice` / `choice` / `question` / `选择题`
     → 泛化类型：**按答案形状**决定单/多选（单个答案 → 单选；数组答案 → 多选）
   - `true-false` / `true_false` / `判断题` / `boolean` / `tf` → 判断题
   - `cloze` / `完形填空` → 完形填空
   - 其它值 → **跳过**（原因：题型无法判断）
3. 有选项数组（`choices` / `options` / `candidates`，或 `answers` 且元素是对象）→ **选择题**
   - 正确选项数 = 1 → 单选；≥ 2 → 多选；= 0 → **跳过**
4. 有布尔型 `answer` / `correct` → **判断题**
5. 都不满足 → **跳过**

#### 正确答案的来源（绝不猜）

只有两条合法途径：

- 每个选项自带布尔标记：`correct` / `isCorrect` / `is_correct` / `right`
- 题目级的答案键 `answer` / `correctAnswer` / `key` / …（`aliases.ts` 里有完整列表）
  - `"A"` / `"b"` → 按选项顺序（A=第 1 个）
  - 数字 → **按 1-based**，且必须落在 `1..n` 之内；**`0` 或越界一律不认**
  - 字符串 → 与选项原文精确匹配（忽略大小写与多余空格）；匹配到多个 → **跳过**
  - 数组（如 `[1, 3]`）→ 多个正确答案；任一元素无法唯一对应 → **整条跳过**
  - 单/多选最终由正确选项个数决定：恰好 1 个 → 单选；≥ 2 个 → 多选

以下情况一律**跳过该条并在报告里说明**，绝不填默认值：

- 部分选项有 `correct` 标记、部分没有，且没有 `answer` 键
- 所有选项都显式 `false`
- 数值答案越界或为 `0`
- `answer` 同时匹配多个选项
- `answer` 数组为空，或数组里有越界 / 无法对应的元素
- `type: "true-false"` 但答案不是布尔值

`explanation` 是**可选**字段：三种题型（以及完形填空的每个空）都会原样保留，
缺失时是 `null`，不影响导入。

#### 完形填空

```json
{
  "type": "cloze",
  "passage": "Last week I {{1}} to the theatre and the man behind me was talking {{2}}.",
  "blanks": [
    { "number": 1, "options": ["went", "go", "goes"], "answer": 1, "explanation": "过去时。" },
    { "number": 2, "options": ["loud", "loudly", "louder"], "answer": 2 }
  ]
}
```

- 标记必须是 `{{1}}` 开始的**连续整数且不重复**（`{{1}} {{3}}` → 跳过）
- **每个空的 `answer` 是 1-based 索引，指向该空 `options` 里的选项**；解析时取
  `options[answer-1]` 的**文本**写入模型（`ClozeBlank` 结构不变，判定仍按文本比较）
  - `0` / 越界 / 非整数 → **跳过**；有索引但没有 `options` → **跳过**（无法确定答案）
  - 字符串答案在有词库且本身是纯数字时，同样按索引解释；否则按自由填空的文本
- **空号映射**：`number` 存在且全部合法 → 以 `number` 为准（可乱序）；
  全部缺失 → 退回数组顺序；**混用 / 非法 / 重复 / 越界 → 跳过**
- 答案个数必须与空数一致，且每个空都要有答案（缺一个 → 整条跳过）
- `blanks` 也可以写成 `answers: ["went", "loudly"]`（自由填空），或
  `{"1": "went", "2": "loudly"}`（键就是空号）
- 段落原文保留 `{{n}}` 标记，由渲染器替换成输入位

### 词汇 JSON

```json
{
  "title": "Lesson 01",
  "items": [
    { "word": "confidence", "example": "I have confidence in you.", "translation": "我对你有信心。" }
  ]
}
```

- 数组字段名：`items / words / vocabulary / wordList / list / data / entries`
- 每条只硬性要求一个非空 `word`（别名 `term / en / english / headword`）
- `example`（别名 `sentence / usage / sample`）与 `translation`（别名 `meaning / zh / chinese`）
  都可选，缺了就留 `null`，**不推测内容**
- 纯字符串数组（`["apple", "banana"]`）也算词表
- 缺 `word` 的条目跳过，其余照常导入

### 导入报告的两种结果

- `fatal` 非空：文件级问题（JSON 语法错、找不到数组、数组为空、顶层不是对象），整个文件不可用
- `fatal` 为空：**能识别的都进来了，不能识别的在 `skipped` 里**，每条带下标、原因、人话说明和原始片段

---

## 目录与分层规则

```
src/
  app/         路由与导航定义
  core/        纯 TypeScript：model / parse / grade / storage
  ui/          tokens、primitives、shell、clipboard、download —— 只当积木，不含业务判断
  state/       响应式外壳（Vue ref，无 Pinia）：把 core 接到 Vue 的唯一一层
  features/    home / import / quiz / vocab / wordbook —— 组装页面
    quiz/      QuizRunView + ChoiceQuestion / TrueFalseQuestion / ClozeQuestion (+ ClozePassage)
               QuestionCard / QuestionOptions（共用外壳与选项） + useQuizSession / copy-text
    wordbook/  WordbookView + WordbookRow + WordbookImportPanel + useWordbookTools
    vocab/     VocabReaderView + ReaderHud + VocabEntry + useVocabReader / useReadingProgress
```

依赖只能向下，规则见 `src/__tests__/layering.spec.ts`（**这条约束是可执行的测试**，不是注释）：

- `core/` 不 import `vue` / `vue-router` / `pinia` / 任何 `.vue` / `ui` / `state` / `features`
- `core/` 不碰 `localStorage` / `document` / `window`（唯一例外：`core/storage/local.ts` 这个适配器本身）
- `core/storage/` 只有 `local.ts` 能接触 `localStorage`，`wordbook.ts` / `recent.ts` 不行
- `parse/` 不依赖 `storage`，与 `grade/` 互不依赖，只共享 `model/`
- `storage/` 不依赖 `parse/` 或 `grade/`：存储不参与解析的兼容逻辑
- `features/` 不 import 任何 parser、不 import `core/storage/{local,wordbook}`、不碰 `localStorage`，
  也不 import `state` 的内部实现文件（只走 `useImport` / `useRecent` / `useWordbook` 门面）
- 断点只写在 `ui/shell/AppShell.vue`，features 里的视图不写布局媒体查询；
  需要浮在正文之上的 chrome 用 AppShell 给的 `--chrome-top`（手机 = 导航栏之下，平板 / Mac = 贴顶）

## 本地存储

全部数据只在这台设备的这个浏览器里，**零网络请求**，不生成用户标识、不写 cookie。
唯一的数据搬运方式是文件导出 / 导入。

### key 与信封

前缀 `english-site.`（GitHub Pages 的所有项目页共享同一 origin，也就是共享同一份
localStorage，所以前缀必须足够具体）。

| key | 内容 |
| --- | --- |
| `english-site.wordbook` | 生词本 |
| `english-site.recent.quiz` | 最近导入 · 做题 |
| `english-site.recent.vocab` | 最近导入 · 词汇 |

每个 key 存一个**信封**：`{"v":1, ...payload}`。版本放在值里而不是 key 里，
所以迁移只有「读出来 → 纯函数转换 → 写回去」一条路径，不存在「读旧 key、写新 key、删旧 key」
这种中途失败会留下两份数据的操作。

迁移表在 `src/core/storage/local.ts`（`MIGRATIONS`，v1 是首版所以现在是空的）。
只写「从 n 升到 n+1」一步；**改结构或语义才升版，新增可选字段不升版**。

### 生词本

```json
{"v":1,"words":["confidence","in my opinion","take off"]}
```

- 磁盘上就是 `string[]`，**只保存单词/短语本身**，没有 translation / example / addedAt / source
- 顺序即时间：最新加入的排在最前，所以不需要时间字段
- 存的是**首次录入的原文**（只做 trim + 连续空白折叠），`In my opinion` 的可读大小写会保留
- 去重键 `wordKey` = trim → 连续空白折叠 → lowercase；已存在时只提示、不改写原写法

导出格式（我们自己的形状）：

```json
{ "type": "wordbook", "version": 1, "words": ["confidence", "in my opinion"] }
```

导入**只接受这个格式**，而且是「先完整校验、再一次性整体覆盖（replace，不是合并）」：

- 任何一条不合法（type 不对、version 来自更新版本、words 不是数组、含非字符串/空白项）
  → 整体失败，**旧生词本一个字节都不动**，错误信息带下标
- 文件内部自身重复的条目：保留首次出现，并在结果里报出重复条数
- （把词汇 JSON 里的词批量加入生词本是后续业务功能，不走这条存储导入通道）

### 最近导入

- 做题 / 词汇各自一个 key，**各自最多 5 条**，第 6 条入册时淘汰最旧的一条，不提供手动删除
- 每条保存：`id`（内容哈希）、`title`、`filename`（粘贴导入为 null）、`importedAt`、
  `counts`（导入当时的报告快照，仅用于列表显示）、`raw`（**原始 JSON 文本**）
- **不保存解析后的内部模型**：打开时拿 `raw` 重新跑一遍 parser，所以 parser 改进后旧条目会自动变好
- 同一份内容重复导入不产生第二条，而是移到最前并刷新时间
- 单条上限 128KB，超出则拒绝记录（**本次导入本身不受影响**）

### 保护规则

| 情况 | 行为 |
| --- | --- |
| 存储不可用（隐私模式等） | 退化为内存模式，功能照常，关掉页面即失；`available=false` 供 UI 提示 |
| 读取到损坏数据 | 返回 `corrupt`，**绝不改动原值**（读取路径永不写盘） |
| 迁移失败 / 缺少迁移函数 | 返回 `unreadable`，同样不改动原值 |
| `v` 大于当前版本 | 返回 `future`：**只读、绝不写入**，避免把新数据降级覆盖 |
| 写入失败（配额等） | 保持磁盘旧值不变；生词本回滚内存状态，最近导入只是没记上 |
| 生词本损坏时做增量增删 | 拒绝（`corrupt`），改由「导入」这个显式覆盖动作来修 |
| 最近导入损坏 | 视为空并允许写入（它是缓存，否则该功能会永久失效） |
| 多标签页 | 不做跨标签同步，但写入前会**重新读取当前值**再合并，避免用过期副本覆盖 |

### 明确不保存

Quiz 进度 / 答题历史 / 分数与正确率 / 学习进度 一律不落盘（本次做题的统计只在内存，刷新即失）。
存下来的只有三样：生词本 words、最近导入 quiz 5 条、最近导入 vocab 5 条。

## 导入链路

三条入口，共用同一条链路（都在 `state/useImportFlow.ts` 里串起来，View 不做任何解析或存储）：

```
粘贴 JSON ─┐
选择文件 ─┼─→ state/useImportFlow.parse(kind, 文本, 文件名)
拖拽文件 ─┘        │
                  ├─→ core/parse   （read-json → skeleton → quiz-parse / vocab-parse）
                  ├─→ ImportReport （accepted / skipped / fatal，逐条原因）
                  └─→ pending（等用户看报告）
                          │ 用户点「开始做题 / 开始背单词」
                          ├─→ core/storage/recent 写入 **原始 JSON 文本** + 元数据
                          └─→ current（内存态）→ 路由进入 /quiz 或 /vocab
```

- 报告先把「成功导入 N 条 / 跳过 M 条」摆出来，被跳过的每条都能展开看原因与原始片段
- 一条都识别不出来时不允许继续（按钮禁用），也不会写最近导入
- **写最近导入失败不影响本次导入**：只是提示「这次没记入最近导入」，照样进入学习页
- 首页「最近导入」点开某条时，拿它保存的 `raw` **重新 parse**，所以 parser 改进后旧记录会自动变好
- 本次导入的数据只存在内存（`current`），刷新即失——与「不保存进度」一致

## 背单词

一份词表 = 一条连续的纵向阅读流：没有「下一词」按钮、没有翻卡 / 分页，靠滚动读下去。

```
VocabReaderView
  ├─ ReaderHud（浮在正文之上的玻璃 HUD，零高度 sticky 容器，不占正文排版空间）
  │    ├─ 眼睛按钮：全局翻译（显示全部 / 隐藏全部），只显示图标，不显示文字
  │    └─ 进度条：4px 轨道 + 32px 命中区，可拖动跳转，界面上不出现任何百分比数字
  └─ 阅读流（每条 = VocabEntry）
       ├─ word（大字）/ example（次要色）/ translation（默认 0fr 隐藏，展开时平滑撑开）
       └─ 右侧三个图标按钮（只有图标）：复制 / 生词 / 翻译
```

- 翻译默认全部隐藏；单个眼睛只管自己那一条；全局眼睛的语义是「只要还有没显示的 → 全部显示，
  已经全显示 → 全部隐藏」
- 复制只复制 `word` / `phrase` 本身（不带例句与翻译），反馈是把图标换成对勾（1.4s）
- 生词状态直接读 `state/useWordbook`（Stage 2 的 storage 与 wordKey 去重规则），
  刷新后从「最近导入」重新打开，收藏态依然保持
- 「当前词」= 鼠标悬停的那一条；没有悬停时取视口正中那一条。Mac 上用一根几乎看不见的 2px 强调条标识它
- Mac 快捷键：`G` 全局翻译、`C` 复制当前词、`W` 加 / 移出生词本（输入框聚焦时不抢键）
- 阅读进度、显示状态全是内存态：不保存阅读进度、不保存学习历史，换一份词表即重置
- iPhone 没有底部标签栏；宽屏下阅读列限宽 720px 居中

## 做题

一份题库导入后按题型**自动分组**（选择题 / 判断题 / 完形填空），顺着一条纵向流做下去：
没有「下一题」按钮、没有翻页、没有题库系统、没有成绩统计。完形填空是「做题」里的一种题型，不是独立模块。

```
QuizRunView
  ├─ 题库概况（标题 + 题数 + 各题型条数）
  ├─ 选择题 · N 题   ← 吸顶的分组标签
  │    └─ QuestionCard（题号 / 题型 / 判定胶囊 / 复制）
  │         └─ QuestionOptions（单选点选即判定；多选先选、点「提交」后统一判定）
  ├─ 判断题 · N 题   （True / False 两个大按钮，点选即判定）
  └─ 完形填空 · N 题
       ├─ ClozePassage（passage，{{1}}/{{2}} 渲染成带编号的空位，填了就显示所填内容）
       └─ 每个空的选项 / 文本框（全部填完才能提交，一次提交后逐空判定）
```

- **判定时机**：单选与判断题点选即判定；多选与完形填空填好后点「提交」统一判定；判定之后该题锁定
- **反馈克制**：只有描边 + 极浅底色 + 小图标（✓ / ✕）+ 一枚小胶囊，不用大红大绿块，也不弹 toast
- **完形填空**：上方整篇 passage，下方每个空的选项；提交后逐空给出对错、正确答案与该空的 explanation，
  整篇再给一个整体状态（全部正确 / 有 N 个空错误）
- **复制**（每题一个图标按钮）：题目 / statement / passage + 所有选项 + 我的答案；
  **不含正确答案，也不含 explanation**。完形填空复制时含完整 passage（保留 `{{n}}` 标记）、各空选项与我的答案。
  剪贴板被浏览器拒绝时（窗口不在前台等）会显示一行小字「复制失败」，不静默失败
- **键盘**：选项与按钮都是真 `<button>`，Tab 可聚焦（focus 环明显）、Enter / Space 可作答；不额外造快捷键
- **不保存**答题历史 / 分数 / 进度：作答状态只在内存里，刷新或重新打开题库即回到未作答

## 生词本

永久保存在这台设备上的单词 / 短语集合。**每一项只有 word / phrase 本身**：
不存 translation / example / 来源 / 时间 / 学习进度，页面上也不展开、不显示这些。

```
WordbookView
  ├─ 顶部：共 N 条 + [复制全部] [导入] [导出] + 一行状态（同时是 aria-live）
  ├─ 导入面板（按需展开）：粘贴 JSON / 选择文件 / 拖拽（拖到页面任意位置都行）
  └─ 列表：每行 = word/phrase + 两个图标按钮（Copy / Delete）
```

- **Copy**：单个只复制这个词本身；「复制全部」一行一个、按当前列表顺序、不追加额外内容。
  反馈是图标换成对勾 + 一行小字，不弹 toast；剪贴板被浏览器拒绝时那行小字会说「复制失败」
- **Delete**：立即从存储与列表移除，不需要二次确认，不影响「最近导入」；
  写盘失败时旧数据保持不变，行里会出现一行「删除失败」（不假装删掉了）
- **导出**：真的落成一个文件 `english-site-wordbook-<时间戳>.json`，
  内容就是既有导出格式 `{ "type": "wordbook", "version": 1, "words": [ … ] }`，格式一字不改
- **导入**：只认上面那一种格式。**整份验证通过才写入**（一次性整体覆盖）；
  无法解析 / 顶层不是对象 / `type` 不对 / `version` 不合法 / `words` 不是字符串数组 /
  任一条为空或非法 → 整次失败，原来的生词本**一个字节都不变**，并把具体原因列出来。
  不做部分导入，不做猜测
- **顺序与去重**：完全沿用 `core/storage/wordbook`（新加入的最前、大小写与连续空格不敏感、
  保留首次录入的拼写）。页面不实现第二套规则，只调 `state/useWordbook`
- **存储异常**（数据损坏 / 来自更新版本 / 读不出来）：列表为空并给出一条警示横幅，
  此时唯一的安全修复通道就是上面的「导入覆盖」

## UI 约定

- **iPhone 用顶部导航**（标题行 + 可横向滚动的导航行），**没有底部标签栏**；iPad / Mac 用左侧栏
- Light Mode；Liquid Glass 只用于浮在内容之上的 chrome（导航栏、HUD、浮动控制、报告卡、按钮），
  正文与列表用实色——**不整页玻璃化**，也不把玻璃叠在玻璃上
- 点按反馈在 `:active`（按下即响应），位移与缩放一律用 `transform`；缩放幅度按表面大小分档
  （整列/大卡 0.985、按钮与导航项 0.97、小圆钮 0.92、整行选项 0.99）
- `:hover` 一律包在 `@media (hover: hover) and (pointer: fine)` 里，避免触屏「粘住」悬停态；
  hover 填充统一用 `--row-hover`，主按钮 hover 用 `--accent-strong`
- 触控目标 ≥ 36px（正文里的图标按钮 36px、生词本行内按钮 40px、HUD 里的进度条命中区 32px 高）
- 支持 `prefers-reduced-motion` / `prefers-reduced-transparency` / `prefers-contrast`
- 系统字体；大字号收紧字距、正文接近 0；字号用 `clamp()` 跟着窄屏浮动，不靠断点
- **字号尺度**：正文类只有 12 / 13 / 14 / 15 / 16 / 17px（12 微型标注 · 13 说明 · 14 次要正文 ·
  15 按钮与导航 · 16 正文与选项 · 17 列表标题），标题走 h1/h2/h3（30 / 22 / 17）
- **极端内容**：所有承载导入内容（长单词 / 长 phrase / 连续无空格串 / 长标题 / 长解析 / 长错误信息）
  的容器都要 `overflow-wrap: anywhere`，任何正常输入都不允许产生横向滚动；也不用截断来回避问题
- 输入控件用 `font-size: max(13px, 16px)`，避免 iOS 聚焦时把整页放大
- 装饰性动画只在「状态真的变了」时出现（例如生词本写入成功才弹），不做无意义的点缀

## 其它架构约定

- **`vite.config.ts` 不纳入 type-check**（`tsconfig.json` 的 `include` 里没有它）：
  vitest 2 会在自己的目录下带一份 vite 5，与项目依赖的 vite 6 形成两套类型身份，导致
  `defineConfig` 里的 `vue()` 插件类型不匹配（**运行时无影响**，测试与构建都正常）。
  Vite 本身也不对配置文件做类型检查，这里保持一致；将来把 vitest 升到 v3 后可以重新纳入。
- **路由用 hash 模式**：GitHub Pages 是纯静态托管，没有 SPA fallback，hash 天然不会 404
- **外部 JSON 与内部模型解耦**：UI 永远看不到原始 JSON
- **Storage 与页面解耦**：页面只通过 `state/` 访问数据，不直接碰 `localStorage`
- **不保存**学习进度、答题历史、成绩；只保存生词本与最近导入

## 部署

推送到 `main` 分支会触发 `.github/workflows/deploy.yml`（type-check → lint → format-check → test → build → deploy）。

- 部署到**项目仓库**（`<user>.github.io/<repo>/`）：改 workflow 里的 `VITE_BASE: /<repo>/`
- 部署到**用户站根目录**（`<user>.github.io`）：把 `VITE_BASE` 设为 `/`

仓库 Settings → Pages → Source 需要选择 **GitHub Actions**。

## 设计参考

本地装有三份设计参考 skill（`~/.hermes/skills/design/`）：
`apple-design`（材质、手势、排版、无障碍）、`mobile-native`（手机端原生手感）、
`emil-design-eng`（设计工程总纲）。均为 Emil Kowalski 的 MIT 许可作品。
它们是**参考**：示例里的 React 代码只读思路与数值，落地一律用 Vue 3 + CSS。
