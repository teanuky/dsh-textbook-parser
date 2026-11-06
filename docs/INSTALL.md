# dsh-textbook-parser · 安装与使用说明（给别人看的版本）

> 理工科教材拆解插件：把整本教材整理成「全书 → 章 → 节 → 知识点」的嵌套卡片知识地图，
> 每个知识点都说明「它为了解决上一环什么缺陷而来」，并配**生活类比**与**可自学详解**帮助理解；
> 每节带**知识点汇总**与**多题型典型例题**，重点知识点带 **★ 星标**，可一键导出**交互式网页**（与侧栏一致）/ Word / PDF 到手机离线看。
> 本项目在 **DSH Desktop 0.2.1-rc.5（Web GUI / desktop profile）** 上实测通过，插件版本 **v1.2.0**。

---

## 一、环境要求

| 项目 | 要求 |
|---|---|
| DSH 版本 | 0.2.x（实测 0.2.1-rc.5；更老/更新版本槽位名可能变化，见 §七） |
| 运行形态 | 带 Web GUI 的 profile（Desktop 或 `dsh web`）——插件使用 `webServer` 服务提供只读接口 |
| 不适用 | 无 Web 层的 headless / ACP / SDK 一次性运行 profile（插件会因缺少 webServer 不激活） |
| 其他依赖 | 无。纯 JS、无构建、无 npm 依赖、不联网、不起进程 |
| 操作系统 | Windows / macOS / Linux 均可（路径由插件自动解析） |

---

## 二、拿到并安装插件

### 1. 获取插件目录

把 `dsh-textbook-parser-1.0.0.zip` 解压，得到 `textbook-parser/` 文件夹（其中必须有 `package.json`、`cordis.patch.yml`、`client.js` 等）。

放到一个**固定位置**，例如：

- Windows：`C:\Users\<你的用户名>\dsh-plugins\textbook-parser`
- macOS / Linux：`~/dsh-plugins/textbook-parser`

> ⚠️ 安装是「本地目录链接」方式：**装好后不要移动或删除这个目录**，否则插件失效，需要重新安装。

### 2. 在 DSH 里安装（推荐：让智能体执行）

新开一个对话，把下面这句话发给 DSH 智能体（把路径换成你的实际路径）：

```text
帮我安装本地插件目录 C:\Users\me\dsh-plugins\textbook-parser
（用 plugin_manager 的 install_bundle，target 填这个绝对路径）
```

智能体会调用 `plugin_manager`，返回里应看到：

```json
{ "stage": "enable", "target": "dsh-textbook-parser", "enabled": true, "application": "applied", "warnings": [] }
```

### 3. 刷新页面

安装是热生效的；若侧边栏还没看到图标，按一次 **F5** 刷新（个别版本需要重启一次 DSH）。
安装成功后：**左侧边栏出现「教材知识框架」图标**。

### 4. 自检安装是否成功

浏览器已登录的页面上访问（端口以你启动 DSH 时的实际端口为准）：

```text
http://127.0.0.1:53090/dsh-textbook-parser/api/health
```

正常返回类似：

```json
{"ok":true,"plugin":"dsh-textbook-parser","version":"1.0.0",
 "dataDir":"C:\\Users\\me\\.dsh\\textbook-parser",
 "skillRegistered":true,"toolRegistered":true,"routesRegistered":true,"books":1}
```

### 5. 卸载

```text
帮我卸载插件 dsh-textbook-parser（plugin_manager remove_bundle，target=dsh-textbook-parser）
```

然后 F5。用户数据仍在 `~/.dsh/textbook-parser/`，可手动备份或删除。

### 6. 升级（换新版本时）

用新版本内容**覆盖同一个目录**（路径保持不变）→ 重启一次 DSH（替换已安装包需要重新加载 JS 模块代际）。

---

## 三、使用：看内置示例

点左侧边栏 **「教材知识框架」**：

1. 默认进入内置示例《信号与系统》（郑君里第三版，12 章 / 116 节 / 263 个知识点）。
2. 顶部：教材下拉（多本教材时切换）、刷新按钮。
3. 全书页：总纲卡（总目标 / 原始痛点 / 迭代主线 / 缺陷→修复链路）+ 章卡片网格。
4. 点章卡 → 章视图（本章解决什么缺陷、前置、获得能力、仍存短板=下一章动机、章内链路、节卡片）。
5. 点节卡 → 知识点卡片（每个点写明“为修复什么缺陷而生”）。
6. 点知识点 → 详情：含义 / **生活类比** / 公式 / 应用 / 例题 / **本节典型例题** / **本节知识点汇总** / 前置 / 遗留不足 / 下一环；底部「上一环/下一环」；Esc 逐层返回。
7. 每节页面还会显示：**生活类比**、**本节知识点汇总**（一句话总览 + 逐条知识点作用）、**本节典型例题（4-6 道，覆盖概念判断/计算/推导证明/综合应用/易错辨析等题型，答案可折叠自测）**。
8. 中途可随时点面包屑回到上层；所有长文本完整显示、可换行，不截断、不横向滚动。

### 导出到手机 / 离线看

面板顶栏点「**导出**」，三选一：

| 选项 | 产物 | 用途 |
|---|---|---|
| 导出网页（.html） | 单个自包含 HTML 文件（内联样式/脚本、无外链、移动端自适应） | 发微信/邮件到手机，用浏览器打开即可离线复习；也可放网盘 |
| 导出 Word（.doc） | Word/WPS 可打开的文档 | 打印、批注、二次编辑 |
| 导出 PDF | 新窗口打开导出页并调起打印，选「另存为 PDF」 | 固定版式、适合手机阅读/打印 |

导出会先把整本书 12 章内容打包，顶部显示「正在整理 x/12 章…」进度；导出的页面包含全书总纲、目录、每章/每节/每个知识点、生活类比、本节汇总与全部例题（答案可折叠），与面板内容一致。

---

## 四、使用：让智能体拆解你自己的教材

技能会自动触发；也可以显式点名，最稳的提示词模板：

### 场景 1：整本 PDF / 长文本

```text
用 textbook-parser 拆解我这本书：D:\books\模拟电子技术基础.pdf
先建全书总纲和章/节骨架（save_book），再从第 1 章开始逐章拆（save_chapter），每章保存一次。
每章要包含：本章解决什么缺陷、前置依赖、获得能力、仍存短板、生活类比；
每节要包含：子问题、知识点汇总（summary：一句总览+逐条列出本节知识点作用）、生活类比、4-6 道覆盖题型的典型例题（概念判断/计算/推导证明/综合应用/易错辨析，source 标「教材例题改编/课后习题改编/典型题」，答案给步骤）；
每个知识点：诞生要解决什么问题、含义、生活类比、公式、应用、例题（具体可算）、前置、遗留不足、下一环。
全书总纲也要写 overview.analogy（整本书主线的生活类比）。
```

### 场景 2：只给目录截图

```text
用 textbook-parser 按这张目录截图建《XXX》的框架：[上传截图]
先 save_book 建骨架（含总纲生活类比）；有把握的章先拆，没把握的章保留骨架并在 remainingGap 注明待核对。
每节和每个知识点都要按 v1.1 要求写生活类比、知识点汇总和多题型例题。
```

### 场景 3：只给单章文本

```text
用 textbook-parser 拆这一章：[粘贴章节文本]
向上追溯它在全书主线中的位置（requires/solves），向下说明本章 remainingGap 承接的后续内容；
按 v1.1 补齐本节汇总、生活类比与 4-6 道多题型例题。
```

### 生成后

- 返回对话里会说「已写入」，并给出书 id、章/节/知识点统计；
- 打开「教材知识框架」面板，**点一次刷新**（或 F5）即可看到新书；顶部下拉切换到它。
- 面板是**只读浏览**：编辑/生成都通过对话让智能体完成。
- v1.1 的「生活类比 / 知识点汇总 / 多题型例题」规则写在技能里，**升级插件后需重启一次 DSH** 才会对新拆解生效；内置示例数据已包含这些内容，不受影响。

### 常用指令

| 想做什么 | 对智能体说 |
|---|---|
| 查看已有教材 | `用 textbook_archive 列出教材（list_books）` |
| 查某本/某章 | `用 textbook_archive 读取《XXX》第 3 章（get_book + chapterId）` |
| 删除自己拆的书 | `用 textbook_archive 删除 bookId=xxx（内置示例不可删）` |
| 修改某一章 | 重新提供该章内容，让它 `save_chapter` 覆盖该章 |

---

## 五、数据位置与迁移

- 用户数据：`~/.dsh/textbook-parser/books/<bookId>/`（Windows 为 `C:\Users\<你>\.dsh\textbook-parser\`）
  - `book.json`：全书总纲 + 章/节骨架
  - `chapters/chNN.json`：该章节与知识点详情
- 内置示例在插件包内 `data/books/`，**只读**；用户数据同名会覆盖内置。
- 备份/分享生成的教材：直接复制 `books/<bookId>/` 整个文件夹，放到对方机器同样的路径下即可（刷新后可见）。
- 公式是纯文本（Unicode，如 `H(jω)=1/(1+jωRC)`），不依赖 LaTeX 渲染器。

---

## 六、排错

| 现象 | 处理 |
|---|---|
| 侧边栏没有图标（v1.1.0 及更早） | **v1.1.1 已修复**「重启后图标消失」：原因是冷启动时客户端模块早于宿主声明槽位、注册抛错被吞。升级到 v1.1.1 后正常；旧版可临时重装（`remove_bundle` → `install_bundle`）恢复 |
| 侧边栏没有图标（v1.1.1 仍出现） | F5；仍未出现 → 打开浏览器开发者工具 Console 搜 `[textbook-parser]`，把 `... failed` 报错发给维护者；确认安装返回 `application:"applied"` |
| 面板显示「加载失败」 | 访问 `/dsh-textbook-parser/api/health` 看插件是否激活；再点重试 |
| 面板里看不到新拆的书 | 点面板刷新（或 F5）；确认智能体调用 `textbook_archive` 成功且 bookId 正确 |
| 智能体没调用工具 | 显式说「必须用 textbook_archive 落库，不要手写文件到插件目录」 |
| 安装报版本/依赖问题 | 本插件无依赖；若是 DSH 更新导致槽位 API 变化，需要更新插件版本 |
| 想完全恢复原状 | 卸载插件 + 删除 `~/.dsh/textbook-parser/`（可选） |

---

## 七、版本兼容说明（给维护者）

插件只使用以下稳定接口：

- Client 槽位：`main`（keyed）、`sidebar.panellist`（list）
- Host 服务：`ctx.skills.register`、`ctx.tools.register`、`ctx.webServer.register({kind:'prefix'})`
- Client 服务：`ctx.locale`，主题 token `--dsw-alias-*`
- 模块格式：`window.__ModuleLoader__.load({ id, factory(require) })` + `require('react')`

若新版 DSH 改了槽位名/注册参数，安装后可能出现「无图标/无面板」：用 `cordis_inspect_query`（Client `Slots.listSubTree`）查当前槽位，对应调整 `client.js` 注册参数即可。Host 端接口与数据格式不受影响。

---

## 八、安装方式进阶

- **本地目录（本说明默认）**：`plugin_manager install_bundle`，target=绝对目录。适合个人/团队内部共享。
- **npm 包**：维护者把 `package.json` 的 `"private": true` 去掉、发布到 registry 后，可直接 `install_bundle target=dsh-textbook-parser`（按包名解析）。
- **Git 仓库**：clone 到固定目录后按本地目录方式安装；或 `npm pack` 出 tarball，把 tarball 路径作为 target。

安装范围：**当前 profile 的所有会话**（不是单个项目）；不同 profile 需要各自安装。