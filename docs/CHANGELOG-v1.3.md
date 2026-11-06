# dsh-textbook-parser v1.3 验收报告

- 验收对象：`plugin/textbook-parser`（dsh-textbook-parser **1.3.0**），已安装进 desktop profile 并 live
- 环境：DSH 0.2.1-rc.5（Desktop，桌面 profile），GUI `http://127.0.0.1:50228`，Node v24.19.0
- 验收时间：2026-11-06 10:10–10:52 +08:00
- 对应需求：截图 `屏幕截图 2026-11-06 095851.png`（公式定理形式优化 / 可折叠推导 / 小节汇总深化）

## 0. 结论

**PASS（未发现功能缺陷）**。

⚠️ 流程说明：本轮 teammate 全部在启动时异常终止（团队运行时故障，无收尾消息、无文件产出），因此**全部实现与验收由 Lead 直接完成**。测试与校验均为实跑，非推断。

| 分组 | 结论 | 关键证据 |
|---|---|---|
| A 静态测试 | **PASS** | client-check（含 `--dump-export` 双书）**322/322**；host.test **31/31**；validate-data、check-user-book 全过 |
| B 数据 · 定理结构化 | **PASS** | 信号 263 条定理 + 805 步推导；高数 162 条定理 + 414 步推导；**两书 425 点 100% 含 math**；重点点带定理+推导 **100%**（116/116、81/81） |
| C 数据 · 小节 digest | **PASS** | 信号 116 节 + 高数 81 节 = **197 节全部含 digest 七段**（oneLine/corePoints/argumentChain/pointMap/takeaways/pitfalls/connections） |
| D 侧栏 UI | **PASS** | 定理卡片（名/结论/条件/符号）、多公式逐行、图片兜底 `<img>`、推导折叠默认收起→展开、digest 七段渲染、无字段回退（全部有断言） |
| E 导出 v3 | **PASS** | 双书样例：定理卡 / digest / 推导折叠 / 知识点地图样式齐全、`__TBP_DATA__` 内嵌、**0 http(s) 外链**、1.0MB / 2.0MB |
| F 回归 / 不干扰 | **PASS** | market 路由 200；profile 手工 patch 0 处 textbook 行（未改）；v1.1/v1.2 字段与统计未变；无新增端口 |

## 1. 三项需求的落实情况

### 需求①：完善公式定理板块

**改动前**：单行 `<pre>` 黑框，多个公式挤在一行（截图中 `y(t)=T[f(t)]；f(t) 为激励，y(t) 为响应` 就是一整条）。

**改动后**（`FormulaBlock` + `TheoremList`，侧栏与导出页双实现）：
- 多条公式按 `；` / `\n` **自动拆为独立公式卡**：居中、等宽 15px、行高 2.0、浅底细边框圆角；
- `point.math.theorems[]` **结构化定理卡**：定理编号徽标 + 定理名（加粗）→ 结论（居中放大公式）→「适用条件」标签列表（warn 色）→「符号说明」两列表（符号/含义）；
- **图片兜底**：`math.image.dataUrl` 存在时渲染 `<img>`（max-width:100%、圆角、alt/caption），优先级高于文本公式；
- 无 `math` 时回退 `formula` 文本，但同样拆行。

### 需求②：推导过程设置展开（形式同例题）

新增 `CollapsibleDerivation`：
- 位置：公式/定理板块之后、「应用」之前；
- 交互与「本节典型例题」完全一致：标题行 `定理推导过程（N 步）` + 右侧「展开 / 收起」，**默认收起**；
- 展开后：编号步骤列表（①②③ + step 标题 + detail 公式文本，等宽换行）；
- 数据源 `math.derivationSteps`；为空回退 `point.derivation`；两者皆空不渲染。

### 需求③：本节知识点汇总更详细（参考 dsh-deepread）

新增 `DigestBlock`，把原来一段 150-200 字的 summary 升级为**七段结构化信息卡**：
1. **一句话总结**（加粗大字、品牌色底）
2. **核心结论**（corePoints 列表）
3. **讲解结构**（argumentChain 编号步骤）
4. **知识点地图**（pointMap：编号 + 标题 + 定位句 role + 关键结论 keyIdea，★ 标记，可点击跳转，当前点高亮）
5. **复习要点**（takeaways）
6. **易错点**（pitfalls）
7. **前后联系**（connections.before「承接」/ after「铺垫」）
8. 底部保留原有「本节知识点列表」（带 ★、可点击）

无 digest 时自动回退原 summary 渲染（向后兼容）。

## 2. 数据规模

| 项 | 信号与系统 | 高等数学 | 合计 |
|---|---|---|---|
| 章 / 节 / 知识点 | 12 / 116 / 263 | 12 / 81 / 162 | 24 / 197 / 425 |
| 含 `math` 的知识点 | 263（100%） | 162（100%） | **425** |
| 结构化定理 | 263 条 | 162 条 | **425 条** |
| 推导步骤 | 805 步 | 414 步 | **1219 步** |
| 含 `digest` 的节 | 116（100%） | 81（100%） | **197 节** |
| 重点点带定理+推导 | 116/116 | 81/81 | **197/197（100%）** |

数据生成方式：以 v1.2 已有的高质量 `formula`（条件⇒结论形式）、`keyPoints`、`derivation`、`summary`（①②③ 分条）、`mistakes` 为基础，程序化拆分为结构化字段（`_recon/gen-enrich3.mjs`），再经 `merge-enrich3.mjs` 严格校验后合并。**未伪造任何公式内容**，`image` 字段一律为 `null`（不伪造 base64）。

## 3. 测试结果

```
node --check client.js / host/*.js / test/*.mjs            → 全部通过
node plugin/textbook-parser/test/client-check.mjs           → 308/308 通过
node plugin/textbook-parser/test/client-check.mjs --dump-export dist
                                                            → 322/322 通过（含双书导出审计 14 项）
node plugin/textbook-parser/test/host.test.mjs              → 31/31 通过
node plugin/textbook-parser/test/validate-data.mjs          → ✓ 通过（263 定理 / 805 步 / 116 节 digest）
node plugin/textbook-parser/test/check-user-book.mjs advanced-mathematics-tongji
                                                            → ✓ 通过（162 定理 / 414 步 / 81 节 digest）
```

新增 v1.3 断言（17 项）：定理名/结论/适用条件/符号说明渲染、多公式拆行、图片 `<img>` 渲染、推导折叠区标题、推导默认收起、展开后显示步骤、digest 七段（oneLine/corePoints/argumentChain/pointMap/takeaways/pitfalls/connections）、无字段回退、导出 v3 数据与 DOM、Word 含定理与推导、导出页推导默认收起。

## 4. live 验证

```
GET /dsh-textbook-parser/api/health
→ {"ok":true,"version":"1.3.0","skillRegistered":true,"toolRegistered":true,"routesRegistered":true,"books":2}

GET /api/books/signals-systems-zheng/chapters/ch03
→ section.digest.oneLine = "本节说明为什么需要频域：把信号拆成复指数…"
→ section.digest.pointMap = 2 条
→ point.math.theorems = 1 条，derivationSteps = 4 步
→ theorem = { name:"频域分析思想…", statement:"f(t) 分解为各频率分量之和…",
              symbols:[{sym:"f(t)",meaning:"激励信号（系统输入）"},…] }
```

## 5. 导出样例审计

| 文件 | 大小 | 定理卡 | digest | 推导折叠 | 知识点地图 | 外链 |
|---|---|---|---|---|---|---|
| export-sample-signals-systems.html | 2.0 MB | ✓ | ✓ | ✓ | ✓ | **0** |
| export-sample-advanced-mathematics.html | 1.0 MB | ✓ | ✓ | ✓ | ✓ | **0** |

两文件均含 `window.__TBP_DATA__` 内嵌数据、内联 CSS/JS、viewport、★ 标记、`@media print` 展开规则。

## 6. 未验证项（无浏览器控制）

- 面板/导出页的真实视觉效果（定理卡间距、公式居中观感、亮暗配色、手机端）
- 真实浏览器交互（点击展开动画、知识点地图跳转、hash 前进后退、打印对话框）
- 导出 Word 在 Word/WPS 中的实际排版（HTML 包装格式可能提示）
- Client Slots occupants 实时快照（本会话 inspect 桥接对 `input` 参数序列化异常，v1.1.1 轮同代码路径已验证过）

## 7. 已知限制（如实说明）

1. **定理的适用条件完整性**：条件从原 `formula` 中按 `⇒` / 「若…则」/ 关键词自动抽取，信号与系统（概念型 formula 居多）抽取率较低、高数约 31%；未抽取到的留空而非编造。
2. **推导步骤为「重排」而非「新增证明」**：detail 来自已有 `derivation` 文本与 `keyPoints` 的语义拆句，未新增数学证明内容。
3. **digest 的 role/keyIdea 来自已有 `solves`/`keyPoints`**：是结构化重排，未额外生成新论点。
4. 若需更高学术密度的定理条件与完整证明，需要内容同学逐点精修（本轮 teammate 故障，未能执行）。

## 8. 回滚

```text
plugin_manager action=remove_bundle target=dsh-textbook-parser
```
+ 刷新页面。数据不受影响；如需回到 v1.2 数据（无 math/digest），从 `dist/dsh-textbook-parser-1.2.0.zip` 解包恢复（用户书可从 `enrich3` 合并前状态重建，或删除 math/digest 字段）。

## 9. 证据索引

- 规格：`SPEC-V4.md`
- 生成与合并：`_recon/gen-enrich3.mjs`、`plugin/textbook-parser/test/merge-enrich3.mjs`
- 数据：`enrich3/`（24 个文件）、`plugin/textbook-parser/data/books/signals-systems-zheng/`、`C:\Users\27635\.dsh\textbook-parser\books\advanced-mathematics-tongji\`
- 导出样例：`dist/export-sample-*.html`
- 发行包：`dist/dsh-textbook-parser-1.3.0.zip`（695KB，sha256 `74d5f3aca958fea4…`）

—— 报告结束（Lead 直接执行，2026-11-06T10:52+08:00）