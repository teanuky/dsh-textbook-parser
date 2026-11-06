# textbook-parser 数据 Schema 速查（book.json + chapters/chNN.json，schemaVersion 1）

数据由 `textbook_archive` 工具写入，Web 面板只读展示（面板顶栏可导出**交互式网页 HTML（与侧栏一致、可离线手机看）** / Word / PDF，导出不需要新字段，全部由客户端完成）。
UTF-8、纯 JSON（无注释、无尾逗号）、2 空格缩进、无 BOM。

> **v1.1 扩展**：`overview.analogy`、章级 `analogy`、节的 `summary` / `analogy` / `examples`、知识点的 `analogy`。
> **v1.2 扩展**：知识点级 `important`（★重点）、`detail`（可自学详解）、`keyPoints`（学习要点）、`derivation`（推导思路）、`mistakes`（易错辨析）、`examTips`（考法提示）。
> 这些字段是 **schemaVersion 1 内的纯新增**：旧数据没有它们也能被面板正常渲染（隐藏对应板块）；本 skill 产出的新内容要求写全。

## 0. 存储位置与覆盖规则

| 项目 | 位置 | 说明 |
| --- | --- | --- |
| 用户数据（读写） | `$DSH_HOME/textbook-parser/books/<bookId>/` | 默认 `~/.dsh/textbook-parser/books/`；也可由插件 config 的 `dataDir` 覆盖 |
| 内置示例（只读） | 插件包内 `data/books/<bookId>/` | 内置《信号与系统》示例；用户同 id 书覆盖内置书 |
| 写入目标 | 永远写用户目录 | 内置示例不可删（`delete_book` 会报错），要改请换 bookId 另存 |

一本书的目录结构：

```text
books/<bookId>/
├── book.json              全书总纲 + 章/节骨架
└── chapters/
    ├── ch01.json          第 1 章：节 + 知识点详情
    ├── ch02.json
    └── ...
```

## 1. `book.json` 字段表

| 字段 | 类型 | 必填 | 约束 / 说明 |
| --- | --- | --- | --- |
| `schemaVersion` | number | 是 | 固定 `1`（v1.1 新字段不改变版本号） |
| `id` | string | 是 | kebab-case（`^[a-z0-9]+(-[a-z0-9]+)*$`），如 `signals-systems-zheng`；也是目录名 |
| `title` | string | 是 | 教材名 |
| `subtitle` | string | 否 | 版本/作者/册数，可空字符串 |
| `subject` | string | 是 | 科目，如 `电子信息` |
| `tags` | string[] | 是 | 关键词，可为空数组 |
| `updatedAt` | string | 否 | ISO 时间；工具保存时自动刷新 |
| `overview.goal` | string | 是 | 全书总目标 2-4 句 |
| `overview.pain` | string | 是 | 原始痛点 2-4 句 |
| `overview.mainline` | string | 是 | 一句话迭代主线 |
| `overview.analogy` | string | **v1.1 新必写** | 用生活类比讲整本书的主线/意义，2-4 句；必须映射回技术概念（校验：存在时非空字符串） |
| `overview.chain` | object[] | 是 | 至少 1 项（建议 3-6 项），每项 `{step, detail, defect}` |
| `chapters` | object[] | 是 | 至少 1 章；信号与系统示例为 12 章 |
| `stats` | object | 是 | `{chapters, sections, points}` 非负整数；可先填估算值，工具保存章后按实际重算 |

`chapters[i]`：

| 字段 | 类型 | 必填 | 约束 / 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | `ch` + 两位数字（`ch01`…`ch12`），全书唯一 |
| `number` | number | 是 | 必须等于 id 中的数字（`ch03` → 3），全书唯一 |
| `title` | string | 是 | 教材章名 |
| `solves` | string | 是 | 本章解决上一阶段哪个缺陷 |
| `requires` | string[] | 是 | 前置章节 / 先修知识，可为空数组 |
| `gain` | string | 是 | 本章完成后获得的能力 |
| `remainingGap` | string | 是 | 本章仍存短板（下一章动机） |
| `analogy` | string | **v1.1 新必写** | 用生活类比讲本章要解决的问题，2-4 句；与 `chapters/chNN.json` 章级 `analogy` 保持一致（校验：存在时非空字符串） |
| `sections` | object[] | 是 | 节骨架，可为空数组（保存章文件后自动补齐） |
| `sections[i].id` | string | 是 | 教材节号字符串，如 `"2.3"`（`^\d+(\.\d+)+$`），同章唯一 |
| `sections[i].title` | string | 是 | 节名 |
| `sections[i].subProblem` | string | 是 | 本节子问题 |
| `sections[i].pointCount` | number | 是 | 非负整数；必须与 `chapters/chNN.json` 中该节实际知识点数一致 |

## 2. `chapters/chNN.json` 字段表

章级：

| 字段 | 类型 | 必填 | 约束 / 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | `chNN`，与文件名一致（`ch01.json` ↔ `ch01`） |
| `number` | number | 是 | 与 id 中数字、book.json 该章 number 一致 |
| `title` / `solves` / `requires` / `gain` / `remainingGap` | — | 是 | 与 book.json 章级字段语义一致（内容保持一致） |
| `analogy` | string | **v1.1 新必写** | 章的生活类比，2-4 句，与 book.json 本章 `analogy` 一致（校验：存在时非空字符串） |
| `chain` | object[] | 是 | **至少 2 项**，每项 `{from, to, label}`，串起本章「缺陷 → 修复 → 新缺陷」 |
| `sections` | object[] | 是 | 至少 1 节（教材实际通常 ≥6 节） |

节级（`sections[i]`）：

| 字段 | 类型 | 必填 | 约束 / 说明 |
| --- | --- | --- | --- |
| `id` / `title` / `subProblem` | string | 是 | 节号、节名、子问题；节号同章唯一 |
| `requires` | string[] | 是 | 前置知识点，可为空数组 |
| `remaining` | string | 是 | 遗留不足，可为空字符串 |
| `summary` | string | **v1.1 新必写** | 本节知识点汇总：一句总览 + 逐条列出本节全部知识点及一句话作用（`\n` 分条，≤8 条）（校验：存在时非空字符串） |
| `analogy` | string | **v1.1 新必写** | 用生活类比理解本小节，1-3 句（校验：存在时非空字符串） |
| `examples` | object[] | **v1.1 新必写** | 本节典型例题，4-6 道（至少 3 道），覆盖多题型；同节 `id` 唯一（校验：存在时必须是数组且至少 1 项，逐项校验） |
| `points` | object[] | 是 | 至少 1 个知识点（教材实际通常 ≥2） |

`examples[i]`：

| 字段 | 类型 | 必填 | 约束 / 说明 |
| --- | --- | --- | --- |
| `id` | string | 建议 | 如 `"1.1-e1"`；同一节内唯一（校验：若提供须非空字符串且节内唯一） |
| `type` | string | 是 | 题型：概念判断 / 计算 / 推导证明 / 综合应用 / 易错辨析 / 设计/工程（每节至少覆盖 2 类，建议 3 类以上） |
| `source` | string | 是 | 来源性质：`教材例题改编` / `课后习题改编` / `典型题`（数据完整校验要求非空；Host 工具校验器对旧数据宽松：若提供须为字符串） |
| `question` | string | 是 | 题干，具体、可算/可判断 |
| `answer` | string | 是 | 解答步骤 + 最终答案，2-8 句（不能写「略」） |
| `note` | string | 否 | 可选：易错提示 / 考点（校验：若提供须字符串） |

知识点级（`points[j]`）：

| 字段 | 类型 | 必填 | 约束 / 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | `章.节.序号`（如 `"2.3.1"`），全章唯一 |
| `title` | string | 是 | 知识点名 |
| `solves` | string | 是 | **它诞生要解决的问题 / 前方案的具体缺陷**（禁止空话） |
| `meaning` | string | 是 | 具体含义（定义/公式/定理的实质），2-5 句 |
| `analogy` | string | **v1.1 新必写** | 生活类比解释这个知识点（它到底在干什么、为什么需要它），2-4 句；必须映射回技术概念（校验：存在时非空字符串） |
| `formula` | string | 是 | 关键公式/定理（纯文本 Unicode，如 `H(jω)=1/(1+jωRC)`）；无公式填空字符串 |
| `application` | string | 是 | 应用场景 / 工程用途，1-3 句 |
| `example.question` | string | 是 | 单题示例题干（具体、可算） |
| `example.answer` | string | 是 | 解答步骤与答案，2-6 句 |
| `prerequisites` | string[] | 是 | 前置知识点标题或 id，可为空数组 |
| `limitation` | string | 是 | 遗留不足 / 适用边界，可为空字符串 |
| `next` | string | 是 | 被哪个后续知识点修复，可为空字符串 |
| `important` | boolean | **v1.2 新必写** | 是否重点；`true` 时侧栏/导出显示 ★ +「重点」徽标（校验：存在时必须为布尔值） |
| `detail` | string | **v1.2 新必写** | 详细讲解 350-800 字，面向自学：①为什么需要它；②核心内容与关键结论；③怎么用（步骤/判别法）；④与前后知识点的关系（校验：存在时非空字符串；<50 字只告警不阻断） |
| `keyPoints` | string[] | **v1.2 新必写** | 3-6 条要点（每条 20-60 字），覆盖必须记住的结论 / 步骤 / 易错（校验：存在时必须是数组，1-10 项，每项非空字符串） |
| `derivation` | string | **v1.2 新必写（可空）** | 推导 / 证明 / 思路 100-300 字；定理、公式、方法类必写；纯概念类可 `""`（校验：存在时必须是字符串） |
| `mistakes` | string | **v1.2 新必写** | 易错辨析 80-200 字：常见错误、混淆点、边界条件（校验：存在时必须是字符串，可为 `""`） |
| `examTips` | string | **v1.2 新必写** | 考法 / 应用提示 50-150 字：常见题型、解题入口、工程 / 后续课程用途（校验：存在时必须是字符串，可为 `""`） |

**重点星标（★）与比例规则**：`important` 为 `true` 的知识点在侧栏与导出网页中显示 ★ +「重点」徽标；全书重点比例应控制在 **30%–45%**，且**每一节至少 1 个**重点（便于复习抓主线）；不要为了好看全标 `true`，也不要整节全 `false`。

写盘时工具会自动为缺失的 `requires`/`prerequisites` 补 `[]`、为 `formula`/`limitation`/`next`/`remaining` 补 `""`；但**必填的文本内容（title/solves/meaning/application/example/analogy/summary/detail）不能用空字符串**。
新字段（`analogy`、`summary`、`examples`、`important`、`detail`、`keyPoints`、`derivation`、`mistakes`、`examTips`）为向后兼容扩展：**旧数据没有这些字段时校验器会跳过、面板会隐藏对应板块；新拆解必须写全**。未知的自定义字段不会被 normalize 删除，会原样保留。

## 3. `textbook_archive` 工具参数速查

| 参数 | 类型 | 用于 | 说明 |
| --- | --- | --- | --- |
| `action` | string 枚举 | 全部 | `save_book` / `save_chapter` / `list_books` / `get_book` / `delete_book` |
| `bookId` | string | save_chapter / get_book / delete_book / save_book（补 id） | kebab-case 教材 id |
| `book` | object | save_book | 完整 book.json 对象（含 `overview.analogy`、每章 `analogy`） |
| `chapter` | object | save_chapter | 完整章对象（含章 `analogy`、节 `summary`/`analogy`/`examples`、知识点 `analogy` + v1.2 的 `important`/`detail`/`keyPoints`/`derivation`/`mistakes`/`examTips`） |
| `chapterId` | string | get_book | 可选，读取单章（如 `ch01`） |

典型顺序：

```text
save_book（总纲 + 章骨架，含 overview.analogy / 章 analogy）
  → save_chapter ch01 → save_chapter ch02 → ……（每章一次，含 summary/analogy/examples、point.analogy 与 v1.2 详解字段）
  → save_book（收尾，stats 按实际重算）
  → list_books / get_book 抽查
```

## 4. 校验错误示例与修正

工具返回的错误会逐条列出字段路径，例如：

```text
book.json 校验未通过（2 处）：
- chapters[3].sections[2].pointCount 必须是非负整数（当前："4"）
- chapters[5].id 重复：ch05（全书章 id 必须唯一）
```

```text
第 ch02 章数据校验未通过（chapters/ch02.json）（4 处）：
- sections[0].points[0].solves 必须是非空字符串（当前：""）
- sections[1].summary 必须是非空字符串（当前：缺失）
- sections[1].analogy 必须是非空字符串（当前：""）
- sections[2].examples[1].answer 必须是非空字符串（当前：""）
```

```text
第 ch03 章数据校验未通过（chapters/ch03.json）（2 处）：
- sections[0].examples 必须是数组，每项含 type/question/answer（当前：对象）
- sections[0].examples[2].id "1.1-e1" 在本节例题中重复（同一节内例题 id 必须唯一）
```

```text
book.json 校验未通过（1 处）：
- overview.analogy 必须是非空字符串（当前：""）
```

```text
第 ch02 章数据校验未通过（chapters/ch02.json）（3 处）：
- sections[0].points[0].important 必须是布尔值 true / false（当前："true"）
- sections[0].points[0].keyPoints 必须是字符串数组（建议 3-6 条，每项 20-60 字）（当前：对象）
- sections[0].points[0].detail 不能是空字符串（应写 350-800 字可自学详解）
```

```text
第 ch01 章校验提示（不影响保存，建议修正后重存）：
- sections[0].points[1].detail 只有 32 字，建议 ≥50 字（完整要求 350-800 字，便于直接自学）
```

```text
book.json 校验未通过（1 处）：
- 章 ch04：book.json 的节 4.2 写 pointCount="3"，但 chapters/ch04.json 实际有 5 个知识点（必须一致）
```

```text
未找到 bookId="my-book" 对应的 book.json；请先调用 textbook_archive(action="save_book", book={...}) 保存全书总纲与章骨架，再逐章保存。
```

修正原则：

1. 按 `-` 列表逐条定位字段（`chapters[3].sections[2]` 表示第 4 章的 3 号节，`sections[0].examples[2]` 表示该节第 3 道例题）；
2. 只改被点名的字段，然后**重试同一个 action**；
3. 不要通过删字段、手写文件、改内置数据来绕过校验；
4. `pointCount` 以章文件实际知识点数为准（工具保存章后会自动同步 book.json，也可先写章文件再保存 book）；
5. 新字段报「必须是非空字符串」时补写内容而不是删除字段（本 skill 要求新拆解写全 analogy/summary/examples/detail 等）；
6. 出现「校验提示（不影响保存）」时说明 `detail` 偏短，本次已写入，但建议按 350-800 字补全后重存。

## 5. 最小示例

见 `SKILL.md` §5 的完整 `book.json` + `chapters/ch01.json`（1 节 2 个知识点，含 v1.1 的 `overview.analogy`、章 `analogy`、节 `summary`/`analogy`/`examples`，以及 v1.2 的 `important`/`detail`/`keyPoints`/`derivation`/`mistakes`/`examTips`）。
真实拆解按教材实际章数补齐（信号与系统 12 章；高数按实际章），每章至少 6 节、每节至少 2 个知识点（按教材实际，允许更多），单章文件建议 ≤ 120KB。