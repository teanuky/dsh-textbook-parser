# 贡献指南 · Contributing

感谢你愿意参与 **dsh-textbook-parser**（DSH 教材知识框架插件）！

本项目是一个面向 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的教材拆解插件：把理工科教材整理成「全书 → 章 → 节 → 知识点」四层嵌套卡片知识地图，强调**问题驱动的迭代链**（每个知识点都回答"它修复了前一个方案的什么缺陷"）。

---

## 🧭 我能做什么

| 类型 | 适合谁 | 入口 |
|---|---|---|
| **修 bug / 改 UI** | 前端同学 | `client.js`（单文件，无构建器） |
| **加数据字段 / 改校验** | 后端同学 | `host/store.js`、`host/routes.js`、`host/tool.js` |
| **补教材内容** | 内容同学 / 任��人 | `data/books/**` 与 `skills/textbook-parser/SKILL.md` |
| **写技能与文档** | 任��人 | `skills/textbook-parser/`、`docs/` |
| **翻译（zh ⇄ en）** | 任��人 | `locale/en.json`、`locale/zh.json` |

---

## 🚀 本地开发

```bash
git clone https://github.com/teanuky/dsh-textbook-parser.git
cd dsh-textbook-parser
```

无需 `npm install`——本项目**零运行时依赖**。

### 跑测试

```bash
node test/host.test.mjs      # Host 端单测（存储 / 工具 / 路由 / 技能 / 文档一致性）
node test/validate-data.mjs  # 内置教材数据 schema 校验
node test/client-check.mjs   # 客户端静态检查 + 假 DOM 交互冒烟
```

三个脚本都必须全绿才能提交。CI（GitHub Actions）会跑同样的检查，并额外执行两项安全审计：
**不得出现外部 URL**（除 `localhost` / `data:` URI / `w3.org`）与**不得出现密钥或本机绝对路径**。

### 装到本地 DSH 试用

在 DSH 对话里说：

```text
用 plugin_manager 的 install_bundle 安装本地插件目录 <你 clone 的绝对路径>
```

刷新页面（F5），侧栏会出现「教材知识框架」图标。

---

## 📐 代码与数据约定

### 1. 客户端（`client.js`）

- 单文件、纯 `React.createElement`（**不用 JSX**，没有构建步骤）；
- 类名一律 `tbp-` 前缀；样式只用 `--dsw-alias-*` / `--dsw-specific-sidebar-fill` 主题 token（亮暗自适应）；
- 客户端只 `require('react')`，不引入任何 Harness Client 包；
- 长文本不截断、不横向滚动（用户明确要求「完整显示，宁可框长」）；
- 面板异常必须被 `ErrorBoundary` 兜住，绝不影响宿主会话。

### 2. Host 端（`host/`）

- 三个服务：`skills` / `tools` / `webServer`，注册一律用 `ctx.effect` 托管生命周期；
- **只 insert 自己的一行**到 `cordis.patch.yml`，绝不覆盖宿主或其他插件的行；
- 运行时**只写** `$DSH_HOME/textbook-parser/`，不写 profile 配置、不写包内目录；
- **零网络、零子进程**——这是插件的安全底线，CI 会审计；
- 任何新字段都必须**向后兼容**：旧数据缺该字段时校验通过、UI 自动隐藏对应板块。

### 3. 教材数据（`data/books/**`）

- 纯 JSON、UTF-8 无 BOM、2 空格缩进；
- 章节/节/知识点的 id 必须与实际顺序一致且唯一（`ch01` / `1.1` / `1.1.1`）；
- 必填字段不能为空；`stats` 由脚本重算，别手填；
- 新增字段请同步更新 `skills/textbook-parser/references/schema.md` 与 `SKILL.md` 的字段表。

### 4. 内容质量（最重要）

拆解教材的核心原则是**问题驱动**，请务必守住：

- 每个知识点都要说清**它是为了解决前面方案的什么缺陷而来**；
- 章与章之间用 `solves` / `remainingGap` 咬合，形成「缺陷 → 修复 → 新缺陷」的链；
- `analogy`（生活类比）必须**映射回技术概念**，不能只写比喻；
- `detail` 是给人自学的材料，要能复述、禁止空话（「很重要」「需掌握」不算内容）；
- 例题必须**具体可算**，答案给步骤与结果，禁止「略」「参见教材」；
- `important`（★）只给真正的主干知识点，滥用等于没标。

---

## 🔀 提交流程

1. **开分支**：`feat/xxx` 或 `fix/xxx`；
2. **先跑测试**（上面三条命令）+ 确认没引入外链/密钥；
3. **提交信息**用祈使句、说明"改了什么、为什么"，例如：
   - `feat: 定理卡片支持图片兜底`
   - `fix: 小节卡片知识点数在章详情下显示为 0`
   - `docs: 补充安装与迁移说明`
4. **开 PR**，描述里写清：动机、变更点、测试结果、是否改了数据 schema；
5. 维护者会跑 CI 并 review；涉及 UI 观感的改动请附截图。

### 提交前自查清单

- [ ] `node test/host.test.mjs` / `validate-data.mjs` / `client-check.mjs` 全过
- [ ] 没有新增外部 URL（除 localhost / data: / w3.org）
- [ ] 没有密钥、token、本机绝对路径
- [ ] 新增/改名的数据字段已同步 `schema.md` 与 `SKILL.md`
- [ ] 旧数据仍能正常加载（向后兼容）
- [ ] UI 改动只用主题 token，且长文本不截断

---

## 🐛 报告 Bug

请开 issue，并附上：

- DSH 版本与 profile（`dsh --profile <name> --dump-config` 的相关行）；
- 复现步骤（对话里说了什么 / 点了哪里）；
- 期望与实际；
- 浏览器 Console 中 `[textbook-parser]` 开头的报错。

**安全问题请不要公开 issue**，见 [SECURITY.md](SECURITY.md) 的私密报告渠道。

---

## ❓ 提问

- 讨论与用法：开 issue 或 [Discussions](https://github.com/teanuky/dsh-textbook-parser/discussions)
- 拆教材的方法论：见 [`skills/textbook-parser/SKILL.md`](skills/textbook-parser/SKILL.md)

---

## 📜 许可

提交贡献即表示你同意你的贡献以 **MIT** 许可发布（见 [LICENSE](LICENSE)）。
同时请确认你有权贡献所提交的内容（尤其是教材相关内容——**不要提交教材原文或大段受版权保护的文本**，只提交你自己撰写的总结与梳理）。
