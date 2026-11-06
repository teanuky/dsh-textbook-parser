# dsh-textbook-parser · 教材知识框架

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.x-blue)](https://github.com/deepseek-ai/deepseek-harness)
[![Version](https://img.shields.io/badge/version-1.3.0-green)]()

> **DSH 教材知识框架插件**：把任意理工科教材拆解成「**全书 → 章 → 节 → 知识点**」四层嵌套卡片知识地图。
> 每个知识点都回答同一个问题——**它是为了解决前面方案的什么缺陷而来**——知识不是名词堆砌，而是一条不断修复缺陷的迭代链。
> 支持一键导出**与侧栏完全一致的交互式网页**（手机离线可看）以及 Word / PDF。
>
> **能力演进**：v1.0 卡片式知识地图 → v1.1 详解/生活类比/★星标/多题型例题 → v1.2 定理卡片化 + 可折叠推导 + deepread 风格小节汇总 → v1.3 交互式导出网页 v2。

**English**: A DeepSeek Harness (DSH) plugin that turns STEM textbooks into a nested, card-based knowledge map driven by "which defect of the previous approach does this fix". Screenshots and full docs below. UI is Chinese; data files are JSON, easy to extend.

---

## ✨ 它长什么样（核心特点）

### ① 问题驱动 · 迭代链
整本书不是目录的复制，而是一条「**缺陷 → 修复 → 新缺陷 → 下一章**」的因果链：

```
全书总目标
 └─ 初代方案（有缺陷）
     └─ 知识点 A 修复了它（又留下新缺陷）
         └─ 知识点 B 修复了新缺陷（又留下更新的缺陷）
             └─ …… 每一章都是这样咬合的
```

- 章卡片上直接写明：**本章解决上一章什么缺陷**、获得什么能力、**仍存什么短板**（短板即下一章的引入动机）；
- 全书总纲页把这条链渲染成可视化的「缺陷 → 修复」流程条。

### ② 小卡片 · 层层下钻
四层结构，每层都是可点击的卡片，点开即下钻，`Esc`/面包屑随时回退：

| 层级 | 卡片内容 |
|---|---|
| **全书** | 总目标 / 原始痛点 / 迭代主线 / 缺陷→修复链路 / 一句话总结 |
| **章** | 解决什么缺陷 · 前置依赖 · 获得能力 · 仍存短板（→下一章动机）· 本章生活类比 · 节卡片网格 |
| **节** | 本节子问题 · **deepread 风格七段汇总**（一句话总结/核心结论/讲解结构/**知识点地图**/复习要点/易错点/前后联系）· 本节典型例题（4–6 道多题型，答案可折叠）· 知识点卡片 |
| **知识点** | **★ 星标（重点标记）** · 它要解决的问题（高亮块）· 含义 · 详细讲解（350–800 字自学材料）· 学习要点 · 生活类比 · **公式/定理卡片**（定理名+结论+适用条件+符号说明）· **推导过程（N 步，可折叠，每步只做一次变换并附算式）** · 应用 · 易错辨析 · **考试·应用提示** · 例题 · 本节典型例题 · 本节知识点汇总 · 前置 / 遗留不足 / 下一环 |

### ③ 深化汇总 · 保姆级推导
- **小节汇总**参考 [dsh-deepread](https://github.com/xiehuan123/dsh-deepread) 的报告结构：不再是一段笼统文字，而是七段结构化信息；
- **定理推导**是「保姆级」的：每一步**只做一次变换**（代入、移项、换元、两边同除……各自成步），**写出真实算式链**，关键步骤后附括号小字说明依据，最后一步以 ∎ 收尾——不是「这一步干什么」的讲解，而是「直接推给你看」。

### ④ 导出 · 随时随地复习
顶栏「导出」一键生成 **自包含单文件 HTML**（内联 CSS/JS、零外部资源、手机浏览器直接打开），渲染出与侧栏一致的交互式知识地图（四层下钻 / 面包屑 / ★ / 折叠答案 / hash 深链接）；另支持 Word（.doc）与 PDF（打印另存）。导出全部在客户端完成。

### ⑤ 智能体技能 + 落库工具
- 内置 **`textbook-parser` skill**：对话里说「用 textbook-parser 拆解《XXX》」，智能体自动按同一方法论拆解并入库；
- **`textbook_archive` 工具**：`save_book / save_chapter / list_books / get_book / delete_book`，带字段级校验，落库后面板立即可浏览；
- 拆解结果保存在 `$DSH_HOME/textbook-parser/books/<bookId>/`，纯 JSON，可备份可分享。

---

## 📦 安装

**要求**：DeepSeek Harness（DSH）0.2.x 且带 Web GUI（Desktop 或 `dsh web`）；无其他依赖（纯 JS，零 npm 包，不联网，不起进程）。

将仓库克隆或下载到本地固定目录后，在 DSH 对话里让智能体执行：

```text
用 plugin_manager 的 install_bundle 安装本地插件目录 <你存放的绝对路径>\dsh-textbook-parser
```

安装返回 `application:"applied"` 后刷新页面（F5），侧边栏即出现「**教材知识框架**」图标。

卸载：`plugin_manager remove_bundle target=dsh-textbook-parser`。

> 详细的排错、数据迁移、升级说明见 [docs/INSTALL.md](docs/INSTALL.md)。

## 🚀 快速开始

1. 点侧边栏「教材知识框架」→ 内置示例**《信号与系统》（郑君里第三版）**：12 章 / 116 节 / 263 知识点 / 601 道例题，全部带生活类比与详解；
2. 想拆自己的教材，在对话里说：

   ```text
   用 textbook-parser 拆解《模拟电子技术基础》，先 save_book 建骨架，再逐章 save_chapter，
   每个知识点要有：诞生要解决什么问题、含义、生活类比、公式、可算例题、遗留不足、下一环；
   每节要有知识点汇总和生活类比；重点知识点标 ★。
   ```

3. 复习时点「导出」→「导出网页（.html）」发到手机，离线可看。

## 🗂️ 目录结构

```
├── index.js                 Host 装配（skills / tools / webServer 三服务）
├── client.js                Web 面板（单文件 React.createElement，无构建器）
├── host/
│   ├── store.js             数据读写、合并、字段校验
│   ├── routes.js            只读 HTTP API（挂宿主同端口，无新进程）
│   ├── tool.js              textbook_archive 工具定义
│   └── skill.js             textbook-parser 技能注册
├── skills/textbook-parser/  SKILL.md + 数据 schema 参考
├── data/books/              内置示例《信号与系统》全量数据
├── locale/                  zh / en 文案
├── test/                    host 单测、client 静态检查、数据校验、导出审计
├── icon.svg  cordis.patch.yml  package.json  LICENSE
```

## 🔒 安全模型

- **零网络**：插件不发起任何外部请求（代码中仅 `localhost` 同源 API 与 `data:` URI）；
- **零进程**：不 spawn 子进程、不写注册表、不装系统依赖；
- **最小写入**：运行时只写 `$DSH_HOME/textbook-parser/`，不碰 profile 配置与其他插件；
- **只读 API**：HTTP 接口仅 GET，供面板取数，与宿主同源；
- **独立注册**：`cordis.patch.yml` 只 insert 自己的一行，不覆盖任何宿主/其他插件的槽位与配置；异常被 ErrorBoundary 隔离，卸载即随 `ctx.effect` 清理；
- **可审计**：全部代码为可读的未压缩 JS/JSON，无混淆、无二进制、无远程加载。

## 🙏 致谢与参考

本插件是独立作品，设计与交互参考了以下开源项目（**未复制任何源代码**）：

| 项目 | 许可证 | 借鉴点 |
|---|---|---|
| [archify](https://github.com/tt-a1i/archify) | Apache-2.0 | 嵌套卡片「知识地图」的呈现方式与下钻交互 |
| [dsh-deepread](https://github.com/xiehuan123/dsh-deepread) | MIT | 「问题驱动、证据先行」的阅读报告结构（本插件小节汇总七段结构与 skill 方法论参考） |

DSH（DeepSeek Harness）插件体系、槽位与服务接口属于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 项目。内置示例数据为独立撰写的复习总结（结构化为 JSON），不含教材原文。

## 📄 许可证

[MIT](LICENSE) © 2026 dsh-textbook-parser contributors

## 🔧 开发

```bash
node plugin/textbook-parser/test/host.test.mjs     # Host 单测（31 项）
node plugin/textbook-parser/test/client-check.mjs  # 客户端静态检查 + 交互冒烟（308+ 项）
node plugin/textbook-parser/test/validate-data.mjs # 教材数据 schema 校验
```

- 目标 DSH 版本：0.2.x（0.2.1-rc.5 实测）。槽位 API 变化时只需调整 `client.js` 的注册参数；
- 新增教材数据需通过 `validate-data.mjs` 与 `check-user-book.mjs` 双重校验。