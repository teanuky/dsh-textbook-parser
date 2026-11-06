window.__ModuleLoader__.load({
  id: 'dsh-textbook-parser',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React

    /* ───────────────────────── 文案字典（zh 权威，en 同键；缺键回退中文） ───────────────────────── */
    const ZHDICT = {
      nav: '教材知识框架', title: '教材知识框架', subtitle: '问题驱动 · 迭代链路',
      refresh: '刷新', refreshing: '刷新中…', loading: '加载中…', retry: '重试', back: '返回',
      book: '教材', allBooks: '全部教材', emptyTitle: '还没有教材框架',
      emptyHint: '在对话中让智能体用 textbook-parser 拆解你的教材，例如：',
      emptyCmd: '用 textbook-parser 拆解《信号与系统》郑君里第三版',
      goal: '全书总目标', pain: '原始痛点', mainline: '迭代主线', chain: '缺陷 → 修复 链路',
      overview: '全书总纲', chaptersTitle: '章节地图', defect: '缺陷',
      solves: '解决', requires: '前置依赖', gain: '获得能力', gap: '仍存短板', nextChapter: '下一章动机',
      sections: '节', points: '个知识点', subProblem: '本小节子问题',
      statCh: '章', statSec: '节', statPt: '个知识点',
      meaning: '含义', formula: '公式 / 定理', application: '应用', example: '例题',
      question: '题干', answer: '解答', prerequisites: '前置知识', limitation: '遗留不足', nextLink: '下一环',
      prev: '上一环', next: '下一环', chapter: '章', section: '节', point: '知识点',
      errTitle: '这部分内容加载失败', errHint: '请确认插件后端接口正常后重试；其它功能不受影响。',
      noChapter: '该章内容尚未生成', noPoints: '该节暂无知识点',
      noChapters: '该书章节尚未生成', noChain: '暂无链路数据',
      itSolves: '它要解决的问题', bornFor: '为修复缺陷而生',
      fullChain: '完整迭代链路', collapse: '收起',
      escHint: '按 Esc 返回上一层', updated: '更新于', tagsLabel: '标签',
      chPrefix: '第', chSuffix: '章', loadingBook: '正在加载教材…', loadingChapter: '正在加载章节…',
      emptyBookHint: '章节内容正在生成中，稍后刷新即可。',
      analogy: '生活类比', summary: '本节知识点汇总', sectionExamples: '本节典型例题',
      exampleUnit: '道', showAnswer: '显示答案', hideAnswer: '收起答案', expand: '展开', note: '提示',
      export: '导出', exportHtml: '导出网页（.html）', exportWord: '导出 Word（.doc）', exportPdf: '导出 PDF（打印）',
      exportHint: '导出为可离线阅读的单文件，不新增后台接口', exporting: '导出中…', preparing: '正在整理',
      preparingAll: '正在读取全部章节…', chaptersUnit: '章', exportOk: '已导出', exportFail: '导出失败',
      pdfFallback: '浏览器拦截了新窗口，已改为下载 HTML；打开后按 Ctrl+P 另存为 PDF。',
      pdfDone: '已打开打印窗口，请在打印对话框中选择「另存为 PDF」。',
      important: '重点', detail: '详细讲解', keyPoints: '学习要点', derivation: '推导思路',
      mistakes: '易错辨析', examTips: '考试 / 应用提示', importantUnit: '重点',
      noScriptHint: '需要在浏览器中启用 JavaScript 才能查看交互式知识地图。',
      home: '全书总览', viewMap: '知识地图',
      theorem: '定理', theoremUnit: '条', conditions: '适用条件', symbols: '符号说明',
      derivationSteps: '定理推导过程', stepUnit: '步', formulaImage: '公式图',
      digestOneLine: '一句话总结', digestCore: '核心结论', digestChain: '讲解结构',
      digestMap: '知识点地图', digestTakeaways: '复习要点', digestPitfalls: '易错点',
      digestConnections: '前后联系', digestBefore: '承接', digestAfter: '铺垫',
    }
    const ENDICT = {
      nav: 'Textbook Framework', title: 'Textbook Framework', subtitle: 'Problem-driven · Iterative chain',
      refresh: 'Refresh', refreshing: 'Refreshing…', loading: 'Loading…', retry: 'Retry', back: 'Back',
      book: 'Textbook', allBooks: 'All textbooks', emptyTitle: 'No framework yet',
      emptyHint: 'Ask the agent in chat to break down your textbook with textbook-parser, e.g.:',
      emptyCmd: 'Use textbook-parser to break down "Signals and Systems", Zheng Junli, 3rd ed.',
      goal: 'Overall goal', pain: 'Original pain', mainline: 'Iteration mainline', chain: 'Defect → Fix chain',
      overview: 'Book overview', chaptersTitle: 'Chapter map', defect: 'Defect',
      solves: 'Solves', requires: 'Prerequisites', gain: 'What you gain', gap: 'Remaining gap', nextChapter: 'Next motive',
      sections: 'sections', points: 'knowledge points', subProblem: 'Sub-problem',
      statCh: 'chapters', statSec: 'sections', statPt: 'points',
      meaning: 'Meaning', formula: 'Formula / theorem', application: 'Application', example: 'Example',
      question: 'Question', answer: 'Answer', prerequisites: 'Prerequisites', limitation: 'Limitation', nextLink: 'Next link',
      prev: 'Previous', next: 'Next', chapter: 'Chapter', section: 'Section', point: 'Point',
      errTitle: 'Failed to load this part', errHint: 'Check the plugin backend, then retry; other parts still work.',
      noChapter: 'This chapter has not been generated yet', noPoints: 'No knowledge points yet',
      noChapters: 'Chapters for this textbook have not been generated', noChain: 'No chain data',
      itSolves: 'The problem it solves', bornFor: 'Born to fix a defect',
      fullChain: 'Full iteration chain', collapse: 'Collapse',
      escHint: 'Press Esc to go back', updated: 'Updated', tagsLabel: 'Tags',
      chPrefix: 'Chapter ', chSuffix: '', loadingBook: 'Loading textbook…', loadingChapter: 'Loading chapter…',
      emptyBookHint: 'Chapter content is still being generated — refresh later.',
      analogy: 'Everyday analogy', summary: 'Section point summary', sectionExamples: 'Typical examples in this section',
      exampleUnit: 'problems', showAnswer: 'Show answer', hideAnswer: 'Hide answer', expand: 'Expand', note: 'Note',
      export: 'Export', exportHtml: 'Export webpage (.html)', exportWord: 'Export Word (.doc)', exportPdf: 'Export PDF (print)',
      exportHint: 'Exports a self-contained offline file; no backend changes', exporting: 'Exporting…', preparing: 'Preparing',
      preparingAll: 'Loading all chapters…', chaptersUnit: 'chapters', exportOk: 'Exported', exportFail: 'Export failed',
      pdfFallback: 'Popup blocked — downloaded the HTML instead. Open it and press Ctrl+P to save as PDF.',
      pdfDone: 'Print window opened — choose "Save as PDF" in the dialog.',
      important: 'Key', detail: 'Detailed explanation', keyPoints: 'Key takeaways', derivation: 'Derivation',
      mistakes: 'Common mistakes', examTips: 'Exam & application tips', importantUnit: 'key points',
      noScriptHint: 'Please enable JavaScript in your browser to view the interactive knowledge map.',
      home: 'Book overview', viewMap: 'Knowledge map',
      theorem: 'Theorem', theoremUnit: '', conditions: 'Conditions', symbols: 'Symbols',
      derivationSteps: 'Theorem derivation', stepUnit: 'steps', formulaImage: 'Formula image',
      digestOneLine: 'In one line', digestCore: 'Core conclusions', digestChain: 'Walkthrough',
      digestMap: 'Point map', digestTakeaways: 'Takeaways', digestPitfalls: 'Pitfalls',
      digestConnections: 'Connections', digestBefore: 'From', digestAfter: 'To',
    }

    /* ───────────────────────── 翻译 / 通用工具 ───────────────────────── */
    let T = (key) => (ZHDICT[key] !== undefined ? ZHDICT[key] : (ENDICT[key] !== undefined ? ENDICT[key] : key))
    function setTranslate(fn) { if (typeof fn === 'function') T = fn }
    function t(key) { return T(key) }
    function cs() { return Array.prototype.slice.call(arguments).filter(Boolean).join(' ') }

    function asText(value) {
      if (value === null || value === undefined) return ''
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      return ''
    }
    function asList(value) {
      if (!Array.isArray(value)) return []
      return value.map(asText).filter((item) => item.length > 0)
    }
    function errText(error) {
      if (!error) return 'unknown error'
      return asText(error && error.message) || asText(error) || 'unknown error'
    }
    function lsGet(key) {
      try {
        if (typeof localStorage === 'undefined' || !localStorage) return ''
        const value = localStorage.getItem(key)
        return typeof value === 'string' ? value : ''
      } catch (e) { return '' }
    }
    function lsSet(key, value) {
      try {
        if (typeof localStorage === 'undefined' || !localStorage) return
        localStorage.setItem(key, String(value))
      } catch (e) { /* 隐私模式 / 容量限制：静默忽略 */ }
    }
    function chapterName(meta) {
      const item = meta && typeof meta === 'object' ? meta : {}
      const number = asText(item.number)
      const title = asText(item.title)
      if (!number) return title || t('chapter')
      const label = t('chPrefix') + number + t('chSuffix')
      return title ? label + ' · ' + title : label
    }
    function countLabel(count, unitKey) {
      const n = Number(count)
      return (Number.isFinite(n) && n > 0 ? n : 0) + ' ' + t(unitKey)
    }
    /** 小节真实知识点数：章详情里 section 只有 points[]，book.json 里才有 pointCount。 */
    function sectionPointCount(section) {
      if (!section || typeof section !== 'object') return 0
      if (Array.isArray(section.points)) return section.points.length
      const count = Number(section.pointCount)
      return Number.isFinite(count) && count > 0 ? count : 0
    }
    function asExamples(value) {
      return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : []
    }
    function toneForType(type) {
      const text = asText(type)
      if (text.indexOf('易错') >= 0) return 'warn'
      if (text.indexOf('计算') >= 0 || text.indexOf('推导') >= 0 || text.indexOf('证明') >= 0) return 'brand'
      if (text.indexOf('综合') >= 0 || text.indexOf('设计') >= 0 || text.indexOf('工程') >= 0) return 'ok'
      return 'muted'
    }
    function escapeHtml(value) {
      return asText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    /* ───────────────────────── 样式（仅 token + color-mix 派生色，class 全 tbp- 前缀） ───────────────────────── */
    const STYLES = `
.tbp-root{box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13.5px;line-height:1.6;overflow:hidden}
.tbp-root-err{overflow:auto}
.tbp-root-inner{display:flex;flex-direction:column;height:100%;min-height:0;flex:1 1 auto}
.tbp-shell{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:20px 24px 40px;box-sizing:border-box}
.tbp-wrap{width:100%;max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.tbp-topbar{flex:none;display:flex;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 92%,transparent)}
.tbp-brand{display:flex;align-items:center;gap:10px;min-width:0}
.tbp-brand-mark{display:flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border-radius:9px;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}
.tbp-headings{min-width:0}
.tbp-title{margin:0;font-size:15px;font-weight:650;letter-spacing:.01em;white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word}
.tbp-subtitle{margin:0;font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word}
.tbp-grow{flex:1 1 auto;min-width:8px}
.tbp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12.5px;line-height:1;cursor:pointer;transition:background 150ms ease,border-color 150ms ease,color 150ms ease,transform 150ms ease}
.tbp-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);transform:translateY(-1px)}
.tbp-btn:disabled{opacity:.45;cursor:default;transform:none}
.tbp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tbp-btn-primary{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent);color:var(--dsw-alias-brand-primary)}
.tbp-select{height:30px;max-width:230px;padding:0 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12.5px}
.tbp-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tbp-view{display:flex;flex-direction:column;gap:14px}
.tbp-in{animation:tbp-in 180ms ease both}
@keyframes tbp-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.tbp-card{position:relative;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:16px 18px;box-sizing:border-box;min-width:0;box-shadow:0 1px 2px color-mix(in srgb,var(--dsw-alias-bg-overlay) 26%,transparent);transition:border-color 160ms ease,box-shadow 160ms ease,transform 160ms ease}
.tbp-card-hover:hover{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,var(--dsw-alias-border-l1));box-shadow:0 10px 22px color-mix(in srgb,var(--dsw-alias-bg-overlay) 42%,transparent);transform:translateY(-2px)}
.tbp-click{display:block;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;appearance:none}
.tbp-click:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tbp-eyebrow{margin:0 0 2px;font-size:10.5px;font-weight:650;letter-spacing:.09em;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}
.tbp-h2{margin:0;font-size:16px;font-weight:650;line-height:1.45}
.tbp-h3{margin:0;font-size:14px;font-weight:600;line-height:1.5}
.tbp-p{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.tbp-muted{color:var(--dsw-alias-label-tertiary)}
.tbp-num{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;flex:none;border-radius:10px;font-size:13px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,transparent)}
.tbp-chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:1px 8px;border-radius:999px;font-size:11.5px;line-height:19px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word;vertical-align:middle}
.tbp-chip-brand{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.tbp-chip-warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 32%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 11%,transparent)}
.tbp-chip-ok{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 32%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent)}
.tbp-chip-muted{color:var(--dsw-alias-label-tertiary)}
.tbp-chipline{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.tbp-chipline-label{flex:none;font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.tbp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:14px}
.tbp-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px}
.tbp-stats{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.tbp-overview{display:flex;flex-direction:column;gap:14px}
.tbp-overview-top{display:flex;align-items:flex-start;gap:12px;min-width:0}
.tbp-overview-main{min-width:0;display:flex;flex-direction:column;gap:3px}
.tbp-blocks3{display:grid;grid-template-columns:1fr;gap:12px}
.tbp-block{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 14px;min-width:0;box-sizing:border-box}
.tbp-block-goal{border-left:3px solid var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,var(--dsw-alias-bg-layer-1))}
.tbp-block-pain{border-left:3px solid var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,var(--dsw-alias-bg-layer-1))}
.tbp-block-gain{border-left:3px solid var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 7%,var(--dsw-alias-bg-layer-1))}
.tbp-block-gap{border-left:3px solid var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 6%,var(--dsw-alias-bg-layer-1))}
.tbp-block-next{border-left:3px solid var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,var(--dsw-alias-bg-layer-1))}
.tbp-block-label{font-size:11px;font-weight:650;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary);margin-bottom:4px}
.tbp-block-text{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.tbp-chain{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px}
.tbp-chain-node{flex:1 1 210px;min-width:0;max-width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);box-sizing:border-box}
.tbp-chain-step{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:2px;word-break:break-word}
.tbp-chain-detail{font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.tbp-chain-from{font-size:11.5px;color:var(--dsw-alias-label-tertiary);word-break:break-word}
.tbp-chain-to{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);word-break:break-word}
.tbp-chain-pair{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.tbp-chain-arrow{align-self:center;flex:none;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:1}
.tbp-timeline{display:flex;flex-direction:column;margin-top:6px}
.tbp-tl-item{position:relative;padding:0 0 14px 22px;margin-left:5px;border-left:1px solid var(--dsw-alias-border-l2)}
.tbp-tl-item:last-child{border-left-color:transparent;padding-bottom:0}
.tbp-tl-dot{position:absolute;left:-5px;top:5px;width:9px;height:9px;border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
.tbp-tl-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.tbp-chapter-card{display:flex;flex-direction:column;gap:8px;min-height:152px}
.tbp-chapter-top{display:flex;align-items:flex-start;gap:10px;min-width:0}
.tbp-chapter-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.tbp-chapter-title{font-size:14px;font-weight:650;line-height:1.45;word-break:break-word}
.tbp-solves-line{font-size:12px}
.tbp-solves-tag{margin-right:4px;color:var(--dsw-alias-brand-primary);font-weight:600}
.tbp-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l1);font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.tbp-arrow{flex:none;color:var(--dsw-alias-brand-primary);font-size:13px;transition:transform 160ms ease}
.tbp-click:hover .tbp-arrow{transform:translateX(3px)}
.tbp-crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary);min-height:26px}
.tbp-crumb-btn{border:none;background:none;padding:0;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px}
.tbp-crumb-btn:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}
.tbp-crumb-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tbp-crumb-cur{max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.tbp-crumb-sep{flex:none;opacity:.65}
.tbp-back{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;margin-right:4px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:1;cursor:pointer;transition:color 150ms ease,border-color 150ms ease}
.tbp-back:hover{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 34%,transparent)}
.tbp-back:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tbp-loading{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px 0;font-size:12.5px;color:var(--dsw-alias-label-tertiary)}
.tbp-spinner{width:14px;height:14px;flex:none;border-radius:50%;border:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 25%,transparent);border-top-color:var(--dsw-alias-brand-primary);animation:tbp-spin .7s linear infinite}
@keyframes tbp-spin{to{transform:rotate(360deg)}}
.tbp-skel{height:12px;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--dsw-alias-label-tertiary) 12%,transparent),color-mix(in srgb,var(--dsw-alias-label-tertiary) 22%,transparent),color-mix(in srgb,var(--dsw-alias-label-tertiary) 12%,transparent));background-size:200% 100%;animation:tbp-shimmer 1.3s ease-in-out infinite}
@keyframes tbp-shimmer{from{background-position:180% 0}to{background-position:-20% 0}}
.tbp-skel-card{display:flex;flex-direction:column;gap:10px;padding:16px 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);box-sizing:border-box}
.tbp-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:48px 24px;border:1px dashed var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}
.tbp-empty-mark{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:14px;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent)}
.tbp-empty-title{font-size:15px;font-weight:650}
.tbp-empty-hint{max-width:540px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.tbp-empty-code{margin-top:2px;padding:8px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);font-size:12px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}
.tbp-empty-inline{padding:24px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsw-alias-border-l1);border-radius:12px}
.tbp-error{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:18px 20px;border-radius:14px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,var(--dsw-alias-bg-layer-1));box-sizing:border-box}
.tbp-error-title{font-size:13.5px;font-weight:650;color:var(--dsw-alias-state-error-primary)}
.tbp-error-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.tbp-error-msg{max-width:100%;font-size:11.5px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}
.tbp-detail{display:flex;flex-direction:column;gap:14px}
.tbp-detail-head{display:flex;align-items:flex-start;gap:12px;min-width:0}
.tbp-detail-headmain{min-width:0;display:flex;flex-direction:column;gap:2px}
.tbp-detail-title{margin:0;font-size:18px;font-weight:650;line-height:1.4;word-break:break-word}
.tbp-detail-sub{font-size:12px;color:var(--dsw-alias-label-tertiary);word-break:break-word}
.tbp-hl{position:relative;padding:12px 14px 12px 16px;border-radius:12px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-1));box-sizing:border-box}
.tbp-hl::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:var(--dsw-alias-brand-primary)}
.tbp-hl-label{font-size:11px;font-weight:650;letter-spacing:.06em;color:var(--dsw-alias-brand-primary);margin-bottom:3px}
.tbp-hl-text{margin:0;font-size:13.5px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}
.tbp-blocks{display:grid;grid-template-columns:1fr;gap:12px}
.tbp-spanfull{grid-column:1/-1}
.tbp-formula{margin:0;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.7;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
/* ── v1.3 定理卡片 / 公式展示 ── */
.tbp-math{display:flex;flex-direction:column;gap:10px}
.tbp-theorem{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px}
.tbp-theorem-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tbp-theorem-no{flex:none;font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--dsw-alias-brand-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);border-radius:999px;padding:1px 8px;line-height:18px}
.tbp-theorem-name{font-size:13.5px;font-weight:700;color:var(--dsw-alias-label-primary);word-break:break-word}
.tbp-theorem-statement{margin:0;padding:11px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;line-height:2;color:var(--dsw-alias-label-primary);text-align:center;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.tbp-condline{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px}
.tbp-condline-label{flex:none;font-size:11px;font-weight:650;letter-spacing:.05em;color:var(--dsw-alias-state-warn-primary);padding-top:2px}
.tbp-symtable{display:grid;grid-template-columns:minmax(70px,max-content) 1fr;gap:5px 12px;font-size:12.5px;color:var(--dsw-alias-label-secondary);align-items:baseline}
.tbp-symtable dt{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-primary);word-break:break-word}
.tbp-symtable dd{margin:0;word-break:break-word}
.tbp-formula-card{margin:0;padding:11px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;line-height:2;color:var(--dsw-alias-label-primary);text-align:center;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.tbp-formula-img{display:block;max-width:100%;height:auto;margin:2px auto;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.tbp-formula-cap{margin:6px 0 0;font-size:11.5px;color:var(--dsw-alias-label-tertiary);text-align:center;word-break:break-word}
/* ── v1.3 推导步骤 ── */
.tbp-steps{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.tbp-step{display:flex;gap:10px;padding:9px 11px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);box-sizing:border-box}
.tbp-step-no{flex:none;width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}
.tbp-step-body{min-width:0;flex:1 1 auto}
.tbp-step-title{font-size:12.5px;font-weight:650;color:var(--dsw-alias-label-primary);word-break:break-word}
.tbp-step-detail{margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.85;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
/* v1.3.1：保姆级推导——纯算式行（等宽、可多行、左对齐缩进） */
.tbp-step-calc{align-items:flex-start;background:var(--dsw-alias-bg-layer-1)}
.tbp-step-line{margin:5px 0 0;padding:9px 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.95;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.tbp-step-why{margin:5px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary);padding-left:2px;border-left:2px solid var(--dsw-alias-border-l2);padding:3px 0 3px 8px}
/* ── v1.3 小节 digest（deepread 风格） ── */
.tbp-digest{display:flex;flex-direction:column;gap:12px}
.tbp-digest-one{margin:0;font-size:14.5px;font-weight:650;line-height:1.6;color:var(--dsw-alias-label-primary);padding:10px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--dsw-alias-bg-layer-1));word-break:break-word}
.tbp-digest-sec{display:flex;flex-direction:column;gap:5px}
.tbp-digest-label{font-size:11px;font-weight:650;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary)}
.tbp-digest-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.tbp-digest-list li{font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary);word-break:break-word}
.tbp-digest-chain{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;list-style:decimal}
.tbp-digest-chain li{font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary);word-break:break-word}
.tbp-dmap{display:flex;flex-direction:column;gap:6px}
.tbp-dmap-row{display:flex;gap:9px;align-items:flex-start;width:100%;text-align:left;padding:8px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);box-sizing:border-box;font:inherit;color:inherit;cursor:default}
button.tbp-dmap-row{cursor:pointer;transition:background .15s,border-color .15s}
button.tbp-dmap-row:hover{background:var(--dsw-alias-bg-overlay);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}
.tbp-dmap-row-cur{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--dsw-alias-bg-layer-1))}
.tbp-dmap-id{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;font-weight:650;color:var(--dsw-alias-brand-primary);min-width:44px}
.tbp-dmap-main{min-width:0;display:flex;flex-direction:column;gap:2px}
.tbp-dmap-title{font-size:12.5px;font-weight:650;color:var(--dsw-alias-label-primary);word-break:break-word;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.tbp-dmap-role{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.55;word-break:break-word}
.tbp-dmap-key{margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;color:var(--dsw-alias-label-tertiary);word-break:break-word}
.tbp-connect{display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--dsw-alias-label-secondary);line-height:1.6}
.tbp-connect-row{display:flex;gap:7px;align-items:flex-start;word-break:break-word}
.tbp-connect-tag{flex:none;font-size:10.5px;font-weight:700;letter-spacing:.05em;padding:1px 6px;border-radius:999px;line-height:16px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}
.tbp-example-q{margin:0;font-size:13px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}
.tbp-example-a{margin:6px 0 0;padding-top:6px;border-top:1px dashed var(--dsw-alias-border-l1);font-size:12.5px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.tbp-a-label{font-size:11px;font-weight:650;letter-spacing:.06em;color:var(--dsw-alias-state-success-primary);margin-bottom:2px}
.tbp-pager{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 6px}
.tbp-pager-btn{min-width:104px}
.tbp-pager-hint{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.tbp-icon{display:block}
.tbp-tagline{display:flex;flex-wrap:wrap;gap:6px}
.tbp-chapter-head{display:flex;flex-direction:column;gap:12px}
.tbp-gap-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px}
.tbp-gap-arrow{flex:none;color:var(--dsw-alias-state-warn-primary);font-weight:650}
@media (max-width:760px){.tbp-shell{padding:14px 14px 28px}.tbp-topbar{padding:10px 14px;flex-wrap:wrap}.tbp-detail-title{font-size:16px}.tbp-select{max-width:150px}.tbp-pager-hint{display:none}}
.tbp-analogy{border-left:3px solid var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,var(--dsw-alias-bg-layer-1));border-radius:12px;padding:12px 14px;min-width:0;box-sizing:border-box}
.tbp-analogy-label{font-size:11px;font-weight:650;letter-spacing:.06em;color:var(--dsw-alias-brand-primary);margin-bottom:4px}
.tbp-summary-text{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.tbp-pointlist{display:flex;flex-direction:column;gap:6px;margin-top:10px;padding:0;list-style:none}
.tbp-pointitem{display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer;box-sizing:border-box;transition:border-color 150ms ease,background 150ms ease,color 150ms ease}
button.tbp-pointitem:hover{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);color:var(--dsw-alias-label-primary)}
div.tbp-pointitem{cursor:default}
button.tbp-pointitem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tbp-pointitem-cur{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 46%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary)}
.tbp-pointitem-id{flex:none;font-variant-numeric:tabular-nums;font-weight:650;color:var(--dsw-alias-brand-primary)}
.tbp-pointitem-main{display:flex;flex-direction:column;gap:1px;min-width:0}
.tbp-pointitem-title{font-weight:600;color:var(--dsw-alias-label-primary);word-break:break-word}
.tbp-pointitem-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);word-break:break-word}
.tbp-examples{display:flex;flex-direction:column;gap:10px;min-width:0}
.tbp-example{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 14px;background:var(--dsw-alias-bg-layer-2);min-width:0;box-sizing:border-box}
.tbp-example-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:6px}
.tbp-example-no{font-size:12px;font-weight:650;color:var(--dsw-alias-brand-primary);font-variant-numeric:tabular-nums}
.tbp-example-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.tbp-example-answer{margin-top:8px;padding:10px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 28%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 6%,var(--dsw-alias-bg-layer-1))}
.tbp-example-a-label{font-size:11px;font-weight:650;letter-spacing:.06em;color:var(--dsw-alias-state-success-primary);margin-bottom:2px}
.tbp-example-a-text{margin:0;font-size:12.5px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.tbp-example-note{margin:8px 0 0;font-size:11.5px;color:var(--dsw-alias-state-warn-primary);white-space:pre-wrap;word-break:break-word}
.tbp-detail-blocks{display:flex;flex-direction:column;gap:12px;min-width:0}
.tbp-menu-wrap{position:relative;flex:none}
.tbp-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:210px;display:flex;flex-direction:column;padding:6px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);box-shadow:0 12px 28px color-mix(in srgb,var(--dsw-alias-bg-overlay) 42%,transparent);box-sizing:border-box}
.tbp-menu-item{display:block;width:100%;text-align:left;padding:8px 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer;white-space:normal;word-break:break-word}
.tbp-menu-item:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-label-primary)}
.tbp-menu-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.tbp-menu-tip{padding:6px 10px 4px;margin-top:4px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:normal;word-break:break-word}
.tbp-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:60;max-width:min(560px,calc(100vw - 40px));padding:10px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12.5px;box-shadow:0 12px 28px color-mix(in srgb,var(--dsw-alias-bg-overlay) 45%,transparent);white-space:normal;word-break:break-word}
.tbp-toast-err{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);color:var(--dsw-alias-state-error-primary)}
.tbp-progress{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:normal;word-break:break-word}
.tbp-star{color:var(--dsw-alias-state-warn-primary);font-size:13px;line-height:1;margin-right:3px;flex:none}
.tbp-starwrap{display:inline-flex;align-items:center;flex:none;margin-right:4px;vertical-align:middle}
.tbp-star-label{display:inline-block;margin-left:3px;padding:0 6px;border-radius:999px;font-size:10.5px;line-height:17px;color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 36%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent);white-space:normal;word-break:break-word;vertical-align:middle}
.tbp-title-row{display:flex;align-items:flex-start;flex-wrap:wrap;gap:8px;min-width:0}
.tbp-title-stars{display:inline-flex;align-items:center;flex:none;padding-top:4px}
.tbp-keypoints{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--dsw-alias-label-secondary)}
.tbp-keypoints li{word-break:break-word;line-height:1.7}
.tbp-keypoints li::marker{color:var(--dsw-alias-brand-primary);font-weight:650}
`
    /* ───────────────────────── 取数 ───────────────────────── */
    async function apiGet(path) {
      const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : 'http://localhost/'
      const url = new URL(path.replace(/^\/+/, ''), base).pathname + '?ts=' + Date.now()
      const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } })
      let body = null
      try { body = await res.json() } catch (e) { body = null }
      if (!res.ok) throw new Error((body && body.error) || ('HTTP ' + res.status))
      return body
    }

    /* ───────────────────────── 小部件 ───────────────────────── */
    function StyleTags() { return h('style', { 'data-tbp-style': 'main' }, STYLES) }

    function Spinner(props) {
      const label = (props && props.label) || t('loading')
      return h('div', { className: 'tbp-loading', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'tbp-spinner', 'aria-hidden': true }),
        h('span', null, label))
    }

    function EmptyState(props) {
      const onRefresh = props && typeof props.onRefresh === 'function' ? props.onRefresh : null
      return h('div', { className: 'tbp-empty' },
        h('div', { className: 'tbp-empty-mark', 'aria-hidden': true },
          h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
            h('path', { d: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 1 4 16V5.5Z' }),
            h('path', { d: 'M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 16V5.5Z' }),
            h('path', { d: 'M12 6v13' }))),
        h('div', { className: 'tbp-empty-title' }, t('emptyTitle')),
        h('div', { className: 'tbp-empty-hint' }, t('emptyHint')),
        h('div', { className: 'tbp-empty-code' }, t('emptyCmd')),
        onRefresh ? h('button', { type: 'button', className: 'tbp-btn tbp-btn-primary', onClick: onRefresh }, t('refresh')) : null)
    }

    function ErrorBox(props) {
      const message = asText(props && props.message)
      const onRetry = props && typeof props.onRetry === 'function' ? props.onRetry : null
      return h('div', { className: 'tbp-error', role: 'alert' },
        h('div', { className: 'tbp-error-title' }, t('errTitle')),
        h('div', { className: 'tbp-error-hint' }, t('errHint')),
        message ? h('div', { className: 'tbp-error-msg' }, message) : null,
        onRetry ? h('button', { type: 'button', className: 'tbp-btn tbp-btn-primary', onClick: onRetry }, t('retry')) : null)
    }

    function Chip(props) {
      const tone = asText(props && props.tone) || 'muted'
      const title = asText(props && props.title)
      return h('span', { className: cs('tbp-chip', 'tbp-chip-' + tone), title: title || undefined }, props ? props.children : null)
    }

    function Breadcrumb(props) {
      const item0 = props || {}
      const items = Array.isArray(item0.items) ? item0.items : []
      const nodes = []
      if (typeof item0.onBack === 'function') {
        nodes.push(h('button', { key: 'back', type: 'button', className: 'tbp-back', onClick: item0.onBack }, '← ' + t('back')))
      }
      items.forEach((raw, index) => {
        const item = raw && typeof raw === 'object' ? raw : { label: asText(raw) }
        const label = asText(item.label) || t('back')
        if (index > 0) nodes.push(h('span', { key: 'sep' + index, className: 'tbp-crumb-sep', 'aria-hidden': true }, '/'))
        const clickable = typeof item.onClick === 'function' && index < items.length - 1
        if (clickable) nodes.push(h('button', { key: 'item' + index, type: 'button', className: 'tbp-crumb-btn', onClick: item.onClick }, label))
        else nodes.push(h('span', { key: 'item' + index, className: 'tbp-crumb-cur', title: label }, label))
      })
      return h('nav', { className: 'tbp-crumbs', 'aria-label': t('nav') }, nodes)
    }

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
        this.reset = this.reset.bind(this)
      }
      static getDerivedStateFromError(error) { return { error: error || new Error('render error') } }
      componentDidCatch(error, info) {
        try { console.error('[textbook-parser] panel render failed:', error, info) } catch (e) { /* noop */ }
      }
      reset() { this.setState({ error: null }) }
      render() {
        if (!this.state.error) return this.props ? (this.props.children || null) : null
        return h('div', { className: 'tbp-root tbp-root-err' },
          h(StyleTags),
          h('div', { className: 'tbp-shell' },
            h('div', { className: 'tbp-wrap' },
              h(ErrorBox, { message: errText(this.state.error), onRetry: this.reset }))))
      }
    }/* ───────────────────────── 链路图（全书 chain / 章 chain 通用） ───────────────────────── */
    function ChainFlow(props) {
      const raw = Array.isArray(props && props.chain) ? props.chain : []
      const chain = raw.filter((item) => item !== null && item !== undefined && item !== '')
      if (!chain.length) return h('div', { className: 'tbp-empty-inline' }, t('noChain'))
      const nodes = []
      chain.forEach((entry, index) => {
        const item = entry && typeof entry === 'object' ? entry : { step: asText(entry) }
        const pair = !asText(item.step) && (asText(item.from) || asText(item.to))
        const step = asText(item.step)
        const detail = asText(item.detail)
        const defect = asText(item.defect)
        const label = asText(item.label)
        let body = null
        if (pair) {
          body = h('div', null,
            h('div', { className: 'tbp-chain-pair' },
              asText(item.from) ? h('span', { className: 'tbp-chain-from' }, asText(item.from) + ' →') : null,
              h('span', { className: 'tbp-chain-to' }, asText(item.to) || '·'),
              label ? h(Chip, { tone: 'brand' }, label) : null),
            detail ? h('div', { className: 'tbp-chain-detail' }, detail) : null)
        } else {
          body = h('div', null,
            h('div', { className: 'tbp-chain-step' }, step || asText(item.to) || '·'),
            detail ? h('div', { className: 'tbp-chain-detail' }, detail) : null,
            defect ? h('div', { className: 'tbp-chipline', style: { marginTop: 6 } }, h(Chip, { tone: 'warn' }, t('defect') + '：' + defect)) : null)
        }
        if (index > 0) nodes.push(h('span', { key: 'arrow' + index, className: 'tbp-chain-arrow', 'aria-hidden': true }, '→'))
        nodes.push(h('div', { key: 'node' + index, className: 'tbp-chain-node' }, body))
      })
      return h('div', { className: 'tbp-chain' }, nodes)
    }

    /* ───────────────────────── 全书总纲大卡 ───────────────────────── */
    function OverviewCard(props) {
      const book = (props && props.book) || {}
      const overview = book.overview && typeof book.overview === 'object' ? book.overview : {}
      const chain = Array.isArray(overview.chain) ? overview.chain.filter(Boolean) : []
      const tags = asList(book.tags)
      const [full, setFull] = useState(false)
      const updated = asText(book.updatedAt)
      const metaBits = []
      if (asText(book.subject)) metaBits.push(asText(book.subject))
      if (updated) metaBits.push(t('updated') + ' ' + updated.replace('T', ' ').slice(0, 16))
      const toggle = () => setFull((value) => !value)
      return h('section', { className: 'tbp-card tbp-overview' },
        h('div', { className: 'tbp-overview-top' },
          h('span', { className: 'tbp-num', 'aria-hidden': true }, '◎'),
          h('div', { className: 'tbp-overview-main' },
            h('p', { className: 'tbp-eyebrow' }, t('overview')),
            h('h2', { className: 'tbp-h2' }, asText(book.title) || t('book')),
            asText(book.subtitle) ? h('div', { className: 'tbp-subtitle' }, asText(book.subtitle)) : null,
            tags.length ? h('div', { className: 'tbp-tagline' }, tags.map((tag, index) => h(Chip, { key: 'tag' + index, tone: 'muted' }, tag))) : null,
            metaBits.length ? h('div', { className: 'tbp-stats' }, metaBits.join(' · ')) : null)),
        h('div', { className: 'tbp-blocks3' },
          h('div', { className: 'tbp-block tbp-block-goal' },
            h('div', { className: 'tbp-block-label' }, t('goal')),
            h('p', { className: 'tbp-block-text' }, asText(overview.goal) || '—')),
          h('div', { className: 'tbp-block tbp-block-pain' },
            h('div', { className: 'tbp-block-label' }, t('pain')),
            h('p', { className: 'tbp-block-text' }, asText(overview.pain) || '—')),
          h('div', { className: 'tbp-block tbp-block-next' },
            h('div', { className: 'tbp-block-label' }, t('mainline')),
            h('p', { className: 'tbp-block-text' }, asText(overview.mainline) || '—'))),
        h(AnalogyBox, { text: asText(overview.analogy) }),
        h('div', { className: 'tbp-section-head' },
          h('div', { className: 'tbp-block-label', style: { marginBottom: 0 } }, t('chain')),
          chain.length ? h('button', { type: 'button', className: 'tbp-btn', onClick: toggle, 'aria-expanded': full }, full ? t('collapse') : t('fullChain')) : null),
        h(ChainFlow, { chain }),
        full && chain.length ? h('div', { className: 'tbp-timeline' }, chain.map((entry, index) => {
          const item = entry && typeof entry === 'object' ? entry : { step: asText(entry) }
          return h('div', { key: 'tl' + index, className: 'tbp-tl-item' },
            h('span', { className: 'tbp-tl-dot', 'aria-hidden': true }),
            h('div', { className: 'tbp-tl-body' },
              h('div', { className: 'tbp-chain-step' }, asText(item.step) || asText(item.to) || ('#' + (index + 1))),
              asText(item.detail) ? h('div', { className: 'tbp-chain-detail' }, asText(item.detail)) : null,
              asText(item.defect) ? h('div', { className: 'tbp-chipline' }, h(Chip, { tone: 'warn' }, t('defect') + '：' + asText(item.defect))) : null))
        })) : null)
    }

    /* ───────────────────────── 章卡片 ───────────────────────── */
    function ChapterCard(props) {
      const meta = (props && props.meta) || {}
      const onOpen = props && typeof props.onOpen === 'function' ? props.onOpen : null
      const sections = Array.isArray(meta.sections) ? meta.sections : []
      const pointCount = sections.reduce((sum, section) => sum + sectionPointCount(section), 0)
      const requires = asList(meta.requires)
      const shown = requires.slice(0, 3)
      const number = asText(meta.number) || asText(meta.id).replace(/^ch0*/i, '') || '·'
      return h('button', {
        type: 'button',
        className: 'tbp-card tbp-card-hover tbp-click tbp-chapter-card',
        onClick: onOpen || undefined,
        'aria-label': chapterName(meta),
      },
        h('div', { className: 'tbp-chapter-top' },
          h('span', { className: 'tbp-num' }, number),
          h('div', { className: 'tbp-chapter-main' },
            h('div', { className: 'tbp-chapter-title' }, asText(meta.title) || t('chapter')),
            asText(meta.solves) ? h('p', { className: 'tbp-p tbp-solves-line' },
              h('span', { className: 'tbp-solves-tag' }, t('solves')),
              asText(meta.solves)) : null)),
        shown.length ? h('div', { className: 'tbp-chipline' },
          h('span', { className: 'tbp-chipline-label' }, t('requires')),
          shown.map((text, index) => h(Chip, { key: 'r' + index, tone: 'muted' }, text)),
          requires.length > shown.length ? h(Chip, { key: 'more', tone: 'muted' }, '+' + (requires.length - shown.length)) : null) : null,
        h('div', { className: 'tbp-card-foot' },
          h('span', null, countLabel(sections.length, 'sections') + ' · ' + countLabel(pointCount, 'points')),
          h('span', { className: 'tbp-arrow', 'aria-hidden': true }, '→')))
    }

    /* ───────────────────────── 全书视图 ───────────────────────── */
    function BookView(props) {
      const book = (props && props.book) || {}
      const onOpenChapter = props && typeof props.onOpenChapter === 'function' ? props.onOpenChapter : null
      const chapters = Array.isArray(book.chapters)
        ? book.chapters.filter((item) => item && (asText(item.id) || asText(item.title)))
        : []
      let chapterCount = chapters.length
      let sectionCount = 0
      let pointCount = 0
      chapters.forEach((meta) => {
        const sections = Array.isArray(meta.sections) ? meta.sections : []
        sectionCount += sections.length
        sections.forEach((section) => { pointCount += sectionPointCount(section) })
      })
      const stats = book.stats && typeof book.stats === 'object' ? book.stats : {}
      if (Number(stats.chapters) > chapterCount) chapterCount = Number(stats.chapters)
      if (Number(stats.sections) > sectionCount) sectionCount = Number(stats.sections)
      if (Number(stats.points) > pointCount) pointCount = Number(stats.points)
      const statLine = chapterCount + ' ' + t('statCh') + ' · ' + sectionCount + ' ' + t('statSec') + ' · ' + pointCount + ' ' + t('statPt')
      return h('div', { className: 'tbp-view tbp-in' },
        h(OverviewCard, { book }),
        h('div', { className: 'tbp-section-head' },
          h('h2', { className: 'tbp-h2' }, t('chaptersTitle')),
          h('span', { className: 'tbp-stats' }, statLine)),
        chapters.length
          ? h('div', { className: 'tbp-grid' }, chapters.map((meta, index) => h(ChapterCard, {
            key: asText(meta.id) || ('ch' + index),
            meta,
            onOpen: () => { if (onOpenChapter) onOpenChapter(meta.id) },
          })))
          : h('div', { className: 'tbp-card' },
            h('div', { className: 'tbp-empty-inline' }, t('noChapters')),
            h('p', { className: 'tbp-p', style: { textAlign: 'center', marginTop: 8 } }, t('emptyBookHint'))))
    }

    /* ───────────────────────── 章头卡（solves / requires / gain / gap / chain） ───────────────────────── */
    function ChapterHeader(props) {
      const meta = (props && props.meta) || {}
      const chapter = props && props.chapter && typeof props.chapter === 'object' ? props.chapter : {}
      const solves = asText(chapter.solves) || asText(meta.solves)
      const gain = asText(chapter.gain) || asText(meta.gain)
      const gap = asText(chapter.remainingGap) || asText(meta.remainingGap)
      const requires = asList(chapter.requires).length ? asList(chapter.requires) : asList(meta.requires)
      const chain = Array.isArray(chapter.chain) ? chapter.chain : []
      const analogy = asText(chapter.analogy) || asText(meta.analogy)
      return h('section', { className: 'tbp-card tbp-chapter-head' },
        h('div', { className: 'tbp-overview-top' },
          h('span', { className: 'tbp-num' }, asText(meta.number) || '·'),
          h('div', { className: 'tbp-overview-main' },
            h('p', { className: 'tbp-eyebrow' }, t('chapter')),
            h('h2', { className: 'tbp-h2' }, chapterName(meta)),
            requires.length ? h('div', { className: 'tbp-chipline', style: { marginTop: 4 } },
              h('span', { className: 'tbp-chipline-label' }, t('requires')),
              requires.map((text, index) => h(Chip, { key: 'req' + index, tone: 'muted' }, text))) : null)),
        h('div', { className: 'tbp-blocks3' },
          h('div', { className: 'tbp-block tbp-block-goal' },
            h('div', { className: 'tbp-block-label' }, t('solves')),
            h('p', { className: 'tbp-block-text' }, solves || '—')),
          h('div', { className: 'tbp-block tbp-block-gain' },
            h('div', { className: 'tbp-block-label' }, t('gain')),
            h('p', { className: 'tbp-block-text' }, gain || '—')),
          h('div', { className: 'tbp-block tbp-block-gap' },
            h('div', { className: 'tbp-gap-line' }, h('span', { className: 'tbp-block-label', style: { marginBottom: 0 } }, t('gap')),
              h('span', { className: 'tbp-gap-arrow', 'aria-hidden': true }, '→ ' + t('nextChapter'))),
            h('p', { className: 'tbp-block-text' }, gap || '—'))),
        h(AnalogyBox, { text: analogy }),
        chain.length ? h('div', null,
          h('div', { className: 'tbp-block-label', style: { marginBottom: 6 } }, t('chain')),
          h(ChainFlow, { chain })) : null)
    }

    /* ───────────────────────── 节卡片 ───────────────────────── */
    function SectionCard(props) {
      const section = (props && props.section) || {}
      const onOpen = props && typeof props.onOpen === 'function' ? props.onOpen : null
      const pointCount = sectionPointCount(section)
      const requires = asList(section.requires)
      return h('button', {
        type: 'button',
        className: 'tbp-card tbp-card-hover tbp-click',
        onClick: onOpen || undefined,
        'aria-label': (asText(section.id) + ' ' + asText(section.title)).trim() || t('section'),
      },
        h('div', { className: 'tbp-chapter-top' },
          h('span', { className: 'tbp-num' }, asText(section.id) || '·'),
          h('div', { className: 'tbp-chapter-main' },
            h('div', { className: 'tbp-chapter-title' }, asText(section.title) || t('section')),
            asText(section.subProblem) ? h('p', { className: 'tbp-p tbp-solves-line' },
              h('span', { className: 'tbp-solves-tag' }, t('subProblem')),
              asText(section.subProblem)) : null)),
        requires.length ? h('div', { className: 'tbp-chipline' },
          h('span', { className: 'tbp-chipline-label' }, t('requires')),
          requires.slice(0, 3).map((text, index) => h(Chip, { key: 'sr' + index, tone: 'muted' }, text))) : null,
        h('div', { className: 'tbp-card-foot' },
          h('span', null, countLabel(pointCount, 'points')),
          h('span', { className: 'tbp-arrow', 'aria-hidden': true }, '→')))
    }

    /* ───────────────────────── 章视图 ───────────────────────── */
    function ChapterView(props) {
      const book = (props && props.book) || {}
      const chapterId = asText(props && props.chapterId)
      const detail = props && props.chapter && typeof props.chapter === 'object' ? props.chapter : null
      const chapters = Array.isArray(book.chapters) ? book.chapters : []
      const meta = chapters.filter((item) => item && asText(item.id) === chapterId)[0] || detail || {}
      const sections = detail && Array.isArray(detail.sections) && detail.sections.length
        ? detail.sections
        : (Array.isArray(meta.sections) ? meta.sections : [])
      const loading = !!(props && props.loading)
      const error = asText(props && props.error)
      const onRetry = props && typeof props.onRetry === 'function' ? props.onRetry : null
      const onBack = props && typeof props.onBack === 'function' ? props.onBack : null
      const onOpenSection = props && typeof props.onOpenSection === 'function' ? props.onOpenSection : null
      const known = !!detail
      return h('div', { className: 'tbp-view tbp-in' },
        h(Breadcrumb, {
          items: [{ label: asText(book.title) || t('book'), onClick: onBack }, { label: chapterName(meta) }],
          onBack,
        }),
        h(ChapterHeader, { meta, chapter: detail }),
        !known && error ? h(ErrorBox, { message: error, onRetry }) : null,
        !known && !error ? h(Spinner, { label: loading ? t('loadingChapter') : t('noChapter') }) : null,
        !known && !error && loading ? h('div', { className: 'tbp-grid' }, [0, 1, 2].map((index) => h('div', { key: 'sk' + index, className: 'tbp-skel-card' },
          h('div', { className: 'tbp-skel', style: { width: '38%' } }),
          h('div', { className: 'tbp-skel', style: { width: '88%' } }),
          h('div', { className: 'tbp-skel', style: { width: '62%' } })))) : null,
        known ? h('div', { className: 'tbp-section-head' },
          h('h3', { className: 'tbp-h3' }, t('sections')),
          h('span', { className: 'tbp-stats' }, countLabel(sections.length, 'sections') + ' · ' + countLabel(sections.reduce((sum, section) => sum + sectionPointCount(section), 0), 'points'))) : null,
        known ? (sections.length
          ? h('div', { className: 'tbp-grid' }, sections.map((section, index) => h(SectionCard, {
            key: asText(section && section.id) || ('sec' + index),
            section,
            onOpen: () => { if (onOpenSection) onOpenSection(chapterId, asText(section && section.id)) },
          })))
          : h('div', { className: 'tbp-card' }, h('div', { className: 'tbp-empty-inline' }, t('noChapter')))) : null,
        h('div', { className: 'tbp-pager' },
          h('button', { type: 'button', className: 'tbp-btn tbp-pager-btn', onClick: onBack || undefined }, '← ' + t('back'))))
    }

    /* ───────────────────────── 知识点卡片 ───────────────────────── */
    function PointCard(props) {
      const point = (props && props.point) || {}
      const onOpen = props && typeof props.onOpen === 'function' ? props.onOpen : null
      const requires = asList(point.prerequisites)
      const shown = requires.slice(0, 3)
      return h('button', {
        type: 'button',
        className: 'tbp-card tbp-card-hover tbp-click tbp-chapter-card',
        onClick: onOpen || undefined,
        'aria-label': ((point.important === true ? t('important') + ' ' : '') + asText(point.id) + ' ' + asText(point.title)).trim() || t('point'),
      },
        h('div', { className: 'tbp-chapter-top' },
          h('span', { className: 'tbp-num' }, asText(point.id) || '·'),
          h('div', { className: 'tbp-chapter-main' },
            h('div', { className: 'tbp-chapter-title' },
              h(StarBadge, { on: point.important === true }),
              asText(point.title) || t('point')),
            asText(point.solves) ? h('p', { className: 'tbp-p tbp-solves-line' },
              h('span', { className: 'tbp-solves-tag' }, t('bornFor')),
              asText(point.solves)) : null)),
        shown.length ? h('div', { className: 'tbp-chipline' },
          h('span', { className: 'tbp-chipline-label' }, t('prerequisites')),
          shown.map((text, index) => h(Chip, { key: 'pr' + index, tone: 'muted' }, text)),
          requires.length > shown.length ? h(Chip, { key: 'pm', tone: 'muted' }, '+' + (requires.length - shown.length)) : null) : null,
        h('div', { className: 'tbp-card-foot' },
          h('span', null, asText(point.formula) ? t('formula') : ''),
          h('span', { className: 'tbp-arrow', 'aria-hidden': true }, '→')))
    }

    /* ───────────────────────── 节视图（知识点卡列表） ───────────────────────── */
    function SectionView(props) {
      const chapter = (props && props.chapter) || {}
      const book = (props && props.book) || {}
      const sectionId = asText(props && props.sectionId)
      const sections = Array.isArray(chapter.sections) ? chapter.sections : []
      const section = sections.filter((item) => item && asText(item.id) === sectionId)[0] || {}
      const points = Array.isArray(section.points) ? section.points.filter(Boolean) : []
      const requires = asList(section.requires)
      const remaining = asText(section.remaining)
      const examples = asExamples(section.examples)
      const onBack = props && typeof props.onBack === 'function' ? props.onBack : null
      const onOpenPoint = props && typeof props.onOpenPoint === 'function' ? props.onOpenPoint : null
      return h('div', { className: 'tbp-view tbp-in' },
        h(Breadcrumb, {
          items: [
            { label: asText(book.title) || asText(chapter.title) || t('book'), onClick: onBack },
            { label: (asText(section.id) ? asText(section.id) + ' ' : '') + (asText(section.title) || t('section')) },
          ],
          onBack,
        }),
        h('section', { className: 'tbp-card' },
          h('div', { className: 'tbp-overview-top' },
            h('span', { className: 'tbp-num' }, asText(section.id) || '·'),
            h('div', { className: 'tbp-overview-main' },
              h('p', { className: 'tbp-eyebrow' }, t('section')),
              h('h2', { className: 'tbp-h2' }, asText(section.title) || t('section')),
              asText(section.subProblem) ? h('p', { className: 'tbp-p' }, asText(section.subProblem)) : null)),
          requires.length ? h('div', { className: 'tbp-chipline', style: { marginTop: 10 } },
            h('span', { className: 'tbp-chipline-label' }, t('requires')),
            requires.map((text, index) => h(Chip, { key: 'svr' + index, tone: 'muted' }, text))) : null,
          remaining ? h('div', { className: 'tbp-block tbp-block-gap', style: { marginTop: 10 } },
            h('div', { className: 'tbp-block-label' }, t('limitation')),
            h('p', { className: 'tbp-block-text' }, remaining)) : null),
        h(AnalogyBox, { text: asText(section.analogy) }),
        h(SectionSummary, {
          section,
          onOpenPoint: onOpenPoint ? (pointId) => onOpenPoint(asText(section.id), pointId) : null,
        }),
        examples.length ? h('section', { className: 'tbp-card' },
          h('p', { className: 'tbp-eyebrow' }, t('sectionExamples') + '（' + examples.length + ' ' + t('exampleUnit') + '）'),
          h(ExampleList, { examples })) : null,
        h('div', { className: 'tbp-section-head' },
          h('h3', { className: 'tbp-h3' }, t('point')),
          h('span', { className: 'tbp-stats' }, countLabel(points.length, 'points'))),
        points.length
          ? h('div', { className: 'tbp-grid' }, points.map((point, index) => h(PointCard, {
            key: asText(point && point.id) || ('pt' + index),
            point,
            onOpen: () => { if (onOpenPoint) onOpenPoint(asText(section.id), asText(point && point.id)) },
          })))
          : h('div', { className: 'tbp-card' }, h('div', { className: 'tbp-empty-inline' }, t('noPoints'))),
        h('div', { className: 'tbp-pager' },
          h('button', { type: 'button', className: 'tbp-btn tbp-pager-btn', onClick: onBack || undefined }, '← ' + t('back'))))
    }

    /* ───────────────────────── v2 板块：生活类比 / 知识点汇总 / 典型例题 ───────────────────────── */
    function StarBadge(props) {
      const item = props || {}
      if (item.on !== true) return null
      return h('span', { className: cs('tbp-starwrap', item.className), title: t('important') },
        h('span', { className: 'tbp-star', 'aria-hidden': true }, '★'),
        item.label === false ? null : h('span', { className: 'tbp-star-label' }, t('important')))
    }

    function KeyPointsBlock(props) {
      const items = asList(props && props.items)
      if (!items.length) return null
      return h('div', { className: 'tbp-block' },
        h('div', { className: 'tbp-block-label' }, t('keyPoints')),
        h('ol', { className: 'tbp-keypoints' }, items.map((text, index) => h('li', { key: 'kp' + index }, text))))
    }

    /** 可选详情节：无内容时返回 null，避免旧数据渲染空板块。 */
    function detailNode(label, text, tone) {
      const value = asText(text)
      if (!value) return null
      return h(DetailBlock, { label: label, text: value, tone: tone })
    }

    function AnalogyBox(props) {
      const text = asText(props && props.text)
      if (!text) return null
      return h('div', { className: 'tbp-analogy' },
        h('div', { className: 'tbp-analogy-label' }, t('analogy')),
        h('p', { className: 'tbp-block-text' }, text))
    }

    /* ───────────────────────── v1.3：定理卡片 / 多公式拆行 ───────────────────────── */

    /** 把公式串按中文分号 / 换行拆成多条（忽略空条与仅分号的碎片）。 */
    function splitFormula(text) {
      const raw = asText(text)
      if (!raw) return []
      return raw
        .split(/[；;\n]+/)
        .map((part) => part.trim().replace(/[，,、]+$/, '').trim())
        .filter((part) => part.length > 0)
    }

    function mirrorList(value) {
      if (Array.isArray(value)) return value.map((item) => asText(item)).filter((item) => item.length > 0)
      const single = asText(value)
      return single ? [single] : []
    }

    /** math.theorems → 结构化定理卡片 */
    function TheoremList(props) {
      const theorems = Array.isArray(props && props.theorems) ? props.theorems.filter(Boolean) : []
      if (!theorems.length) return null
      return h('div', { className: 'tbp-math' }, theorems.map((thm, index) => {
        const name = asText(thm.name)
        const statement = asText(thm.statement)
        const conditions = mirrorList(thm.conditions)
        const symbols = Array.isArray(thm.symbols) ? thm.symbols.filter(Boolean) : []
        return h('div', { className: 'tbp-theorem', key: asText(thm.id) || ('thm' + index) },
          h('div', { className: 'tbp-theorem-head' },
            h('span', { className: 'tbp-theorem-no' }, t('theorem') + ' ' + (index + 1)),
            name ? h('span', { className: 'tbp-theorem-name' }, name) : null),
          statement ? h('p', { className: 'tbp-theorem-statement' }, statement) : null,
          conditions.length ? h('div', { className: 'tbp-condline' },
            h('span', { className: 'tbp-condline-label' }, t('conditions')),
            conditions.map((text, ci) => h(Chip, { key: 'cond' + ci, tone: 'warn' }, text))) : null,
          symbols.length ? h('div', { className: 'tbp-digest-sec' },
            h('div', { className: 'tbp-digest-label' }, t('symbols')),
            h('dl', { className: 'tbp-symtable' },
              symbols.map((sym, si) => [
                h('dt', { key: 'symd' + si }, asText(sym && sym.sym) || '·'),
                h('dd', { key: 'syme' + si }, asText(sym && sym.meaning) || ''),
              ]))) : null)
      }))
    }

    /** 「公式 / 定理」板块：结构化定理 > 图片 > 文本公式（拆行） */
    function FormulaBlock(props) {
      const point = (props && props.point) || {}
      const math = point.math && typeof point.math === 'object' ? point.math : null
      const theorems = math && Array.isArray(math.theorems) ? math.theorems.filter(Boolean) : []
      const image = math && math.image && typeof math.image === 'object' ? math.image : null
      const dataUrl = asText(image && image.dataUrl)
      const formulas = splitFormula(point.formula)
      if (!theorems.length && !dataUrl && !formulas.length) return null
      return h('div', { className: 'tbp-block' },
        h('div', { className: 'tbp-block-label' }, t('formula')),
        theorems.length ? h(TheoremList, { theorems }) : null,
        dataUrl
          ? h('div', null,
            h('img', {
              className: 'tbp-formula-img', src: dataUrl,
              alt: asText(image && image.alt) || t('formulaImage'), loading: 'lazy',
            }),
            asText(image && image.caption) ? h('p', { className: 'tbp-formula-cap' }, asText(image.caption)) : null)
          : null,
        (!theorems.length && formulas.length)
          ? h('div', { className: 'tbp-math' }, formulas.map((text, index) => h('p', { key: 'fml' + index, className: 'tbp-formula-card' }, text)))
          : null,
        (theorems.length && formulas.length)
          ? h('div', { className: 'tbp-math' }, formulas.map((text, index) => h('p', { key: 'fmlx' + index, className: 'tbp-formula-card' }, text)))
          : null)
    }

    /** 「定理推导过程」折叠区：derivationSteps > derivation 文本，默认收起 */
    function CollapsibleDerivation(props) {
      const point = (props && props.point) || {}
      const math = point.math && typeof point.math === 'object' ? point.math : null
      const steps = math && Array.isArray(math.derivationSteps) ? math.derivationSteps.filter(Boolean) : []
      const fallback = asText(point.derivation)
      const [open, setOpen] = useState(false)
      if (!steps.length && !fallback) return null
      const count = steps.length ? steps.length : 1
      /* 每步三行结构：① 一句「要做什么」② 纯算式链（可多行，等宽居中）③ 可选补充说明 */
      const renderStep = function (step, index) {
        const line = asText(step.line)
        const detail = asText(step.detail)
        const why = asText(step.why)
        return h('li', { className: cs('tbp-step', line && 'tbp-step-calc'), key: 'dst' + index },
          h('span', { className: 'tbp-step-no', 'aria-hidden': true }, String(index + 1)),
          h('div', { className: 'tbp-step-body' },
            asText(step.step) ? h('div', { className: 'tbp-step-title' }, asText(step.step)) : null,
            line ? h('pre', { className: 'tbp-step-line' }, line) : null,
            detail ? h('p', { className: 'tbp-step-detail' }, detail) : null,
            why ? h('p', { className: 'tbp-step-why' }, why) : null))
      }
      return h('section', { className: 'tbp-card tbp-derivation' },
        h('div', { className: 'tbp-section-head', style: { marginTop: 0 } },
          h('div', { className: 'tbp-block-label', style: { marginBottom: 0 } },
            t('derivationSteps') + '（' + count + ' ' + t('stepUnit') + '）'),
          h('button', {
            type: 'button', className: 'tbp-btn', 'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
          }, open ? t('collapse') : t('expand'))),
        open
          ? (steps.length
            ? h('ol', { className: 'tbp-steps' }, steps.map(renderStep))
            : h('p', { className: 'tbp-block-text' }, fallback))
          : null)
    }

    /** deepread 风格小节 digest；无 digest 时返回 null 由调用方回退 summary */
    function DigestBlock(props) {
      const item = props || {}
      const digest = item.digest && typeof item.digest === 'object' ? item.digest : null
      if (!digest) return null
      const oneLine = asText(digest.oneLine)
      const corePoints = mirrorList(digest.corePoints)
      const chain = mirrorList(digest.argumentChain)
      const map = Array.isArray(digest.pointMap) ? digest.pointMap.filter(Boolean) : []
      const takeaways = mirrorList(digest.takeaways)
      const pitfalls = mirrorList(digest.pitfalls)
      const connections = digest.connections && typeof digest.connections === 'object' ? digest.connections : null
      const before = asText(connections && connections.before)
      const after = asText(connections && connections.after)
      const currentId = asText(item.currentPointId)
      const onOpenPoint = typeof item.onOpenPoint === 'function' ? item.onOpenPoint : null
      const listBlock = function (label, list, cls) {
        if (!list.length) return null
        return h('div', { className: 'tbp-digest-sec' },
          h('div', { className: 'tbp-digest-label' }, label),
          h('ul', { className: cls || 'tbp-digest-list' }, list.map((text, index) => h('li', { key: label + index }, text))))
      }
      return h('div', { className: 'tbp-digest' },
        oneLine ? h('p', { className: 'tbp-digest-one' }, oneLine) : null,
        listBlock(t('digestCore'), corePoints),
        chain.length ? h('div', { className: 'tbp-digest-sec' },
          h('div', { className: 'tbp-digest-label' }, t('digestChain')),
          h('ol', { className: 'tbp-digest-chain' }, chain.map((text, index) => h('li', { key: 'ac' + index }, text)))) : null,
        map.length ? h('div', { className: 'tbp-digest-sec' },
          h('div', { className: 'tbp-digest-label' }, t('digestMap')),
          h('div', { className: 'tbp-dmap' }, map.map((row, index) => {
            const rowId = asText(row.id)
            const isCurrent = !!currentId && rowId === currentId
            const clickable = !!onOpenPoint && !isCurrent
            const rowProps = {
              key: rowId || ('dm' + index),
              className: cs('tbp-dmap-row', isCurrent && 'tbp-dmap-row-cur'),
              'aria-current': isCurrent ? 'true' : undefined,
            }
            if (clickable) { rowProps.type = 'button'; rowProps.onClick = () => onOpenPoint(rowId) }
            return h(clickable ? 'button' : 'div', rowProps,
              h('span', { className: 'tbp-dmap-id' }, rowId || '·'),
              h('div', { className: 'tbp-dmap-main' },
                h('span', { className: 'tbp-dmap-title' },
                  h(StarBadge, { on: row.important === true, label: false }),
                  asText(row.title) || t('point')),
                asText(row.role) ? h('span', { className: 'tbp-dmap-role' }, asText(row.role)) : null,
                asText(row.keyIdea) ? h('span', { className: 'tbp-dmap-key' }, asText(row.keyIdea)) : null))
          }))) : null,
        listBlock(t('digestTakeaways'), takeaways),
        listBlock(t('digestPitfalls'), pitfalls),
        (before || after) ? h('div', { className: 'tbp-digest-sec' },
          h('div', { className: 'tbp-digest-label' }, t('digestConnections')),
          h('div', { className: 'tbp-connect' },
            before ? h('div', { className: 'tbp-connect-row' },
              h('span', { className: 'tbp-connect-tag' }, t('digestBefore')),
              h('span', null, before)) : null,
            after ? h('div', { className: 'tbp-connect-row' },
              h('span', { className: 'tbp-connect-tag' }, t('digestAfter')),
              h('span', null, after)) : null)) : null)
    }

    function SectionSummary(props) {
      const item = props || {}
      const section = item.section && typeof item.section === 'object' ? item.section : {}
      const summary = asText(section.summary)
      const points = Array.isArray(section.points) ? section.points.filter(Boolean) : []
      if (!summary && !points.length) return null
      const currentId = asText(item.currentPointId)
      const onOpenPoint = typeof item.onOpenPoint === 'function' ? item.onOpenPoint : null
      const rows = points.map((point, index) => {
        const pointId = asText(point.id)
        const isCurrent = !!currentId && pointId === currentId
        const clickable = !!onOpenPoint && !isCurrent
        const rowProps = {
          key: pointId || ('sp' + index),
          className: cs('tbp-pointitem', isCurrent && 'tbp-pointitem-cur'),
          'aria-current': isCurrent ? 'true' : undefined,
        }
        if (clickable) {
          rowProps.type = 'button'
          rowProps.onClick = () => onOpenPoint(pointId)
        }
        return h(clickable ? 'button' : 'div', rowProps,
          h('span', { className: 'tbp-pointitem-id' }, pointId || '·'),
          h('span', { className: 'tbp-pointitem-main' },
            h('span', { className: 'tbp-pointitem-title' },
              h(StarBadge, { on: point.important === true, label: false }),
              asText(point.title) || t('point')),
            asText(point.solves) ? h('span', { className: 'tbp-pointitem-sub' }, asText(point.solves)) : null))
      })
      return h('section', { className: 'tbp-card' },
        h('p', { className: 'tbp-eyebrow' }, t('summary')),
        h(DigestBlock, {
          digest: section.digest,
          currentPointId: currentId,
          onOpenPoint: onOpenPoint,
        }),
        summary && !section.digest ? h('p', { className: 'tbp-summary-text' }, summary) : null,
        rows.length ? h('div', { className: 'tbp-pointlist' }, rows) : null)
    }

    function ExampleItem(props) {
      const item = props || {}
      const example = item.example || {}
      const index = Number(item.index)
      const [open, setOpen] = useState(!!item.defaultOpen)
      const question = asText(example.question)
      const answer = asText(example.answer)
      const note = asText(example.note)
      const type = asText(example.type)
      const source = asText(example.source)
      return h('div', { className: 'tbp-example' },
        h('div', { className: 'tbp-example-head' },
          h('span', { className: 'tbp-example-no' }, '#' + ((Number.isFinite(index) ? index : 0) + 1)),
          type ? h(Chip, { tone: toneForType(type) }, type) : null,
          source ? h(Chip, { tone: 'muted' }, source) : null),
        h('p', { className: 'tbp-example-q' }, question || '—'),
        answer ? h('div', { className: 'tbp-example-actions' },
          h('button', {
            type: 'button', className: 'tbp-btn', 'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
          }, open ? t('hideAnswer') : t('showAnswer'))) : null,
        open && answer ? h('div', { className: 'tbp-example-answer' },
          h('div', { className: 'tbp-example-a-label' }, t('answer')),
          h('p', { className: 'tbp-example-a-text' }, answer)) : null,
        open && note ? h('p', { className: 'tbp-example-note' }, t('note') + '：' + note) : null)
    }

    function ExampleList(props) {
      const list = asExamples(props && props.examples)
      if (!list.length) return null
      return h('div', { className: 'tbp-examples' }, list.map((example, index) => h(ExampleItem, {
        key: asText(example.id) || ('ex' + index),
        example,
        index,
      })))
    }

    function CollapsibleExamples(props) {
      const list = asExamples(props && props.examples)
      const [open, setOpen] = useState(false)
      if (!list.length) return null
      return h('section', { className: 'tbp-card' },
        h('div', { className: 'tbp-section-head', style: { marginTop: 0 } },
          h('div', { className: 'tbp-block-label', style: { marginBottom: 0 } }, t('sectionExamples') + '（' + list.length + ' ' + t('exampleUnit') + '）'),
          h('button', {
            type: 'button', className: 'tbp-btn', 'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
          }, open ? t('collapse') : t('expand'))),
        open ? h(ExampleList, { examples: list }) : null)
    }

    /* ───────────────────────── 详情通用分区（PointDetail 复用） ───────────────────────── */
    function DetailBlock(props) {
      const item = props || {}
      const tone = asText(item.tone)
      const text = asText(item.text)
      return h('div', { className: cs('tbp-block', tone ? 'tbp-block-' + tone : null, item.span ? 'tbp-spanfull' : null) },
        item.label ? h('div', { className: 'tbp-block-label' }, asText(item.label)) : null,
        text ? h('p', { className: 'tbp-block-text' }, text) : null,
        item.children || null)
    }/* ───────────────────────── 知识点详情（solves 高亮 + 含义/公式/应用/例题/前置/遗留/下一环 + Esc） ───────────────────────── */
    function PointDetail(props) {
      const item = props || {}
      const point = item.point && typeof item.point === 'object' ? item.point : {}
      const section = item.section && typeof item.section === 'object' ? item.section : {}
      const chapter = item.chapter && typeof item.chapter === 'object' ? item.chapter : {}
      const onBack = typeof item.onBack === 'function' ? item.onBack : null
      const escRef = useRef(onBack)
      escRef.current = onBack
      useEffect(function () {
        if (typeof document === 'undefined' || !document.addEventListener) return undefined
        function onKey(event) {
          if (!event || (event.key !== 'Escape' && event.key !== 'Esc')) return
          const back = escRef.current
          if (typeof back !== 'function') return
          if (typeof event.preventDefault === 'function') event.preventDefault()
          back()
        }
        document.addEventListener('keydown', onKey)
        return function () { document.removeEventListener('keydown', onKey) }
      }, [])
      const requires = asList(point.prerequisites)
      const formula = asText(point.formula)
      const limitation = asText(point.limitation)
      const nextLink = asText(point.next)
      const sectionExamples = asExamples(section.examples)
      const onOpenPoint = typeof item.onOpenPoint === 'function' ? item.onOpenPoint : null
      const example = point.example && typeof point.example === 'object' ? point.example : {}
      const question = asText(example.question)
      const answer = asText(example.answer)
      const sectionLabel = (asText(section.id) ? asText(section.id) + ' ' : '') + (asText(section.title) || t('section'))
      const crumbs = [
        { label: asText(chapter.title) || chapterName(chapter) || t('chapter'), onClick: onBack },
        { label: sectionLabel, onClick: onBack },
      ]
      const navButton = function (label, enabled, onClick) {
        return h('button', {
          type: 'button', className: 'tbp-btn tbp-pager-btn',
          disabled: !enabled, onClick: enabled && typeof onClick === 'function' ? onClick : undefined,
        }, label)
      }
      return h('div', { className: 'tbp-view tbp-detail tbp-in' },
        h(Breadcrumb, { items: crumbs, onBack }),
        h('div', { className: 'tbp-detail-head' },
          h('span', { className: 'tbp-num' }, asText(point.id) || '·'),
          h('div', { className: 'tbp-detail-headmain' },
            h('div', { className: 'tbp-title-row' },
              h('h1', { className: 'tbp-detail-title' }, asText(point.title) || t('point')),
              h(StarBadge, { on: point.important === true })),
            h('div', { className: 'tbp-detail-sub' }, sectionLabel))),
        h('div', { className: 'tbp-hl' },
          h('div', { className: 'tbp-hl-label' }, t('itSolves')),
          h('p', { className: 'tbp-hl-text' }, asText(point.solves) || '—')),
        h('div', { className: 'tbp-detail-blocks' },
          h(DetailBlock, { label: t('meaning'), text: asText(point.meaning) || '—' }),
          detailNode(t('detail'), point.detail),
          h(KeyPointsBlock, { items: point.keyPoints }),
          h(AnalogyBox, { text: asText(point.analogy) }),
          formula ? h(FormulaBlock, { point }) : null,
          h(CollapsibleDerivation, { point }),
          h(DetailBlock, { label: t('application'), text: asText(point.application) || '—' }),
          detailNode(t('mistakes'), point.mistakes, 'gap'),
          detailNode(t('examTips'), point.examTips, 'gain'),
          question || answer ? h(DetailBlock, { label: t('example'), children: h('div', null,
            question ? h('p', { className: 'tbp-example-q' }, question) : null,
            answer ? h('div', { className: 'tbp-example-a' }, h('div', { className: 'tbp-a-label' }, t('answer')), answer) : null) }) : null,
          h(CollapsibleExamples, { examples: sectionExamples }),
          h(SectionSummary, {
            section,
            currentPointId: asText(point.id),
            onOpenPoint: onOpenPoint ? (pointId) => onOpenPoint(pointId) : null,
          }),
          requires.length ? h('div', { className: 'tbp-chipline' },
            h('span', { className: 'tbp-chipline-label' }, t('prerequisites')),
            requires.map((text, index) => h(Chip, { key: 'pd' + index, tone: 'muted' }, text))) : null,
          limitation ? h(DetailBlock, { tone: 'gap', label: t('limitation'), text: limitation }) : null,
          nextLink ? h(DetailBlock, { tone: 'next', label: t('nextLink'), text: nextLink }) : null),
        h('div', { className: 'tbp-pager' },
          navButton('← ' + t('prev'), item.hasPrev, item.onPrev),
          h('div', { className: 'tbp-pager-hint' }, t('escHint')),
          navButton(t('next') + ' →', item.hasNext, item.onNext)))
    }

    /* ───────────────────────── 侧边栏图标（16-20px inline SVG，currentColor + brand） ───────────────────────── */
    function SidebarIcon(props) {
      const item = props || {}
      const raw = Number(item.size)
      const size = Number.isFinite(raw) && raw >= 16 ? Math.min(raw, 20) : 18
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, className: 'tbp-icon',
        style: { color: 'var(--dsw-alias-brand-primary)', opacity: item.active ? 1 : 0.82 },
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        focusable: 'false', 'aria-hidden': true,
      },
        h('path', { d: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 1 4 16V5.5Z' }),
        h('path', { d: 'M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 16V5.5Z' }),
        h('path', { d: 'M12 6v13' }),
        h('path', { d: 'M6.6 8.2h2.2M6.6 11h2.2M15.2 8.2h2.2M15.2 11h2.2' }))
    }

    /* ───────────────────────── 导出（纯前端：自包含 HTML / Word / PDF，无 Host 改动） ───────────────────────── */
    const EXPORT_CSS = `
:root{color-scheme:light dark}
.txp-body{margin:0;padding:0;background:#f5f6f8;color:#1e2530;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.8;-webkit-text-size-adjust:100%}
.txp-main{max-width:900px;margin:0 auto;padding:24px 18px 60px;box-sizing:border-box}
.txp-h1{margin:0 0 4px;font-size:24px;line-height:1.35}
.txp-sub{margin:0 0 10px;font-size:14px;color:#5a6675}
.txp-meta{margin:0 0 18px;font-size:12px;color:#7a8494}
.txp-card{background:#fff;border:1px solid #dfe3ea;border-radius:14px;padding:16px 18px;margin:0 0 14px;box-sizing:border-box}
.txp-eyebrow{margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#7a8494;text-transform:uppercase}
.txp-label{font-size:11px;font-weight:700;letter-spacing:.06em;color:#7a8494;margin:0 0 4px}
.txp-p{margin:0;font-size:14px;color:#39424f;white-space:pre-wrap;word-break:break-word}
.txp-h2{margin:0;font-size:19px;line-height:1.4}
.txp-h3{margin:0 0 6px;font-size:16px;line-height:1.45}
.txp-h4{margin:0 0 6px;font-size:15px;line-height:1.45}
.txp-block{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:#f7f8fa;border:1px solid #e4e8ee;box-sizing:border-box}
.txp-block-brand{border-left:3px solid #3b6ef0;background:#f2f6ff}
.txp-block-warn{border-left:3px solid #b96a12;background:#fdf6ec}
.txp-block-ok{border-left:3px solid #1f8a4c;background:#f0f9f3}
.txp-chip{display:inline-block;margin:0 6px 6px 0;padding:1px 9px;border-radius:999px;border:1px solid #dfe3ea;background:#f5f6f8;color:#5a6675;font-size:12px;white-space:normal;word-break:break-word}
.txp-chain{display:flex;flex-direction:column;gap:8px;margin:6px 0 0}
.txp-chain-node{padding:10px 12px;border:1px solid #e4e8ee;border-radius:10px;background:#fbfbfc}
.txp-toc{padding-left:20px;margin:8px 0 0;font-size:13px;line-height:1.9}
.txp-toc a{color:#3559b8;text-decoration:none}
.txp-section{margin:26px 0 10px;padding:6px 0;border-bottom:2px solid #e4e8ee;scroll-margin-top:12px}
.txp-example{border:1px solid #e4e8ee;border-radius:10px;padding:12px 14px;margin:0 0 10px;background:#fbfbfc;box-sizing:border-box}
.txp-example-head{margin:0 0 6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.txp-example-no{font-weight:700;color:#3559b8;font-size:13px}
.txp-q{margin:0;font-size:14px;color:#29313d;white-space:pre-wrap;word-break:break-word}
.txp-answer{margin:8px 0 0;padding:10px 12px;border-radius:8px;border:1px solid #cfe6d7;background:#f2faf4}
.txp-answer p{margin:0;font-size:13.5px;color:#39424f;white-space:pre-wrap;word-break:break-word}
.txp-note{margin:8px 0 0;font-size:12.5px;color:#b96a12;white-space:pre-wrap;word-break:break-word}
.txp-btn{display:inline-block;margin:8px 0 0;padding:5px 12px;border-radius:8px;border:1px solid #c5cfdd;background:#eef2f8;color:#29313d;font-size:13px;cursor:pointer;font-family:inherit}
.txp-point{margin:0 0 12px;padding:12px 14px;border:1px solid #e4e8ee;border-radius:10px;background:#fff;box-sizing:border-box}
.txp-starline{display:inline-block;margin:0 0 4px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:700;color:#b96a12;border:1px solid #e8cfa8;background:#fdf6ec}
.txp-kp{margin:6px 0 0;padding-left:22px;font-size:13.5px;color:#39424f;line-height:1.75}
.txp-kp li{margin:0 0 2px;white-space:pre-wrap;word-break:break-word}
.txp-footer{margin-top:28px;font-size:11px;color:#8a93a2;text-align:center}
@media (max-width:640px){.txp-main{padding:16px 12px 48px}.txp-h1{font-size:20px}.txp-card{padding:13px 12px}.txp-body{font-size:14.5px}}
@media (prefers-color-scheme:dark){
.txp-body{background:#14181f;color:#e6ebf3}
.txp-card,.txp-point{background:#1b212b;border-color:#2b3442}
.txp-sub,.txp-p,.txp-q,.txp-answer p,.txp-list{color:#c6cfdc}
.txp-meta,.txp-eyebrow,.txp-label{color:#8d99ab}
.txp-block{background:#1f2733;border-color:#2b3442}
.txp-block-brand{background:#1b2740;border-left-color:#6b93f5}
.txp-block-warn{background:#33261a;border-left-color:#d79a4b}
.txp-block-ok{background:#16291e;border-left-color:#4cb87a}
.txp-chip{background:#232c39;border-color:#334052;color:#b8c3d3}
.txp-chain-node,.txp-example{background:#1e2631;border-color:#2b3442}
.txp-answer{background:#16291e;border-color:#2b4a37}
.txp-btn{background:#232c39;border-color:#3a4757;color:#dde4ee}
.txp-toc a{color:#8fb0f7}
.txp-note{color:#d79a4b}
}
@media print{.txp-body{background:#fff;color:#111}.txp-card,.txp-point,.txp-example,.txp-block{break-inside:avoid}.txp-answer{display:block !important}.txp-btn{display:none}.txp-footer{display:none}}
`


    function exportChips(list) {
      return (Array.isArray(list) ? list : []).map((text) => '<span class="txp-chip">' + escapeHtml(text) + '</span>').join('')
    }

    function exportBlock(label, text, tone) {
      const content = asText(text)
      if (!content) return ''
      return '<div class="txp-block' + (tone ? ' txp-block-' + tone : '') + '"><div class="txp-label">' + escapeHtml(label) + '</div><p class="txp-p">' + escapeHtml(content) + '</p></div>'
    }

    function exportRequires(label, list) {
      const chips = exportChips(list)
      if (!chips) return ''
      return '<div class="txp-label">' + escapeHtml(label) + '</div><div>' + chips + '</div>'
    }

    function exportKeyPoints(list) {
      const items = asList(list)
      if (!items.length) return ''
      return '<div class="txp-block"><div class="txp-label">' + escapeHtml(t('keyPoints')) + '</div><ol class="txp-kp">' +
        items.map((text) => '<li>' + escapeHtml(text) + '</li>').join('') + '</ol></div>'
    }

    function exportAnswerBlock(answer, note) {
      const text = asText(answer)
      if (!text) return ''
      return '<div class="txp-answer"><div class="txp-label">' + escapeHtml(t('answer')) + '</div><p>' + escapeHtml(text) + '</p></div>' +
        (asText(note) ? '<p class="txp-note">' + escapeHtml(t('note') + '：' + note) + '</p>' : '')
    }

    function exportExamples(list) {
      const examples = asExamples(list)
      if (!examples.length) return ''
      const head = '<div class="txp-label">' + escapeHtml(t('sectionExamples') + '（' + examples.length + ' ' + t('exampleUnit') + '）') + '</div>'
      const body = examples.map((example, index) => {
        const id = 'txp-ex-' + index + '-' + Math.random().toString(36).slice(2, 8)
        const question = asText(example.question)
        const answer = asText(example.answer)
        const note = asText(example.note)
        const type = asText(example.type)
        const source = asText(example.source)
        const chips = (type ? '<span class="txp-chip">' + escapeHtml(type) + '</span>' : '') +
          (source ? '<span class="txp-chip">' + escapeHtml(source) + '</span>' : '')
        const answerNode = exportAnswerBlock(answer, note)
        return '<div class="txp-example"><div class="txp-example-head"><span class="txp-example-no">#' + (index + 1) + '</span>' + chips + '</div>' +
          '<p class="txp-q">' + escapeHtml(question) + '</p>' + answerNode + '</div>'
      }).join('')
      return head + body
    }

    /* ── v1.3：导出静态版（Word / 打印）的定理卡片与推导步骤 ── */
    function exportFormulaBlock(item) {
      const math = item.math && typeof item.math === 'object' ? item.math : null
      const theorems = math && Array.isArray(math.theorems) ? math.theorems.filter(Boolean) : []
      const image = math && math.image && typeof math.image === 'object' ? math.image : null
      const dataUrl = asText(image && image.dataUrl)
      const formulas = splitFormula(item.formula)
      if (!theorems.length && !dataUrl && !formulas.length) return ''
      const out = ['<div class="txp-label">' + escapeHtml(t('formula')) + '</div>']
      if (theorems.length) {
        out.push('<div class="txp-math">')
        theorems.forEach((thm, index) => {
          const name = asText(thm.name)
          const statement = asText(thm.statement)
          const conditions = mirrorList(thm.conditions)
          const symbols = Array.isArray(thm.symbols) ? thm.symbols.filter(Boolean) : []
          out.push('<div class="txp-theorem">')
          out.push('<div class="txp-theorem-head"><span class="txp-theorem-no">' + escapeHtml(t('theorem') + ' ' + (index + 1)) + '</span>' +
            (name ? '<span class="txp-theorem-name">' + escapeHtml(name) + '</span>' : '') + '</div>')
          if (statement) out.push('<p class="txp-theorem-statement">' + escapeHtml(statement) + '</p>')
          if (conditions.length) out.push('<div class="txp-conds"><strong>' + escapeHtml(t('conditions')) + '</strong>' +
            conditions.map((text) => '<span class="txp-chip">' + escapeHtml(text) + '</span>').join('') + '</div>')
          if (symbols.length) out.push('<div class="txp-syms"><strong>' + escapeHtml(t('symbols')) + '</strong>' +
            symbols.map((sym) => '<div><code>' + escapeHtml(asText(sym.sym)) + '</code> — ' + escapeHtml(asText(sym.meaning)) + '</div>').join('') + '</div>')
          out.push('</div>')
        })
        out.push('</div>')
      }
      if (dataUrl) {
        out.push('<img class="txp-formula-img" src="' + escapeHtml(dataUrl) + '" alt="' + escapeHtml(asText(image.alt) || t('formulaImage')) + '">')
        if (asText(image.caption)) out.push('<p class="txp-formula-cap">' + escapeHtml(image.caption) + '</p>')
      }
      formulas.forEach((text) => {
        out.push('<p class="txp-formula-card">' + escapeHtml(text) + '</p>')
      })
      return out.join('')
    }

    function exportDerivationBlock(item) {
      const math = item.math && typeof item.math === 'object' ? item.math : null
      const steps = math && Array.isArray(math.derivationSteps) ? math.derivationSteps.filter(Boolean) : []
      const fallback = asText(item.derivation)
      if (!steps.length && !fallback) return ''
      const out = ['<div class="txp-label">' + escapeHtml(t('derivationSteps')) + '</div>', '<ol class="txp-steps">']
      if (steps.length) {
        steps.forEach((step) => {
          const line = asText(step.line)
          const why = asText(step.why)
          out.push('<li><strong>' + escapeHtml(asText(step.step)) + '</strong>' +
            (line ? '<pre class="txp-step-line">' + escapeHtml(line) + '</pre>' : '') +
            (asText(step.detail) ? '<p class="txp-step-detail">' + escapeHtml(step.detail) + '</p>' : '') +
            (why ? '<p class="txp-step-why">' + escapeHtml(why) + '</p>' : '') + '</li>')
        })
      } else {
        out.push('<li><p class="txp-step-detail">' + escapeHtml(fallback) + '</p></li>')
      }
      out.push('</ol>')
      return out.join('')
    }

    /** v1.3：导出静态版的 digest 分节（deepread 风格） */
    function exportDigestBlock(section) {
      const digest = section && section.digest && typeof section.digest === 'object' ? section.digest : null
      if (!digest) return ''
      const out = ['<div class="txp-digest">']
      const oneLine = asText(digest.oneLine)
      if (oneLine) out.push('<p class="txp-digest-one">' + escapeHtml(oneLine) + '</p>')
      const list = function (label, items, ordered) {
        const arr = mirrorList(items)
        if (!arr.length) return ''
        return '<div class="txp-digest-sec"><div class="txp-label">' + escapeHtml(label) + '</div>' +
          (ordered ? '<ol>' : '<ul>') + arr.map((text) => '<li>' + escapeHtml(text) + '</li>').join('') + (ordered ? '</ol>' : '</ul>') + '</div>'
      }
      out.push(list(t('digestCore'), digest.corePoints, false))
      out.push(list(t('digestChain'), digest.argumentChain, true))
      const map = Array.isArray(digest.pointMap) ? digest.pointMap.filter(Boolean) : []
      if (map.length) {
        out.push('<div class="txp-digest-sec"><div class="txp-label">' + escapeHtml(t('digestMap')) + '</div><ul>')
        map.forEach((row) => {
          out.push('<li>' + (row.important === true ? '★ ' : '') + '<strong>' + escapeHtml(asText(row.id) + ' ' + asText(row.title)) + '</strong>' +
            (asText(row.role) ? '：' + escapeHtml(row.role) : '') +
            (asText(row.keyIdea) ? '<div class="txp-step-detail">' + escapeHtml(row.keyIdea) + '</div>' : '') + '</li>')
        })
        out.push('</ul></div>')
      }
      out.push(list(t('digestTakeaways'), digest.takeaways, false))
      out.push(list(t('digestPitfalls'), digest.pitfalls, false))
      const conn = digest.connections && typeof digest.connections === 'object' ? digest.connections : null
      const before = asText(conn && conn.before)
      const after = asText(conn && conn.after)
      if (before || after) {
        out.push('<div class="txp-digest-sec"><div class="txp-label">' + escapeHtml(t('digestConnections')) + '</div>')
        if (before) out.push('<p class="txp-p"><strong>' + escapeHtml(t('digestBefore')) + '</strong> ' + escapeHtml(before) + '</p>')
        if (after) out.push('<p class="txp-p"><strong>' + escapeHtml(t('digestAfter')) + '</strong> ' + escapeHtml(after) + '</p>')
        out.push('</div>')
      }
      out.push('</div>')
      return out.join('')
    }

    function exportPoint(point) {
      const item = point && typeof point === 'object' ? point : {}
      const parts = ['<div class="txp-point">']
      if (asText(item.id)) parts.push('<div class="txp-example-no">' + escapeHtml(item.id) + '</div>')
      if (item.important === true) parts.push('<div class="txp-starline">★ ' + escapeHtml(t('important')) + '</div>')
      parts.push('<h4 class="txp-h4">' + escapeHtml(asText(item.title) || t('point')) + '</h4>')
      parts.push(exportBlock(t('itSolves'), item.solves, 'brand'))
      parts.push(exportBlock(t('meaning'), item.meaning, ''))
      parts.push(exportBlock(t('detail'), item.detail, ''))
      parts.push(exportKeyPoints(item.keyPoints))
      parts.push(exportBlock(t('analogy'), item.analogy, 'brand'))
      parts.push(exportFormulaBlock(item))
      parts.push(exportDerivationBlock(item))
      parts.push(exportBlock(t('application'), item.application, ''))
      parts.push(exportBlock(t('mistakes'), item.mistakes, 'warn'))
      parts.push(exportBlock(t('examTips'), item.examTips, 'ok'))
      const example = item.example && typeof item.example === 'object' ? item.example : {}
      if (asText(example.question)) {
        parts.push('<div class="txp-label">' + escapeHtml(t('example')) + '</div><p class="txp-q">' + escapeHtml(example.question) + '</p>')
        parts.push(exportAnswerBlock(example.answer, ''))
      }
      parts.push(exportRequires(t('prerequisites'), asList(item.prerequisites)))
      parts.push(exportBlock(t('limitation'), item.limitation, 'warn'))
      parts.push(exportBlock(t('nextLink'), item.next, ''))
      parts.push('</div>')
      return parts.join('\n')
    }

    function buildExportBody(book, chapters) {
      const overview = book.overview && typeof book.overview === 'object' ? book.overview : {}
      const chapterMetas = Array.isArray(book.chapters) ? book.chapters.filter((meta) => meta && asText(meta.id)) : []
      let sectionCount = 0
      let pointCount = 0
      let importantCount = 0
      chapterMetas.forEach((meta) => {
        const detail = chapters[asText(meta.id)] || meta
        const sections = Array.isArray(detail.sections) ? detail.sections : (Array.isArray(meta.sections) ? meta.sections : [])
        sectionCount += sections.length
        sections.forEach((section) => {
          pointCount += sectionPointCount(section)
          const sectionPoints = Array.isArray(section.points) ? section.points : []
          sectionPoints.forEach((point) => { if (point && point.important === true) importantCount += 1 })
        })
      })
      const stats = book.stats && typeof book.stats === 'object' ? book.stats : {}
      const chapterCount = Math.max(chapterMetas.length, Number(stats.chapters) || 0)
      if (Number(stats.sections) > sectionCount) sectionCount = Number(stats.sections)
      if (Number(stats.points) > pointCount) pointCount = Number(stats.points)
      const parts = ['<div class="txp-main">']
      parts.push('<h1 class="txp-h1">' + escapeHtml(asText(book.title) || t('book')) + '</h1>')
      if (asText(book.subtitle)) parts.push('<p class="txp-sub">' + escapeHtml(book.subtitle) + '</p>')
      const metaBits = []
      if (asText(book.subject)) metaBits.push(asText(book.subject))
      if (asText(book.updatedAt)) metaBits.push(t('updated') + ' ' + asText(book.updatedAt).replace('T', ' ').slice(0, 16))
      metaBits.push(chapterCount + ' ' + t('statCh'), sectionCount + ' ' + t('statSec'), pointCount + ' ' + t('statPt'), importantCount + ' ' + t('importantUnit'))
      parts.push('<p class="txp-meta">' + escapeHtml(metaBits.join(' · ')) + '</p>')
      if (asList(book.tags).length) parts.push('<div>' + exportChips(asList(book.tags)) + '</div>')
      parts.push('<div class="txp-card"><div class="txp-eyebrow">' + escapeHtml(t('overview')) + '</div>')
      parts.push(exportBlock(t('goal'), overview.goal, 'brand'))
      parts.push(exportBlock(t('pain'), overview.pain, 'warn'))
      parts.push(exportBlock(t('mainline'), overview.mainline, ''))
      parts.push(exportBlock(t('analogy'), overview.analogy, 'brand'))
      const chain = Array.isArray(overview.chain) ? overview.chain.filter(Boolean) : []
      if (chain.length) {
        parts.push('<div class="txp-label">' + escapeHtml(t('chain')) + '</div><div class="txp-chain">' + chain.map((entry, index) => {
          const chainItem = entry && typeof entry === 'object' ? entry : { step: asText(entry) }
          const step = asText(chainItem.step) || asText(chainItem.to) || ('#' + (index + 1))
          const detail = asText(chainItem.detail)
          const defect = asText(chainItem.defect)
          return '<div class="txp-chain-node"><strong>' + escapeHtml(step) + '</strong>' +
            (detail ? '<p class="txp-p">' + escapeHtml(detail) + '</p>' : '') +
            (defect ? '<p class="txp-p">' + escapeHtml(t('defect') + '：' + defect) + '</p>' : '') + '</div>'
        }).join('') + '</div>')
      }
      parts.push('</div>')
      if (chapterMetas.length) {
        parts.push('<div class="txp-card"><div class="txp-eyebrow">' + escapeHtml(t('chaptersTitle')) + '</div><ol class="txp-toc">' +
          chapterMetas.map((meta) => '<li><a href="#' + escapeHtml(asText(meta.id)) + '">' + escapeHtml(chapterName(meta)) + '</a></li>').join('') +
          '</ol></div>')
      }
      chapterMetas.forEach((meta) => {
        const detail = chapters[asText(meta.id)] && typeof chapters[asText(meta.id)] === 'object' ? chapters[asText(meta.id)] : meta
        const chapterMeta = Object.assign({}, meta, {
          id: asText(detail.id) || asText(meta.id),
          number: asText(detail.number) || asText(meta.number),
          title: asText(detail.title) || asText(meta.title),
        })
        const sections = Array.isArray(detail.sections) && detail.sections.length
          ? detail.sections
          : (Array.isArray(meta.sections) ? meta.sections : [])
        parts.push('<div class="txp-section" id="' + escapeHtml(asText(meta.id)) + '"><div class="txp-h2">' + escapeHtml(chapterName(chapterMeta)) + '</div></div>')
        parts.push('<div class="txp-card">')
        parts.push(exportBlock(t('solves'), detail.solves || meta.solves, 'brand'))
        parts.push(exportRequires(t('requires'), asList(detail.requires).length ? asList(detail.requires) : asList(meta.requires)))
        parts.push(exportBlock(t('gain'), detail.gain || meta.gain, 'ok'))
        parts.push(exportBlock(t('gap') + ' → ' + t('nextChapter'), detail.remainingGap || meta.remainingGap, 'warn'))
        parts.push(exportBlock(t('analogy'), detail.analogy || meta.analogy, 'brand'))
        const chapterChain = Array.isArray(detail.chain) ? detail.chain : []
        if (chapterChain.length) {
          parts.push('<div class="txp-label">' + escapeHtml(t('chain')) + '</div><div class="txp-chain">' + chapterChain.map((entry) => {
            const chainItem = entry && typeof entry === 'object' ? entry : { to: asText(entry) }
            const from = asText(chainItem.from)
            const to = asText(chainItem.to) || asText(chainItem.step)
            const label = asText(chainItem.label)
            return '<div class="txp-chain-node">' + (from ? '<p class="txp-p">' + escapeHtml(from) + ' →</p>' : '') +
              '<strong>' + escapeHtml(to) + '</strong>' + (label ? '<p class="txp-p">' + escapeHtml(label) + '</p>' : '') + '</div>'
          }).join('') + '</div>')
        }
        parts.push('</div>')
        sections.forEach((section) => {
          const sectionItem = section && typeof section === 'object' ? section : {}
          parts.push('<div class="txp-card">')
          parts.push('<div class="txp-eyebrow">' + escapeHtml(t('section') + ' ' + asText(sectionItem.id)) + '</div>')
          parts.push('<div class="txp-h3">' + escapeHtml(asText(sectionItem.title)) + '</div>')
          if (asText(sectionItem.subProblem)) parts.push('<p class="txp-p">' + escapeHtml(t('subProblem') + '：' + asText(sectionItem.subProblem)) + '</p>')
          parts.push(exportRequires(t('requires'), asList(sectionItem.requires)))
          parts.push(exportBlock(t('limitation'), sectionItem.remaining, 'warn'))
          parts.push(exportBlock(t('summary'), sectionItem.summary, 'brand'))
          parts.push(exportDigestBlock(sectionItem))
          parts.push(exportBlock(t('analogy'), sectionItem.analogy, 'brand'))
          parts.push(exportExamples(sectionItem.examples))
          const points = Array.isArray(sectionItem.points) ? sectionItem.points.filter(Boolean) : []
          points.forEach((point) => { parts.push(exportPoint(point)) })
          parts.push('</div>')
        })
      })
      parts.push('<div class="txp-footer">' + escapeHtml(t('title') + ' · ' + t('subtitle')) + '</div>')
      parts.push('</div>')
      return parts.filter(Boolean).join('\n')
    }

/* ───────────────────────── 导出网页 v2：自包含交互式知识地图 ───────────────────────── */
    function exportWebLabels() {
      const keys = ['title', 'subtitle', 'book', 'back', 'home', 'overview', 'goal', 'pain', 'mainline',
        'chain', 'defect', 'chaptersTitle', 'solves', 'requires', 'gain', 'gap', 'nextChapter', 'sections',
        'points', 'statCh', 'statSec', 'statPt', 'subProblem', 'summary', 'sectionExamples', 'exampleUnit',
        'showAnswer', 'hideAnswer', 'expand', 'collapse', 'note', 'itSolves', 'meaning', 'detail', 'keyPoints',
        'derivation', 'application', 'mistakes', 'examTips', 'example', 'answer', 'prerequisites', 'limitation',
        'nextLink', 'prev', 'next', 'escHint', 'important', 'importantUnit', 'chapter', 'section', 'point',
        'noPoints', 'noChapter', 'loading', 'chPrefix', 'chSuffix']
      const labels = {}
      keys.forEach((key) => { labels[key] = t(key) })
      labels.footer = t('title') + ' · ' + t('subtitle')
      return labels
    }

    function exportJsonSafe(value) {
      return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
    }

    /** v1.3：导出前归一化 point.math（theorems / derivationSteps / image）。 */
    function normalizeMath(raw) {
      if (!raw || typeof raw !== 'object') return null
      const theorems = Array.isArray(raw.theorems) ? raw.theorems.filter(Boolean).map((thm) => ({
        name: asText(thm.name),
        statement: asText(thm.statement),
        conditions: mirrorList(thm.conditions),
        symbols: Array.isArray(thm.symbols)
          ? thm.symbols.filter(Boolean).map((sym) => ({ sym: asText(sym.sym), meaning: asText(sym.meaning) })).filter((sym) => sym.sym || sym.meaning)
          : [],
      })) : []
      const derivationSteps = Array.isArray(raw.derivationSteps) ? raw.derivationSteps.filter(Boolean).map((step) => ({
        step: asText(step.step),
        detail: asText(step.detail),
      })) : []
      const image = raw.image && typeof raw.image === 'object' && asText(raw.image.dataUrl)
        ? { dataUrl: asText(raw.image.dataUrl), alt: asText(raw.image.alt), caption: asText(raw.image.caption) }
        : null
      if (!theorems.length && !derivationSteps.length && !image) return null
      return { theorems, derivationSteps, image }
    }

    /** v1.3：导出前归一化 section.digest（deepread 六段）。 */
    function normalizeDigest(raw) {
      if (!raw || typeof raw !== 'object') return null
      const digest = {
        oneLine: asText(raw.oneLine),
        corePoints: mirrorList(raw.corePoints),
        argumentChain: mirrorList(raw.argumentChain),
        pointMap: Array.isArray(raw.pointMap) ? raw.pointMap.filter(Boolean).map((row) => ({
          id: asText(row.id),
          title: asText(row.title),
          role: asText(row.role),
          keyIdea: asText(row.keyIdea),
          important: row.important === true,
        })).filter((row) => row.id || row.title) : [],
        takeaways: mirrorList(raw.takeaways),
        pitfalls: mirrorList(raw.pitfalls),
        connections: {
          before: asText(raw.connections && raw.connections.before),
          after: asText(raw.connections && raw.connections.after),
        },
      }
      const hasContent = digest.oneLine || digest.corePoints.length || digest.argumentChain.length || digest.pointMap.length
        || digest.takeaways.length || digest.pitfalls.length || digest.connections.before || digest.connections.after
      return hasContent ? digest : null
    }

    /** 导出用数据：完整四层树 + 星标 + 详解字段，缺字段安全降级。 */
    function buildExportData(book, chapters) {
      const overview = book.overview && typeof book.overview === 'object' ? book.overview : {}
      const chapterMetas = Array.isArray(book.chapters) ? book.chapters.filter((meta) => meta && asText(meta.id)) : []
      const data = {
        labels: exportWebLabels(),
        book: {
          id: asText(book.id),
          title: asText(book.title),
          subtitle: asText(book.subtitle),
          subject: asText(book.subject),
          tags: asList(book.tags),
          updatedAt: asText(book.updatedAt),
          overview: {
            goal: asText(overview.goal),
            pain: asText(overview.pain),
            mainline: asText(overview.mainline),
            analogy: asText(overview.analogy),
            chain: (Array.isArray(overview.chain) ? overview.chain : []).map((raw) => {
              const item = raw && typeof raw === 'object' ? raw : { step: asText(raw) }
              return { step: asText(item.step), detail: asText(item.detail), defect: asText(item.defect) }
            }).filter((item) => item.step || item.detail || item.defect),
          },
        },
        stats: { chapters: 0, sections: 0, points: 0, important: 0 },
        chapters: [],
      }
      chapterMetas.forEach((meta) => {
        const detail = chapters[asText(meta.id)] && typeof chapters[asText(meta.id)] === 'object' ? chapters[asText(meta.id)] : meta
        const sections = Array.isArray(detail.sections) ? detail.sections : (Array.isArray(meta.sections) ? meta.sections : [])
        data.chapters.push({
          id: asText(meta.id),
          number: asText(detail.number) || asText(meta.number),
          title: asText(detail.title) || asText(meta.title),
          solves: asText(detail.solves) || asText(meta.solves),
          requires: asList(detail.requires).length ? asList(detail.requires) : asList(meta.requires),
          gain: asText(detail.gain) || asText(meta.gain),
          remainingGap: asText(detail.remainingGap) || asText(meta.remainingGap),
          analogy: asText(detail.analogy) || asText(meta.analogy),
          chain: (Array.isArray(detail.chain) ? detail.chain : []).map((raw) => {
            const item = raw && typeof raw === 'object' ? raw : { to: asText(raw) }
            return { from: asText(item.from), to: asText(item.to) || asText(item.step), label: asText(item.label) }
          }).filter((item) => item.from || item.to),
          sections: sections.map((rawSection) => {
            const section = rawSection && typeof rawSection === 'object' ? rawSection : {}
            const points = Array.isArray(section.points) ? section.points.filter(Boolean) : []
            const pointList = points.map((rawPoint) => {
              const point = rawPoint && typeof rawPoint === 'object' ? rawPoint : {}
              const example = point.example && typeof point.example === 'object' ? point.example : {}
              return {
                id: asText(point.id),
                title: asText(point.title),
                important: point.important === true,
                solves: asText(point.solves),
                meaning: asText(point.meaning),
                detail: asText(point.detail),
                keyPoints: asList(point.keyPoints),
                analogy: asText(point.analogy),
                formula: asText(point.formula),
                derivation: asText(point.derivation),
                application: asText(point.application),
                mistakes: asText(point.mistakes),
                examTips: asText(point.examTips),
                example: { question: asText(example.question), answer: asText(example.answer) },
                prerequisites: asList(point.prerequisites),
                limitation: asText(point.limitation),
                next: asText(point.next),
                math: normalizeMath(point.math),
              }
            })
            data.stats.sections += 1
            data.stats.points += pointList.length
            pointList.forEach((point) => { if (point.important) data.stats.important += 1 })
            return {
              id: asText(section.id),
              title: asText(section.title),
              subProblem: asText(section.subProblem),
              requires: asList(section.requires),
              remaining: asText(section.remaining),
              summary: asText(section.summary),
              analogy: asText(section.analogy),
              digest: normalizeDigest(section.digest),
              examples: asExamples(section.examples).map((example) => ({
                id: asText(example.id),
                type: asText(example.type),
                source: asText(example.source),
                question: asText(example.question),
                answer: asText(example.answer),
                note: asText(example.note),
              })),
              points: pointList,
            }
          }),
        })
      })
      data.stats.chapters = data.chapters.length
      const rawStats = book.stats && typeof book.stats === 'object' ? book.stats : {}
      if (Number(rawStats.chapters) > data.stats.chapters) data.stats.chapters = Number(rawStats.chapters)
      if (Number(rawStats.sections) > data.stats.sections) data.stats.sections = Number(rawStats.sections)
      if (Number(rawStats.points) > data.stats.points) data.stats.points = Number(rawStats.points)
      return data
    }

    const WEB_CSS = `
:root{color-scheme:light dark;--tbp-bg:#f4f6f9;--tbp-layer:#ffffff;--tbp-layer2:#f6f8fb;--tbp-border:#dde3ec;--tbp-border2:#c8d2e0;--tbp-text:#1d2531;--tbp-text2:#48536a;--tbp-text3:#7a8494;--tbp-brand:#3559b8;--tbp-brand-bg:rgba(53,89,184,.10);--tbp-warn:#b06a12;--tbp-warn-bg:rgba(176,106,18,.10);--tbp-ok:#1f7f49;--tbp-ok-bg:rgba(31,127,73,.10);--tbp-star:#c8891a;--tbp-shadow:0 1px 2px rgba(20,30,50,.06)}
@media (prefers-color-scheme:dark){:root{--tbp-bg:#12161d;--tbp-layer:#1a2029;--tbp-layer2:#202836;--tbp-border:#2b3542;--tbp-border2:#3a4759;--tbp-text:#e7ecf4;--tbp-text2:#c3ccda;--tbp-text3:#8c98aa;--tbp-brand:#8fb0f7;--tbp-brand-bg:rgba(143,176,247,.12);--tbp-warn:#e0a75a;--tbp-warn-bg:rgba(224,167,90,.12);--tbp-ok:#5fc48c;--tbp-ok-bg:rgba(95,196,140,.12);--tbp-star:#f3c85a;--tbp-shadow:0 1px 2px rgba(0,0,0,.35)}}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body.tbp-body{background:var(--tbp-bg);color:var(--tbp-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.72;-webkit-text-size-adjust:100%}
.tbp-root{display:flex;flex-direction:column;min-height:100vh}
.tbp-topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--tbp-border);background:var(--tbp-layer)}
.tbp-brand{display:flex;align-items:center;gap:9px;min-width:0}
.tbp-brand-mark{display:flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border-radius:9px;color:var(--tbp-brand);background:var(--tbp-brand-bg);border:1px solid var(--tbp-border2);font-size:15px}
.tbp-headings{min-width:0}
.tbp-title{margin:0;font-size:15px;font-weight:700;white-space:normal;word-break:break-word}
.tbp-subtitle{margin:0;font-size:11.5px;color:var(--tbp-text3);white-space:normal;word-break:break-word}
.tbp-grow{flex:1 1 auto;min-width:8px}
.tbp-topmeta{font-size:11.5px;color:var(--tbp-text3);white-space:normal;word-break:break-word}
.tbp-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:9px;border:1px solid var(--tbp-border2);background:var(--tbp-layer2);color:var(--tbp-text2);font:inherit;font-size:12.5px;line-height:1.4;cursor:pointer}
.tbp-btn:hover{color:var(--tbp-text);border-color:var(--tbp-brand)}
.tbp-btn:focus-visible{outline:2px solid var(--tbp-brand);outline-offset:2px}
.tbp-shell{flex:1 1 auto;padding:18px 18px 60px}
.tbp-wrap{max-width:1020px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.tbp-view{display:flex;flex-direction:column;gap:12px}
.tbp-card{background:var(--tbp-layer);border:1px solid var(--tbp-border);border-radius:14px;padding:14px 16px;box-shadow:var(--tbp-shadow);min-width:0;box-sizing:border-box}
.tbp-click{display:block;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;appearance:none;transition:transform 150ms ease,border-color 150ms ease}
.tbp-click:hover{border-color:var(--tbp-brand);transform:translateY(-1px)}
.tbp-h1{margin:0;font-size:22px;line-height:1.35;word-break:break-word}
.tbp-h2{margin:0;font-size:17px;line-height:1.4;word-break:break-word}
.tbp-h3{margin:0;font-size:15px;line-height:1.45;word-break:break-word}
.tbp-eyebrow{margin:0 0 3px;font-size:10.5px;font-weight:700;letter-spacing:.08em;color:var(--tbp-text3);text-transform:uppercase}
.tbp-p{margin:0;font-size:13.5px;color:var(--tbp-text2);white-space:pre-wrap;word-break:break-word}
.tbp-num{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 8px;flex:none;border-radius:9px;font-size:13px;font-weight:700;color:var(--tbp-brand);background:var(--tbp-brand-bg);border:1px solid var(--tbp-border2)}
.tbp-star{color:var(--tbp-star);font-size:13px;flex:none}
.tbp-starwrap{display:inline-flex;align-items:center;gap:4px;flex:none;margin-right:4px}
.tbp-star-label{display:inline-block;padding:0 6px;border-radius:999px;font-size:10.5px;line-height:17px;color:var(--tbp-star);border:1px solid var(--tbp-border2);background:var(--tbp-layer2)}
.tbp-chip{display:inline-flex;align-items:center;max-width:100%;margin:0 6px 4px 0;padding:1px 8px;border-radius:999px;font-size:11.5px;line-height:19px;border:1px solid var(--tbp-border);background:var(--tbp-layer2);color:var(--tbp-text2);white-space:normal;word-break:break-word}
.tbp-chip-brand{color:var(--tbp-brand);border-color:var(--tbp-brand)}
.tbp-chip-warn{color:var(--tbp-warn);border-color:var(--tbp-warn)}
.tbp-chip-ok{color:var(--tbp-ok);border-color:var(--tbp-ok)}
.tbp-chipline{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.tbp-chipline-label{font-size:11.5px;color:var(--tbp-text3);flex:none}
.tbp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.tbp-section-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px;margin-top:4px}
.tbp-stats{font-size:12px;color:var(--tbp-text3);font-variant-numeric:tabular-nums}
.tbp-card-title{font-size:14px;font-weight:700;line-height:1.45;word-break:break-word;display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.tbp-card-top{display:flex;align-items:flex-start;gap:9px;min-width:0}
.tbp-card-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.tbp-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:7px;border-top:1px dashed var(--tbp-border);font-size:11.5px;color:var(--tbp-text3)}
.tbp-arrow{color:var(--tbp-brand);font-size:13px;flex:none}
.tbp-crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--tbp-text3);min-height:28px}
.tbp-crumb{border:none;background:none;padding:0;font:inherit;font-size:12px;color:var(--tbp-text2);cursor:pointer;border-radius:5px}
.tbp-crumb:hover{color:var(--tbp-brand);text-decoration:underline}
.tbp-crumb-cur{color:var(--tbp-text);font-size:12px;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tbp-crumb-sep{color:var(--tbp-text3);opacity:.7}
.tbp-block{margin:0 0 9px;padding:10px 12px;border-radius:10px;background:var(--tbp-layer2);border:1px solid var(--tbp-border);min-width:0;box-sizing:border-box}
.tbp-block:last-child{margin-bottom:0}
.tbp-block-brand{border-left:3px solid var(--tbp-brand)}
.tbp-block-gap{border-left:3px solid var(--tbp-warn)}
.tbp-block-gain{border-left:3px solid var(--tbp-ok)}
.tbp-block-label{font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--tbp-text3);margin-bottom:3px}
.tbp-block-text{margin:0;font-size:13.5px;color:var(--tbp-text2);white-space:pre-wrap;word-break:break-word}
.tbp-keypoints{margin:0;padding-left:22px;font-size:13.5px;color:var(--tbp-text2)}
.tbp-keypoints li{margin:0 0 2px;white-space:pre-wrap;word-break:break-word}
.tbp-keypoints li::marker{color:var(--tbp-brand);font-weight:700}
.tbp-formula{margin:0;padding:9px 11px;border-radius:9px;border:1px solid var(--tbp-border);background:var(--tbp-layer);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:var(--tbp-text)}
.tbp-hl{position:relative;padding:11px 13px 11px 15px;border-radius:11px;border:1px solid var(--tbp-brand);background:var(--tbp-brand-bg)}
.tbp-hl::before{content:"";position:absolute;left:0;top:11px;bottom:11px;width:3px;border-radius:3px;background:var(--tbp-brand)}
.tbp-hl-label{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--tbp-brand);margin-bottom:3px}
.tbp-hl-text{margin:0;font-size:14px;white-space:pre-wrap;word-break:break-word;color:var(--tbp-text)}
.tbp-chain{display:flex;flex-direction:column;gap:7px;margin-top:6px}
.tbp-chain-node{padding:9px 11px;border:1px solid var(--tbp-border);border-radius:9px;background:var(--tbp-layer2)}
.tbp-chain-step{font-size:12.5px;font-weight:700;color:var(--tbp-text);word-break:break-word}
.tbp-chain-detail{font-size:12px;color:var(--tbp-text2);white-space:pre-wrap;word-break:break-word;margin:0}
.tbp-pointitem{display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;padding:8px 10px;border-radius:9px;border:1px solid var(--tbp-border);background:var(--tbp-layer2);color:var(--tbp-text2);font:inherit;font-size:12.5px;cursor:pointer;box-sizing:border-box}
.tbp-pointitem:hover{border-color:var(--tbp-brand);color:var(--tbp-text)}
.tbp-pointitem-cur{border-color:var(--tbp-brand);background:var(--tbp-brand-bg);color:var(--tbp-text);cursor:default}
.tbp-pointitem-id{flex:none;font-weight:700;color:var(--tbp-brand);font-variant-numeric:tabular-nums}
.tbp-pointitem-main{display:flex;flex-direction:column;gap:1px;min-width:0}
.tbp-pointitem-title{font-weight:700;color:var(--tbp-text);word-break:break-word;display:inline-flex;flex-wrap:wrap;align-items:center;gap:3px}
.tbp-pointitem-sub{font-size:11.5px;color:var(--tbp-text3);word-break:break-word}
.tbp-pointlist{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding:0;list-style:none}
.tbp-example{border:1px solid var(--tbp-border);border-radius:10px;padding:11px 13px;background:var(--tbp-layer2);margin:0 0 9px;min-width:0;box-sizing:border-box}
.tbp-example-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:5px}
.tbp-example-no{font-size:12px;font-weight:700;color:var(--tbp-brand);font-variant-numeric:tabular-nums}
.tbp-example-q{margin:0;font-size:13.5px;color:var(--tbp-text);white-space:pre-wrap;word-break:break-word}
.tbp-answer{margin-top:8px;padding:9px 11px;border-radius:9px;border:1px solid var(--tbp-ok);background:var(--tbp-ok-bg)}
.tbp-answer p{margin:0;font-size:13px;color:var(--tbp-text2);white-space:pre-wrap;word-break:break-word}
.tbp-answer-label{font-size:11px;font-weight:700;color:var(--tbp-ok);margin-bottom:2px}
.tbp-note{margin:6px 0 0;font-size:12px;color:var(--tbp-warn);white-space:pre-wrap;word-break:break-word}
.tbp-hidden{display:none}
.tbp-detail-head{display:flex;align-items:flex-start;gap:10px;min-width:0}
.tbp-detail-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.tbp-title-row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;min-width:0}
.tbp-detail-title{margin:0;font-size:20px;line-height:1.35;word-break:break-word}
.tbp-detail-sub{font-size:12px;color:var(--tbp-text3);word-break:break-word}
.tbp-detail-blocks{display:flex;flex-direction:column;gap:10px}
.tbp-pager{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:9px;margin-top:4px}
.tbp-pager-hint{font-size:11.5px;color:var(--tbp-text3)}
.tbp-footer{margin:22px 0 0;font-size:11px;color:var(--tbp-text3);text-align:center}
.tbp-empty{padding:26px;text-align:center;font-size:13px;color:var(--tbp-text3);border:1px dashed var(--tbp-border);border-radius:12px}
.tbp-noscript{padding:20px;text-align:center;font-size:14px;color:var(--tbp-warn)}
@media (max-width:720px){.tbp-shell{padding:12px 12px 40px}.tbp-topbar{padding:9px 12px}.tbp-detail-title{font-size:18px}.tbp-grid{grid-template-columns:1fr}.tbp-pager-hint{display:none}.tbp-crumb-cur{max-width:180px}}
@media print{.tbp-topbar,.tbp-btn,.tbp-pager{display:none!important}.tbp-hidden{display:block!important}.tbp-card,.tbp-block,.tbp-example,.tbp-pointitem{break-inside:avoid}body.tbp-body{background:#fff;color:#111}.tbp-shell{padding:0}.tbp-wrap{max-width:none}.tbp-card{box-shadow:none}}

.tbp-math{display:flex;flex-direction:column;gap:10px}
.tbp-theorem{border:1px solid var(--tbp-border);border-radius:12px;background:var(--tbp-layer2);padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.tbp-theorem-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tbp-theorem-no{font-size:11px;font-weight:700;color:var(--tbp-brand);border:1px solid var(--tbp-brand);background:var(--tbp-brand-bg);border-radius:999px;padding:1px 8px;line-height:18px}
.tbp-theorem-name{font-size:13.5px;font-weight:700;color:var(--tbp-text)}
.tbp-theorem-statement{margin:0;padding:11px 12px;border-radius:10px;border:1px solid var(--tbp-border2);background:var(--tbp-layer);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px;line-height:2;color:var(--tbp-text);text-align:center;white-space:pre-wrap;word-break:break-word}
.tbp-condline{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px}
.tbp-condline-label{font-size:11px;font-weight:700;color:var(--tbp-warn);padding-top:2px}
.tbp-symtable{display:grid;grid-template-columns:minmax(70px,max-content) 1fr;gap:5px 12px;font-size:12.5px;color:var(--tbp-text2);margin:0}
.tbp-symtable dt{margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--tbp-text)}
.tbp-symtable dd{margin:0}
.tbp-formula-card{margin:0;padding:11px 12px;border-radius:10px;border:1px solid var(--tbp-border);background:var(--tbp-layer);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px;line-height:2;color:var(--tbp-text);text-align:center;white-space:pre-wrap;word-break:break-word}
.tbp-formula-img{display:block;max-width:100%;height:auto;margin:2px auto;border-radius:10px;border:1px solid var(--tbp-border);background:var(--tbp-layer)}
.tbp-formula-cap{margin:6px 0 0;font-size:11.5px;color:var(--tbp-text3);text-align:center}
.tbp-steps{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.tbp-step{display:flex;gap:10px;padding:9px 11px;border-radius:10px;border:1px solid var(--tbp-border);background:var(--tbp-layer2)}
.tbp-step-no{flex:none;width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--tbp-brand);background:var(--tbp-brand-bg)}
.tbp-step-body{min-width:0;flex:1 1 auto}
.tbp-step-title{font-size:12.5px;font-weight:650;color:var(--tbp-text)}
.tbp-step-detail{margin:4px 0 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.85;color:var(--tbp-text2);white-space:pre-wrap;word-break:break-word}
.tbp-step-calc{align-items:flex-start;background:var(--tbp-layer)}
.tbp-step-line{margin:5px 0 0;padding:9px 11px;border-radius:8px;border:1px solid var(--tbp-border);background:var(--tbp-layer2);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.95;color:var(--tbp-text);white-space:pre-wrap;word-break:break-word}
.tbp-step-why{margin:5px 0 0;font-size:12px;line-height:1.6;color:var(--tbp-text3);border-left:2px solid var(--tbp-border2);padding:3px 0 3px 8px}
.txp-step-line{margin:5px 0;padding:9px 11px;border-radius:8px;border:1px solid #dfe3ea;background:#fbfbfc;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.9;white-space:pre-wrap;word-break:break-word}
.txp-step-why{margin:4px 0;font-size:12px;color:#7a8494;border-left:2px solid #e4e8ee;padding-left:8px}
.tbp-digest{display:flex;flex-direction:column;gap:12px}
.tbp-digest-one{margin:0;font-size:14.5px;font-weight:650;line-height:1.6;color:var(--tbp-text);padding:10px 12px;border-radius:10px;border:1px solid var(--tbp-brand);background:var(--tbp-brand-bg)}
.tbp-digest-sec{display:flex;flex-direction:column;gap:5px}
.tbp-digest-label{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--tbp-text3)}
.tbp-digest-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.tbp-digest-list li{font-size:13px;line-height:1.65;color:var(--tbp-text2)}
.tbp-digest-chain{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.tbp-digest-chain li{font-size:13px;line-height:1.65;color:var(--tbp-text2)}
.tbp-dmap{display:flex;flex-direction:column;gap:6px}
.tbp-dmap-row{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border-radius:9px;border:1px solid var(--tbp-border);background:var(--tbp-layer2)}
.tbp-dmap-row-cur{border-color:var(--tbp-brand);background:var(--tbp-brand-bg)}
.tbp-dmap-id{flex:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;font-weight:650;color:var(--tbp-brand);min-width:44px}
.tbp-dmap-main{min-width:0;display:flex;flex-direction:column;gap:2px}
.tbp-dmap-title{font-size:12.5px;font-weight:650;color:var(--tbp-text)}
.tbp-dmap-role{font-size:12px;color:var(--tbp-text2);line-height:1.55}
.tbp-dmap-key{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--tbp-text3)}
.tbp-connect{display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--tbp-text2)}
.tbp-connect-row{display:flex;gap:7px;align-items:flex-start}
.tbp-connect-tag{flex:none;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:999px;line-height:16px;border:1px solid var(--tbp-border2);color:var(--tbp-text3)}
@media print{.tbp-deriv.tbp-hidden,.tbp-answer.tbp-hidden{display:block!important}}
`

    const WEB_JS = `
(function () {
  'use strict'
  var DATA = window.__TBP_DATA__ || { book: {}, chapters: [], stats: {}, labels: {} }
  var root = document.getElementById('tbp-root')
  if (!root) return
  var book = DATA.book || {}
  var chapters = Array.isArray(DATA.chapters) ? DATA.chapters : []
  var stats = DATA.stats || {}
  var labels = DATA.labels || {}
  var view = { type: 'book' }

  function label(key, fallback) {
    var value = labels[key]
    if (typeof value === 'string' && value) return value
    return typeof fallback === 'string' ? fallback : ''
  }
  function txt(value) { return value === null || value === undefined ? '' : String(value) }
  function list(value) {
    var out = []
    if (!Array.isArray(value)) return out
    for (var i = 0; i < value.length; i += 1) {
      if (typeof value[i] === 'string' && value[i]) out.push(value[i])
    }
    return out
  }
  function append(node, children) {
    if (children === null || children === undefined || children === false) return
    if (Array.isArray(children)) {
      for (var i = 0; i < children.length; i += 1) append(node, children[i])
      return
    }
    if (typeof children === 'string' || typeof children === 'number') {
      node.appendChild(document.createTextNode(String(children)))
      return
    }
    if (children) node.appendChild(children)
  }
  function el(tag, props, children) {
    var node = document.createElement(tag)
    if (props) {
      for (var key in props) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) continue
        var value = props[key]
        if (value === null || value === undefined || value === false) continue
        if (key === 'class') node.className = String(value)
        else if (key === 'text') node.textContent = String(value)
        else if (key === 'act') node.setAttribute('data-act', String(value))
        else node.setAttribute(key, String(value))
      }
    }
    append(node, children)
    return node
  }
  function count(n, unit) { return String(n) + ' ' + unit }
  function star(on, withLabel) {
    if (!on) return null
    return el('span', { class: 'tbp-starwrap' }, [
      el('span', { class: 'tbp-star', 'aria-hidden': 'true' }, '★'),
      withLabel === false ? null : el('span', { class: 'tbp-star-label' }, label('important', '重点'))
    ])
  }
  function chip(text, tone) {
    return el('span', { class: 'tbp-chip' + (tone ? ' tbp-chip-' + tone : '') }, txt(text))
  }
  function chips(values) {
    var items = list(values)
    var out = []
    for (var i = 0; i < items.length; i += 1) out.push(chip(items[i], ''))
    return out
  }
  function chipsBlock(labelText, values) {
    var items = chips(values)
    if (!items.length) return null
    return el('div', { class: 'tbp-chipline' }, [el('span', { class: 'tbp-chipline-label' }, labelText)].concat(items))
  }
  function block(labelText, content, tone) {
    var value = txt(content)
    if (!value) return null
    return el('div', { class: 'tbp-block' + (tone ? ' tbp-block-' + tone : '') }, [
      el('div', { class: 'tbp-block-label' }, labelText),
      el('p', { class: 'tbp-block-text', text: value })
    ])
  }
  function listBlock(labelText, items) {
    var values = list(items)
    if (!values.length) return null
    var lis = []
    for (var i = 0; i < values.length; i += 1) lis.push(el('li', { text: values[i] }))
    return el('div', { class: 'tbp-block' }, [
      el('div', { class: 'tbp-block-label' }, labelText),
      el('ol', { class: 'tbp-keypoints' }, lis)
    ])
  }
  function num(value) { return el('span', { class: 'tbp-num' }, txt(value) || '·') }
  function chapterSections(chapter) { return chapter && Array.isArray(chapter.sections) ? chapter.sections : [] }
  function sectionPoints(section) { return section && Array.isArray(section.points) ? section.points.length : 0 }
  function importantIn(points) {
    var n = 0
    if (!Array.isArray(points)) return n
    for (var i = 0; i < points.length; i += 1) if (points[i] && points[i].important === true) n += 1
    return n
  }
  function chapterPointCount(chapter) {
    var total = 0
    var sections = chapterSections(chapter)
    for (var i = 0; i < sections.length; i += 1) total += sectionPoints(sections[i])
    return total
  }
  function chapterImportantCount(chapter) {
    var total = 0
    var sections = chapterSections(chapter)
    for (var i = 0; i < sections.length; i += 1) total += importantIn(sections[i].points)
    return total
  }
  function findChapter(id) {
    for (var i = 0; i < chapters.length; i += 1) if (String(chapters[i].id) === String(id)) return chapters[i]
    return null
  }
  function findSection(chapter, id) {
    var sections = chapterSections(chapter)
    for (var i = 0; i < sections.length; i += 1) if (String(sections[i].id) === String(id)) return sections[i]
    return null
  }
  function findPoint(section, id) {
    var points = section && Array.isArray(section.points) ? section.points : []
    for (var i = 0; i < points.length; i += 1) if (String(points[i].id) === String(id)) return points[i]
    return null
  }
  function pointIndex(section, id) {
    var points = section && Array.isArray(section.points) ? section.points : []
    for (var i = 0; i < points.length; i += 1) if (String(points[i].id) === String(id)) return i
    return -1
  }
  function chapterLabel(chapter) {
    var number = txt(chapter && chapter.number)
    var title = txt(chapter && chapter.title)
    if (!number) return title || label('chapter', '章')
    return label('chPrefix', '第') + number + label('chSuffix', '章') + (title ? ' · ' + title : '')
  }
  function statsLine() {
    return count(stats.chapters || chapters.length, label('statCh', '章')) + ' · ' +
      count(stats.sections || 0, label('statSec', '节')) + ' · ' +
      count(stats.points || 0, label('statPt', '个知识点')) + ' · ' +
      count(stats.important || 0, label('importantUnit', '重点'))
  }
  function hashOf(target) {
    if (!target || target.type === 'book') return '#/'
    var hash = '#/' + encodeURIComponent(txt(target.chapterId))
    if (target.sectionId) hash += '/' + encodeURIComponent(txt(target.sectionId))
    if (target.pointId) hash += '/' + encodeURIComponent(txt(target.pointId))
    return hash
  }
  function parseHash(raw) {
    var value = raw === null || raw === undefined ? '' : String(raw)
    if (value.charAt(0) === '#') value = value.slice(1)
    while (value.charAt(0) === '/') value = value.slice(1)
    if (!value) return { type: 'book' }
    var pieces = value.split('/')
    var parts = []
    for (var i = 0; i < pieces.length; i += 1) {
      if (!pieces[i]) continue
      try { parts.push(decodeURIComponent(pieces[i])) } catch (error) { parts.push(pieces[i]) }
    }
    if (!parts.length) return { type: 'book' }
    if (parts.length === 1) return { type: 'chapter', chapterId: parts[0] }
    if (parts.length === 2) return { type: 'section', chapterId: parts[0], sectionId: parts[1] }
    return { type: 'point', chapterId: parts[0], sectionId: parts[1], pointId: parts[2] }
  }
  function currentHash() {
    return window.location && window.location.hash ? String(window.location.hash) : ''
  }
  function navigate(target) {
    view = target || { type: 'book' }
    var hash = hashOf(view)
    try {
      if (window.location && currentHash() !== hash) window.location.hash = hash
    } catch (error) { /* 忽略 */ }
    render()
  }
  function goUp() {
    if (view.type === 'point') navigate({ type: 'section', chapterId: view.chapterId, sectionId: view.sectionId })
    else if (view.type === 'section') navigate({ type: 'chapter', chapterId: view.chapterId })
    else navigate({ type: 'book' })
  }
  function topbar() {
    var bar = el('header', { class: 'tbp-topbar' })
    var brand = el('div', { class: 'tbp-brand' })
    brand.appendChild(el('span', { class: 'tbp-brand-mark', 'aria-hidden': 'true' }, '◎'))
    var headings = el('div', { class: 'tbp-headings' })
    headings.appendChild(el('p', { class: 'tbp-title' }, label('title', '教材知识框架')))
    if (txt(book.title)) headings.appendChild(el('p', { class: 'tbp-subtitle' }, txt(book.title)))
    brand.appendChild(headings)
    bar.appendChild(brand)
    bar.appendChild(el('div', { class: 'tbp-grow' }))
    if (view.type !== 'book') {
      bar.appendChild(el('button', { class: 'tbp-btn', type: 'button', act: 'back' }, '← ' + label('back', '返回')))
      bar.appendChild(el('button', { class: 'tbp-btn', type: 'button', act: 'home' }, label('home', '全书总览')))
    }
    bar.appendChild(el('span', { class: 'tbp-topmeta' }, statsLine()))
    return bar
  }
  function crumb(items) {
    var nav = el('nav', { class: 'tbp-crumbs' })
    nav.appendChild(el('button', { class: 'tbp-btn', type: 'button', act: 'back' }, '← ' + label('back', '返回')))
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] || {}
      if (i > 0) nav.appendChild(el('span', { class: 'tbp-crumb-sep', 'aria-hidden': 'true' }, '/'))
      if (item.hash && i < items.length - 1) nav.appendChild(el('button', { class: 'tbp-crumb', type: 'button', act: 'go', 'data-hash': item.hash }, item.text))
      else nav.appendChild(el('span', { class: 'tbp-crumb-cur' }, item.text))
    }
    return nav
  }
  function pagerBack() {
    return el('div', { class: 'tbp-pager' }, [
      el('button', { class: 'tbp-btn', type: 'button', act: 'back' }, '← ' + label('back', '返回'))
    ])
  }
  function chainBlock(labelText, chain) {
    var items = Array.isArray(chain) ? chain : []
    if (!items.length) return null
    var wrap = el('div', { class: 'tbp-block' }, [el('div', { class: 'tbp-block-label' }, labelText)])
    var chainWrap = el('div', { class: 'tbp-chain' })
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] || {}
      var node = el('div', { class: 'tbp-chain-node' })
      if (txt(item.from)) node.appendChild(el('p', { class: 'tbp-chain-detail' }, txt(item.from) + ' →'))
      if (txt(item.step)) node.appendChild(el('div', { class: 'tbp-chain-step' }, txt(item.step)))
      if (txt(item.to) && !txt(item.step)) node.appendChild(el('div', { class: 'tbp-chain-step' }, txt(item.to)))
      if (txt(item.detail)) node.appendChild(el('p', { class: 'tbp-chain-detail' }, txt(item.detail)))
      if (txt(item.label)) node.appendChild(el('div', { class: 'tbp-chipline' }, [chip(txt(item.label), 'brand')]))
      if (txt(item.defect)) node.appendChild(el('p', { class: 'tbp-note' }, label('defect', '缺陷') + '：' + txt(item.defect)))
      chainWrap.appendChild(node)
    }
    wrap.appendChild(chainWrap)
    return wrap
  }
  function chapterCard(chapter) {
    var sections = chapterSections(chapter).length
    var points = chapterPointCount(chapter)
    var stars = chapterImportantCount(chapter)
    var card = el('button', { class: 'tbp-card tbp-click', type: 'button', act: 'chapter', 'data-id': txt(chapter.id) })
    card.appendChild(el('div', { class: 'tbp-card-top' }, [
      num(txt(chapter.number) || txt(chapter.id)),
      el('div', { class: 'tbp-card-main' }, [
        el('div', { class: 'tbp-card-title' }, chapterLabel(chapter)),
        txt(chapter.solves) ? el('p', { class: 'tbp-p' }, txt(chapter.solves)) : null
      ])
    ]))
    var requires = chipsBlock(label('requires', '前置依赖'), chapter.requires)
    if (requires) card.appendChild(requires)
    card.appendChild(el('div', { class: 'tbp-card-foot' }, [
      el('span', {}, count(sections, label('sections', '节')) + ' · ' + count(points, label('points', '个知识点')) + ' · ' + count(stars, label('importantUnit', '重点'))),
      el('span', { class: 'tbp-arrow', 'aria-hidden': 'true' }, '→')
    ]))
    return card
  }
  function sectionCard(chapter, section) {
    var points = sectionPoints(section)
    var stars = importantIn(section.points)
    var card = el('button', { class: 'tbp-card tbp-click', type: 'button', act: 'section', 'data-id': txt(section.id) })
    card.appendChild(el('div', { class: 'tbp-card-top' }, [
      num(txt(section.id)),
      el('div', { class: 'tbp-card-main' }, [
        el('div', { class: 'tbp-card-title' }, txt(section.title) || label('section', '节')),
        txt(section.subProblem) ? el('p', { class: 'tbp-p' }, label('subProblem', '本小节子问题') + '：' + txt(section.subProblem)) : null
      ])
    ]))
    card.appendChild(el('div', { class: 'tbp-card-foot' }, [
      el('span', {}, count(points, label('points', '个知识点')) + ' · ' + count(stars, label('importantUnit', '重点'))),
      el('span', { class: 'tbp-arrow', 'aria-hidden': 'true' }, '→')
    ]))
    return card
  }
  function pointRow(section, point, isCurrent) {
    var tag = isCurrent ? 'div' : 'button'
    var props = { class: 'tbp-pointitem' + (isCurrent ? ' tbp-pointitem-cur' : '') }
    if (!isCurrent) {
      props.type = 'button'
      props.act = 'point'
      props['data-id'] = txt(point.id)
    }
    var row = el(tag, props)
    row.appendChild(el('span', { class: 'tbp-pointitem-id' }, txt(point.id) || '·'))
    var main = el('span', { class: 'tbp-pointitem-main' })
    var title = el('span', { class: 'tbp-pointitem-title' })
    var starNode = star(point.important === true, false)
    if (starNode) title.appendChild(starNode)
    title.appendChild(document.createTextNode(txt(point.title) || label('point', '知识点')))
    main.appendChild(title)
    if (txt(point.solves)) main.appendChild(el('span', { class: 'tbp-pointitem-sub' }, txt(point.solves)))
    row.appendChild(main)
    return row
  }
  function summaryCard(section, currentId) {
    var points = section && Array.isArray(section.points) ? section.points : []
    var summary = txt(section && section.summary)
    var digest = section && section.digest && typeof section.digest === 'object' ? section.digest : null
    if (!summary && !digest && !points.length) return null
    var card = el('section', { class: 'tbp-card' })
    card.appendChild(el('p', { class: 'tbp-eyebrow' }, label('summary', '本节知识点汇总')))
    if (digest) {
      card.appendChild(webDigest(digest, section, currentId))
    } else if (summary) {
      card.appendChild(el('p', { class: 'tbp-p', text: summary }))
    }
    if (points.length) {
      var wrap = el('div', { class: 'tbp-pointlist' })
      for (var i = 0; i < points.length; i += 1) wrap.appendChild(pointRow(section, points[i], String(points[i].id) === String(currentId)))
      card.appendChild(wrap)
    }
    return card
  }
  /* ── v1.3：导出页的定理卡片 / 多公式 / 折叠推导 / digest ── */
  function webFormulaBlock(point) {
    function webSplitFormula(text) {
      var raw = txt(text)
      if (!raw) return []
      return raw.split(new RegExp('[；;\\n]+')).map(function (part) { return part.trim().replace(/[，,、]+$/, '').trim() }).filter(function (part) { return part.length > 0 })
    }
    var math = point && point.math && typeof point.math === 'object' ? point.math : null
    var theorems = math && Array.isArray(math.theorems) ? math.theorems : []
    var image = math && math.image && txt(math.image.dataUrl) ? math.image : null
    var formulas = webSplitFormula(point && point.formula)
    if (!theorems.length && !image && !formulas.length) return null
    var box = el('div', { class: 'tbp-block' })
    box.appendChild(el('div', { class: 'tbp-block-label' }, label('formula', '公式 / 定理')))
    if (theorems.length) {
      var mathWrap = el('div', { class: 'tbp-math' })
      for (var i = 0; i < theorems.length; i += 1) {
        var thm = theorems[i] || {}
        var theo = el('div', { class: 'tbp-theorem' })
        var head = el('div', { class: 'tbp-theorem-head' })
        head.appendChild(el('span', { class: 'tbp-theorem-no' }, label('theorem', '定理') + ' ' + (i + 1)))
        if (txt(thm.name)) head.appendChild(el('span', { class: 'tbp-theorem-name' }, txt(thm.name)))
        theo.appendChild(head)
        if (txt(thm.statement)) theo.appendChild(el('p', { class: 'tbp-theorem-statement' }, txt(thm.statement)))
        var conds = Array.isArray(thm.conditions) ? thm.conditions : []
        if (conds.length) {
          var condLine = el('div', { class: 'tbp-condline' })
          condLine.appendChild(el('span', { class: 'tbp-condline-label' }, label('conditions', '适用条件')))
          for (var c = 0; c < conds.length; c += 1) condLine.appendChild(chip(txt(conds[c]), 'warn'))
          theo.appendChild(condLine)
        }
        var syms = Array.isArray(thm.symbols) ? thm.symbols : []
        if (syms.length) {
          var symSec = el('div', { class: 'tbp-digest-sec' })
          symSec.appendChild(el('div', { class: 'tbp-digest-label' }, label('symbols', '符号说明')))
          var dl = el('dl', { class: 'tbp-symtable' })
          for (var s = 0; s < syms.length; s += 1) {
            dl.appendChild(el('dt', {}, txt(syms[s] && syms[s].sym) || '·'))
            dl.appendChild(el('dd', {}, txt(syms[s] && syms[s].meaning)))
          }
          symSec.appendChild(dl)
          theo.appendChild(symSec)
        }
        mathWrap.appendChild(theo)
      }
      box.appendChild(mathWrap)
    }
    if (image) {
      box.appendChild(el('img', { class: 'tbp-formula-img', src: txt(image.dataUrl), alt: txt(image.alt) || label('formulaImage', '公式图') }))
      if (txt(image.caption)) box.appendChild(el('p', { class: 'tbp-formula-cap' }, txt(image.caption)))
    }
    if (formulas.length) {
      var fw = el('div', { class: 'tbp-math' })
      for (var f = 0; f < formulas.length; f += 1) fw.appendChild(el('p', { class: 'tbp-formula-card' }, formulas[f]))
      box.appendChild(fw)
    }
    return box
  }
  function webDerivationBlock(point) {
    var math = point && point.math && typeof point.math === 'object' ? point.math : null
    var steps = math && Array.isArray(math.derivationSteps) ? math.derivationSteps : []
    var fallback = txt(point && point.derivation)
    if (!steps.length && !fallback) return null
    var id = 'tbp-deriv-' + String((point && point.id) || 'p').split('.').join('-')
    var card = el('section', { class: 'tbp-card' })
    var head = el('div', { class: 'tbp-section-head', style: 'margin-top:0' })
    head.appendChild(el('div', { class: 'tbp-block-label', style: 'margin-bottom:0' },
      label('derivationSteps', '定理推导过程') + '（' + (steps.length || 1) + ' ' + label('stepUnit', '步') + '）'))
    head.appendChild(el('button', {
      class: 'tbp-btn', type: 'button', act: 'toggle', 'data-target': id,
      'data-base': 'tbp-deriv', 'data-mode': 'block', 'aria-expanded': 'false'
    }, label('expand', '展开')))
    card.appendChild(head)
    var body = el('div', { class: 'tbp-deriv tbp-hidden', id: id, 'data-hidden': '1' })
    if (steps.length) {
      var ol = el('ol', { class: 'tbp-steps' })
      for (var i = 0; i < steps.length; i += 1) {
        var stepLine = txt(steps[i] && steps[i].line)
        var stepWhy = txt(steps[i] && steps[i].why)
        var li = el('li', { class: 'tbp-step' + (stepLine ? ' tbp-step-calc' : '') })
        li.appendChild(el('span', { class: 'tbp-step-no' }, String(i + 1)))
        var bd = el('div', { class: 'tbp-step-body' })
        if (txt(steps[i] && steps[i].step)) bd.appendChild(el('div', { class: 'tbp-step-title' }, txt(steps[i].step)))
        if (stepLine) bd.appendChild(el('pre', { class: 'tbp-step-line' }, stepLine))
        if (txt(steps[i] && steps[i].detail)) bd.appendChild(el('p', { class: 'tbp-step-detail' }, txt(steps[i].detail)))
        if (stepWhy) bd.appendChild(el('p', { class: 'tbp-step-why' }, stepWhy))
        li.appendChild(bd)
        ol.appendChild(li)
      }
      body.appendChild(ol)
    } else {
      body.appendChild(el('p', { class: 'tbp-p' }, fallback))
    }
    card.appendChild(body)
    return card
  }
  function webDigest(digest, section, currentId) {
    var wrap = el('div', { class: 'tbp-digest' })
    if (txt(digest.oneLine)) wrap.appendChild(el('p', { class: 'tbp-digest-one' }, txt(digest.oneLine)))
    var listSec = function (lb, items, ordered) {
      var arr = Array.isArray(items) ? items : []
      if (!arr.length) return null
      var sec = el('div', { class: 'tbp-digest-sec' })
      sec.appendChild(el('div', { class: 'tbp-digest-label' }, lb))
      var list = el(ordered ? 'ol' : 'ul', { class: ordered ? 'tbp-digest-chain' : 'tbp-digest-list' })
      for (var i = 0; i < arr.length; i += 1) list.appendChild(el('li', {}, txt(arr[i])))
      sec.appendChild(list)
      return sec
    }
    var core = listSec(label('digestCore', '核心结论'), digest.corePoints, false); if (core) wrap.appendChild(core)
    var chain = listSec(label('digestChain', '讲解结构'), digest.argumentChain, true); if (chain) wrap.appendChild(chain)
    var map = Array.isArray(digest.pointMap) ? digest.pointMap : []
    if (map.length) {
      var mapSec = el('div', { class: 'tbp-digest-sec' })
      mapSec.appendChild(el('div', { class: 'tbp-digest-label' }, label('digestMap', '知识点地图')))
      var mapWrap = el('div', { class: 'tbp-dmap' })
      for (var m = 0; m < map.length; m += 1) {
        var row = map[m] || {}
        var isCur = currentId && String(row.id) === String(currentId)
        var rowEl = el('div', { class: 'tbp-dmap-row' + (isCur ? ' tbp-dmap-row-cur' : '') })
        rowEl.appendChild(el('span', { class: 'tbp-dmap-id' }, txt(row.id) || '·'))
        var main = el('div', { class: 'tbp-dmap-main' })
        var titleEl = el('span', { class: 'tbp-dmap-title' })
        if (row.important === true) titleEl.appendChild(el('span', { class: 'tbp-star' }, '★ '))
        titleEl.appendChild(el('span', {}, txt(row.title)))
        main.appendChild(titleEl)
        if (txt(row.role)) main.appendChild(el('span', { class: 'tbp-dmap-role' }, txt(row.role)))
        if (txt(row.keyIdea)) main.appendChild(el('span', { class: 'tbp-dmap-key' }, txt(row.keyIdea)))
        rowEl.appendChild(main)
        mapWrap.appendChild(rowEl)
      }
      mapSec.appendChild(mapWrap)
      wrap.appendChild(mapSec)
    }
    var take = listSec(label('digestTakeaways', '复习要点'), digest.takeaways, false); if (take) wrap.appendChild(take)
    var pit = listSec(label('digestPitfalls', '易错点'), digest.pitfalls, false); if (pit) wrap.appendChild(pit)
    var conn = digest.connections && typeof digest.connections === 'object' ? digest.connections : null
    if (conn && (txt(conn.before) || txt(conn.after))) {
      var cSec = el('div', { class: 'tbp-digest-sec' })
      cSec.appendChild(el('div', { class: 'tbp-digest-label' }, label('digestConnections', '前后联系')))
      var cw = el('div', { class: 'tbp-connect' })
      if (txt(conn.before)) {
        var r1 = el('div', { class: 'tbp-connect-row' })
        r1.appendChild(el('span', { class: 'tbp-connect-tag' }, label('digestBefore', '承接')))
        r1.appendChild(el('span', {}, txt(conn.before)))
        cw.appendChild(r1)
      }
      if (txt(conn.after)) {
        var r2 = el('div', { class: 'tbp-connect-row' })
        r2.appendChild(el('span', { class: 'tbp-connect-tag' }, label('digestAfter', '铺垫')))
        r2.appendChild(el('span', {}, txt(conn.after)))
        cw.appendChild(r2)
      }
      cSec.appendChild(cw)
      wrap.appendChild(cSec)
    }
    return wrap
  }
  function exampleItem(section, example, index) {
    var item = el('div', { class: 'tbp-example' })
    var head = el('div', { class: 'tbp-example-head' })
    head.appendChild(el('span', { class: 'tbp-example-no' }, '#' + (index + 1)))
    if (txt(example.type)) head.appendChild(chip(txt(example.type), toneForType(txt(example.type))))
    if (txt(example.source)) head.appendChild(chip(txt(example.source), ''))
    item.appendChild(head)
    item.appendChild(el('p', { class: 'tbp-example-q' }, txt(example.question) || '—'))
    if (txt(example.answer)) {
      var answerId = 'tbp-ans-' + String(section.id || 's').split('.').join('-') + '-' + index
      item.appendChild(el('button', {
        class: 'tbp-btn', type: 'button', act: 'toggle', 'data-target': answerId,
        'data-base': 'tbp-answer', 'data-mode': 'answer', 'aria-expanded': 'false'
      }, label('showAnswer', '显示答案')))
      var answer = el('div', { class: 'tbp-answer tbp-hidden', id: answerId, 'data-hidden': '1' })
      answer.appendChild(el('div', { class: 'tbp-answer-label' }, label('answer', '解答')))
      answer.appendChild(el('p', { text: txt(example.answer) }))
      item.appendChild(answer)
    }
    if (txt(example.note)) item.appendChild(el('p', { class: 'tbp-note' }, label('note', '提示') + '：' + txt(example.note)))
    return item
  }
  function toneForType(type) {
    if (String(type).indexOf('易错') >= 0) return 'warn'
    if (String(type).indexOf('计算') >= 0 || String(type).indexOf('推导') >= 0 || String(type).indexOf('证明') >= 0) return 'brand'
    if (String(type).indexOf('综合') >= 0 || String(type).indexOf('设计') >= 0 || String(type).indexOf('工程') >= 0) return 'ok'
    return ''
  }
  function examplesCard(section, examples, collapsed) {
    var card = el('section', { class: 'tbp-card' })
    var head = el('div', { class: 'tbp-section-head' })
    head.appendChild(el('p', { class: 'tbp-eyebrow' }, label('sectionExamples', '本节典型例题') + '（' + examples.length + ' ' + label('exampleUnit', '道') + '）'))
    var bodyId = 'tbp-examples-' + String(section.id || 's').split('.').join('-')
    var body = el('div', { class: collapsed ? 'tbp-hidden' : '' })
    if (collapsed) {
      body.id = bodyId
      body.setAttribute('data-hidden', '1')
      head.appendChild(el('button', {
        class: 'tbp-btn', type: 'button', act: 'toggle', 'data-target': bodyId,
        'data-base': '', 'data-mode': 'expand', 'aria-expanded': 'false'
      }, label('expand', '展开')))
    }
    card.appendChild(head)
    for (var i = 0; i < examples.length; i += 1) body.appendChild(exampleItem(section, examples[i], i))
    card.appendChild(body)
    return card
  }
  function pointCard(chapter, section, point) {
    var card = el('button', { class: 'tbp-card tbp-click', type: 'button', act: 'point', 'data-id': txt(point.id) })
    card.appendChild(el('div', { class: 'tbp-card-top' }, [
      num(txt(point.id)),
      el('div', { class: 'tbp-card-main' }, [
        el('div', { class: 'tbp-card-title' }, [star(point.important === true, true), txt(point.title) || label('point', '知识点')]),
        txt(point.solves) ? el('p', { class: 'tbp-p' }, txt(point.solves)) : null
      ])
    ]))
    var prerequisites = chipsBlock(label('prerequisites', '前置知识'), point.prerequisites)
    if (prerequisites) card.appendChild(prerequisites)
    card.appendChild(el('div', { class: 'tbp-card-foot' }, [
      el('span', {}, txt(point.formula) ? label('formula', '公式 / 定理') : ''),
      el('span', { class: 'tbp-arrow', 'aria-hidden': 'true' }, '→')
    ]))
    return card
  }
  function bookView() {
    var nodes = []
    var overview = el('section', { class: 'tbp-card' })
    overview.appendChild(el('p', { class: 'tbp-eyebrow' }, label('overview', '全书总纲')))
    overview.appendChild(el('h1', { class: 'tbp-h1' }, txt(book.title) || label('book', '教材')))
    if (txt(book.subtitle)) overview.appendChild(el('p', { class: 'tbp-subtitle' }, txt(book.subtitle)))
    var tags = chips(book.tags)
    if (tags.length) overview.appendChild(el('div', { class: 'tbp-chipline' }, tags))
    overview.appendChild(el('div', { class: 'tbp-detail-blocks' }, [
      block(label('goal', '全书总目标'), book.overview && book.overview.goal, 'brand'),
      block(label('pain', '原始痛点'), book.overview && book.overview.pain, 'gap'),
      block(label('mainline', '迭代主线'), book.overview && book.overview.mainline, ''),
      block(label('analogy', '生活类比'), book.overview && book.overview.analogy, 'brand'),
      chainBlock(label('chain', '缺陷 → 修复 链路'), book.overview && book.overview.chain)
    ]))
    nodes.push(overview)
    nodes.push(el('div', { class: 'tbp-section-head' }, [
      el('h2', { class: 'tbp-h2' }, label('chaptersTitle', '章节地图')),
      el('span', { class: 'tbp-stats' }, statsLine())
    ]))
    var grid = el('div', { class: 'tbp-grid' })
    for (var i = 0; i < chapters.length; i += 1) grid.appendChild(chapterCard(chapters[i]))
    nodes.push(grid)
    nodes.push(el('p', { class: 'tbp-footer' }, label('footer', '教材知识框架 · 问题驱动 · 迭代链路')))
    return el('div', { class: 'tbp-view' }, nodes)
  }
  function chapterView(chapter) {
    var nodes = []
    nodes.push(crumb([
      { text: txt(book.title) || label('book', '教材'), hash: '#/' },
      { text: chapterLabel(chapter) }
    ]))
    var head = el('section', { class: 'tbp-card' })
    head.appendChild(el('div', { class: 'tbp-card-top' }, [
      num(txt(chapter.number) || txt(chapter.id)),
      el('div', { class: 'tbp-card-main' }, [
        el('p', { class: 'tbp-eyebrow' }, label('chapter', '章')),
        el('h2', { class: 'tbp-h2' }, chapterLabel(chapter)),
        chipsBlock(label('requires', '前置依赖'), chapter.requires)
      ])
    ]))
    head.appendChild(el('div', { class: 'tbp-detail-blocks' }, [
      block(label('solves', '解决'), chapter.solves, 'brand'),
      block(label('gain', '获得能力'), chapter.gain, 'gain'),
      block(label('gap', '仍存短板') + ' → ' + label('nextChapter', '下一章动机'), chapter.remainingGap, 'gap'),
      block(label('analogy', '生活类比'), chapter.analogy, 'brand'),
      chainBlock(label('chain', '缺陷 → 修复 链路'), chapter.chain)
    ]))
    nodes.push(head)
    var sections = chapterSections(chapter)
    nodes.push(el('div', { class: 'tbp-section-head' }, [
      el('h3', { class: 'tbp-h3' }, label('sections', '节')),
      el('span', { class: 'tbp-stats' }, count(sections.length, label('sections', '节')) + ' · ' + count(chapterPointCount(chapter), label('points', '个知识点')) + ' · ' + count(chapterImportantCount(chapter), label('importantUnit', '重点')))
    ]))
    var grid = el('div', { class: 'tbp-grid' })
    for (var i = 0; i < sections.length; i += 1) grid.appendChild(sectionCard(chapter, sections[i]))
    if (sections.length) nodes.push(grid)
    else nodes.push(el('div', { class: 'tbp-empty' }, label('noChapter', '该章内容尚未生成')))
    nodes.push(pagerBack())
    return el('div', { class: 'tbp-view' }, nodes)
  }
  function sectionView(chapter, section) {
    var nodes = []
    nodes.push(crumb([
      { text: txt(book.title) || label('book', '教材'), hash: '#/' },
      { text: chapterLabel(chapter), hash: hashOf({ type: 'chapter', chapterId: chapter.id }) },
      { text: (txt(section.id) ? txt(section.id) + ' ' : '') + txt(section.title) }
    ]))
    var head = el('section', { class: 'tbp-card' })
    head.appendChild(el('div', { class: 'tbp-card-top' }, [
      num(txt(section.id)),
      el('div', { class: 'tbp-card-main' }, [
        el('p', { class: 'tbp-eyebrow' }, label('section', '节')),
        el('h2', { class: 'tbp-h2' }, (txt(section.id) ? txt(section.id) + ' ' : '') + (txt(section.title) || label('section', '节'))),
        txt(section.subProblem) ? el('p', { class: 'tbp-p' }, txt(section.subProblem)) : null
      ])
    ]))
    head.appendChild(el('div', { class: 'tbp-detail-blocks' }, [
      chipsBlock(label('requires', '前置依赖'), section.requires),
      block(label('limitation', '遗留不足'), section.remaining, 'gap'),
      block(label('analogy', '生活类比'), section.analogy, 'brand')
    ]))
    nodes.push(head)
    nodes.push(summaryCard(section, ''))
    var examples = Array.isArray(section.examples) ? section.examples : []
    if (examples.length) nodes.push(examplesCard(section, examples, false))
    var points = Array.isArray(section.points) ? section.points : []
    nodes.push(el('div', { class: 'tbp-section-head' }, [
      el('h3', { class: 'tbp-h3' }, label('point', '知识点')),
      el('span', { class: 'tbp-stats' }, count(points.length, label('points', '个知识点')) + ' · ' + count(importantIn(points), label('importantUnit', '重点')))
    ]))
    var grid = el('div', { class: 'tbp-grid' })
    for (var i = 0; i < points.length; i += 1) grid.appendChild(pointCard(chapter, section, points[i]))
    if (points.length) nodes.push(grid)
    else nodes.push(el('div', { class: 'tbp-empty' }, label('noPoints', '该节暂无知识点')))
    nodes.push(pagerBack())
    return el('div', { class: 'tbp-view' }, nodes)
  }
  function pointView(chapter, section, point) {
    var nodes = []
    nodes.push(crumb([
      { text: txt(book.title) || label('book', '教材'), hash: '#/' },
      { text: chapterLabel(chapter), hash: hashOf({ type: 'chapter', chapterId: chapter.id }) },
      { text: (txt(section.id) ? txt(section.id) + ' ' : '') + txt(section.title), hash: hashOf({ type: 'section', chapterId: chapter.id, sectionId: section.id }) },
      { text: txt(point.title) }
    ]))
    nodes.push(el('div', { class: 'tbp-detail-head' }, [
      num(txt(point.id)),
      el('div', { class: 'tbp-detail-main' }, [
        el('div', { class: 'tbp-title-row' }, [
          el('h1', { class: 'tbp-detail-title' }, txt(point.title) || label('point', '知识点')),
          star(point.important === true, true)
        ]),
        el('div', { class: 'tbp-detail-sub' }, (txt(section.id) ? txt(section.id) + ' ' : '') + txt(section.title))
      ])
    ]))
    nodes.push(el('div', { class: 'tbp-hl' }, [
      el('div', { class: 'tbp-hl-label' }, label('itSolves', '它要解决的问题')),
      el('p', { class: 'tbp-hl-text' }, txt(point.solves) || '—')
    ]))
    var blocks = []
    blocks.push(block(label('meaning', '含义'), point.meaning, ''))
    blocks.push(block(label('detail', '详细讲解'), point.detail, ''))
    blocks.push(listBlock(label('keyPoints', '学习要点'), point.keyPoints))
    blocks.push(block(label('analogy', '生活类比'), point.analogy, 'brand'))
    blocks.push(webFormulaBlock(point))
    blocks.push(webDerivationBlock(point))
    blocks.push(block(label('application', '应用'), point.application, ''))
    blocks.push(block(label('mistakes', '易错辨析'), point.mistakes, 'gap'))
    blocks.push(block(label('examTips', '考试 / 应用提示'), point.examTips, 'gain'))
    var example = point.example || {}
    if (txt(example.question)) {
      var exampleWrap = el('div', { class: 'tbp-block' })
      exampleWrap.appendChild(el('div', { class: 'tbp-block-label' }, label('example', '例题')))
      exampleWrap.appendChild(el('p', { class: 'tbp-example-q', text: txt(example.question) }))
      if (txt(example.answer)) {
        var answerId = 'tbp-pt-' + String(point.id || 'p').split('.').join('-')
        exampleWrap.appendChild(el('button', {
          class: 'tbp-btn', type: 'button', act: 'toggle', 'data-target': answerId,
          'data-base': 'tbp-answer', 'data-mode': 'answer', 'aria-expanded': 'false'
        }, label('showAnswer', '显示答案')))
        var answer = el('div', { class: 'tbp-answer tbp-hidden', id: answerId, 'data-hidden': '1' })
        answer.appendChild(el('div', { class: 'tbp-answer-label' }, label('answer', '解答')))
        answer.appendChild(el('p', { text: txt(example.answer) }))
        exampleWrap.appendChild(answer)
      }
      blocks.push(exampleWrap)
    }
    var examples = Array.isArray(section.examples) ? section.examples : []
    if (examples.length) blocks.push(examplesCard(section, examples, true))
    blocks.push(summaryCard(section, txt(point.id)))
    blocks.push(chipsBlock(label('prerequisites', '前置知识'), point.prerequisites))
    blocks.push(block(label('limitation', '遗留不足'), point.limitation, 'gap'))
    blocks.push(block(label('nextLink', '下一环'), point.next, 'brand'))
    nodes.push(el('div', { class: 'tbp-detail-blocks' }, blocks))
    var points = Array.isArray(section.points) ? section.points : []
    var index = pointIndex(section, point.id)
    var prev = index > 0 ? points[index - 1] : null
    var next = index >= 0 && index < points.length - 1 ? points[index + 1] : null
    var pager = el('div', { class: 'tbp-pager' })
    if (prev) pager.appendChild(el('button', { class: 'tbp-btn', type: 'button', act: 'go', 'data-hash': hashOf({ type: 'point', chapterId: chapter.id, sectionId: section.id, pointId: prev.id }) }, '← ' + label('prev', '上一环') + ' ' + txt(prev.id)))
    else pager.appendChild(el('span', {}))
    pager.appendChild(el('span', { class: 'tbp-pager-hint' }, label('escHint', '按 Esc 返回上一层')))
    if (next) pager.appendChild(el('button', { class: 'tbp-btn', type: 'button', act: 'go', 'data-hash': hashOf({ type: 'point', chapterId: chapter.id, sectionId: section.id, pointId: next.id }) }, label('next', '下一环') + ' ' + txt(next.id) + ' →'))
    else pager.appendChild(el('span', {}))
    nodes.push(pager)
    return el('div', { class: 'tbp-view' }, nodes)
  }
  function renderView() {
    if (view.type === 'chapter') {
      var chapterOne = findChapter(view.chapterId)
      if (chapterOne) return chapterView(chapterOne)
    }
    if (view.type === 'section' || view.type === 'point') {
      var chapterTwo = findChapter(view.chapterId)
      var sectionOne = findSection(chapterTwo, view.sectionId)
      if (chapterTwo && sectionOne) {
        if (view.type === 'section') return sectionView(chapterTwo, sectionOne)
        var pointOne = findPoint(sectionOne, view.pointId)
        if (pointOne) return pointView(chapterTwo, sectionOne, pointOne)
        return sectionView(chapterTwo, sectionOne)
      }
    }
    return bookView()
  }
  function render() {
    root.textContent = ''
    root.appendChild(topbar())
    var shell = el('div', { class: 'tbp-shell' })
    shell.appendChild(el('div', { class: 'tbp-wrap' }, renderView()))
    root.appendChild(shell)
    if (typeof window.scrollTo === 'function') {
      try { window.scrollTo(0, 0) } catch (error) { /* 忽略 */ }
    }
  }
  function toggleNode(button) {
    var targetId = button.getAttribute('data-target')
    var target = targetId ? document.getElementById(targetId) : null
    if (!target) return
    var hidden = target.getAttribute('data-hidden') === '1'
    var base = button.getAttribute('data-base')
    if (base === null || base === undefined) base = 'tbp-answer'
    target.className = hidden ? base : base + ' tbp-hidden'
    target.setAttribute('data-hidden', hidden ? '0' : '1')
    var mode = button.getAttribute('data-mode')
    if (mode === 'expand' || mode === 'block') button.textContent = hidden ? label('collapse', '收起') : label('expand', '展开')
    else button.textContent = hidden ? label('hideAnswer', '收起答案') : label('showAnswer', '显示答案')
    button.setAttribute('aria-expanded', hidden ? 'true' : 'false')
  }
  function handleClick(event) {
    var node = event && event.target ? event.target : null
    while (node && node !== root && !(node.getAttribute && node.getAttribute('data-act'))) node = node.parentNode
    if (!node || !node.getAttribute || node === root) return
    var act = node.getAttribute('data-act')
    if (!act) return
    if (event && typeof event.preventDefault === 'function') event.preventDefault()
    if (act === 'chapter') navigate({ type: 'chapter', chapterId: node.getAttribute('data-id') })
    else if (act === 'section') navigate({ type: 'section', chapterId: view.chapterId, sectionId: node.getAttribute('data-id') })
    else if (act === 'point') navigate({ type: 'point', chapterId: view.chapterId, sectionId: view.sectionId, pointId: node.getAttribute('data-id') })
    else if (act === 'back') goUp()
    else if (act === 'home') navigate({ type: 'book' })
    else if (act === 'go') navigate(parseHash(node.getAttribute('data-hash')))
    else if (act === 'toggle') toggleNode(node)
  }
  view = parseHash(currentHash())
  root.addEventListener('click', handleClick)
  window.addEventListener('hashchange', function () { view = parseHash(currentHash()); render() })
  document.addEventListener('keydown', function (event) {
    if (!event || (event.key !== 'Escape' && event.key !== 'Esc')) return
    goUp()
  })
  render()
  window.__TBP_APP_READY__ = true
})();
`

    function buildWebExport(book, chapters) {
      const data = buildExportData(book, chapters)
      const title = t('title') + ' · ' + (data.book.title || t('book'))
      return [
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>' + escapeHtml(title) + '</title>',
        '<style>' + WEB_CSS + '</style>',
        '</head>',
        '<body class="tbp-body">',
        '<noscript><p class="tbp-noscript">' + escapeHtml(t('noScriptHint')) + '</p></noscript>',
        '<div id="tbp-root" class="tbp-root"><div class="tbp-empty">' + escapeHtml(t('loading')) + '</div></div>',
        '<script>window.__TBP_DATA__ = ' + exportJsonSafe(data) + ';</script>',
        '<script>' + WEB_JS + '</script>',
        '</body>',
        '</html>',
      ].join('\n')
    }

    function buildExportDocument(book, chapters, mode) {
      /* 网页版：自包含交互式知识地图；Word：静态完整文档（答案直接可见、无脚本） */
      if (mode !== 'word') return buildWebExport(book, chapters)
      const title = t('title') + ' · ' + (asText(book.title) || t('book'))
      const head = [
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">',
        '<meta name="ProgId" content="Word.Document">',
        '<title>' + escapeHtml(title) + '</title>',
        '<style>' + EXPORT_CSS + '</style>',
        '</head>',
        '<body class="txp-body">',
      ]
      return head.join('\n') + '\n' + buildExportBody(book, chapters) + '\n</body>\n</html>'
    }

    function downloadBlob(filename, content, mime) {
      try {
        if (typeof document === 'undefined' || !document.createElement) return false
        if (typeof Blob === 'undefined' || !Blob) return false
        if (typeof URL === 'undefined' || !URL || typeof URL.createObjectURL !== 'function') return false
        const blob = new Blob([content], { type: mime })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        anchor.rel = 'noopener'
        if (anchor.style) anchor.style.display = 'none'
        const host = document.documentElement
        if (host && typeof host.appendChild === 'function') host.appendChild(anchor)
        if (typeof anchor.click === 'function') anchor.click()
        if (host && typeof host.removeChild === 'function' && anchor.parentNode === host) host.removeChild(anchor)
        setTimeout(function () {
          try { if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url) } catch (error) { /* noop */ }
        }, 4000)
        return true
      } catch (error) {
        console.error('[textbook-parser] export download failed', error)
        return false
      }
    }

    function exportFilename(book, extension) {
      const safe = (asText(book && book.title) || t('book')).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)
      return '教材知识框架-' + safe + '.' + extension
    }

    function downloadExport(book, html, kind) {
      const word = kind === 'word'
      return downloadBlob(exportFilename(book, word ? 'doc' : 'html'), html, word ? 'application/msword' : 'text/html;charset=utf-8')
    }

    function openPrintWindow(html) {
      try {
        if (typeof window === 'undefined' || typeof window.open !== 'function') return false
        const target = window.open('', '_blank')
        if (!target || !target.document) return false
        target.document.open()
        target.document.write(html)
        target.document.close()
        setTimeout(function () {
          try {
            if (typeof target.focus === 'function') target.focus()
            if (typeof target.print === 'function') target.print()
          } catch (error) { /* 用户可在打印对话框里手动操作 */ }
        }, 300)
        return true
      } catch (error) {
        return false
      }
    }

    /* ───────────────────────── 主面板：状态机 + 取数 + 视图路由 ───────────────────────── */
    function TextbookPanel() {
      const [books, setBooks] = useState([])
      const [bookId, setBookId] = useState('')
      const [book, setBook] = useState(null)
      const [chapter, setChapter] = useState(null)
      const [view, setView] = useState({ type: 'book' })
      const [loading, setLoading] = useState('books')
      const [error, setError] = useState(null)
      const [booted, setBooted] = useState(false)
      const [menuOpen, setMenuOpen] = useState(false)
      const [exporting, setExporting] = useState(null)
      const [progress, setProgress] = useState('')
      const [toast, setToast] = useState(null)
      const cacheRef = useRef({})
      const tokenRef = useRef(0)
      const shellRef = useRef(null)
      const viewRef = useRef(view)
      const bookIdRef = useRef('')
      viewRef.current = view
      bookIdRef.current = bookId

      const fetchBooks = useCallback(async function (quiet) {
        if (!quiet) { setLoading('books'); setError(null) }
        try {
          const data = await apiGet('dsh-textbook-parser/api/books')
          const list = data && Array.isArray(data.books) ? data.books.filter((entry) => entry && asText(entry.id)) : []
          setBooks(list)
          return list
        } catch (err) {
          if (!quiet) { setBooks([]); setError(errText(err)) }
          return []
        } finally { if (!quiet) setLoading(null) }
      }, [])

      const fetchBook = useCallback(async function (id, quiet) {
        const target = asText(id)
        if (!target) { setBook(null); setLoading(null); return null }
        if (!quiet) { setLoading('book'); setError(null) }
        try {
          const data = await apiGet('dsh-textbook-parser/api/books/' + encodeURIComponent(target))
          const next = data && data.book && typeof data.book === 'object' ? data.book : null
          if (next && !Array.isArray(next.chapters)) next.chapters = []
          cacheRef.current = {}
          setBook(next); setChapter(null); setBookId(target); lsSet('tbp:lastBook', target)
          return next
        } catch (err) {
          setBook(null); setChapter(null)
          if (!quiet) setError(errText(err))
          return null
        } finally { if (!quiet) setLoading(null) }
      }, [])

      const fetchChapter = useCallback(async function (chapterId, quiet) {
        const target = asText(chapterId)
        const activeBook = asText(bookIdRef.current)
        if (!target || !activeBook) return null
        const token = tokenRef.current + 1
        tokenRef.current = token
        if (!quiet) { setLoading('chapter'); setError(null) }
        try {
          const data = await apiGet('dsh-textbook-parser/api/books/' + encodeURIComponent(activeBook) + '/chapters/' + encodeURIComponent(target))
          if (token !== tokenRef.current) return null
          const next = data && data.chapter && typeof data.chapter === 'object' ? data.chapter : null
          if (next) { cacheRef.current[target] = next; setChapter(next); setError(null) }
          else { setChapter(null); setError(t('noChapter')) }
          return next
        } catch (err) {
          if (token !== tokenRef.current) return null
          setChapter(null); setError(t('noChapter') + ' · ' + errText(err))
          return null
        } finally { if (!quiet && token === tokenRef.current) setLoading(null) }
      }, [])

      const refreshAll = useCallback(async function () {
        const current = viewRef.current || { type: 'book' }
        const previousBook = asText(bookIdRef.current)
        const list = await fetchBooks(false)
        const target = list.some((entry) => asText(entry.id) === previousBook) ? previousBook : (list[0] ? asText(list[0].id) : '')
        if (!target) {
          setLoading(null); setBook(null); setChapter(null); setView({ type: 'book' })
          return
        }
        const nextBook = await fetchBook(target, false)
        if (!nextBook) return
        if (asText(current.chapterId)) await fetchChapter(current.chapterId, false)
        setLoading(null)
      }, [fetchBooks, fetchBook, fetchChapter])

      useEffect(function () {
        let cancelled = false
        ;(async function () {
          const list = await fetchBooks(false)
          if (cancelled) return
          if (!list.length) { setBooted(true); return }
          const remembered = lsGet('tbp:lastBook')
          const picked = list.some((entry) => asText(entry.id) === remembered) ? remembered : asText(list[0].id)
          if (picked) { bookIdRef.current = picked; await fetchBook(picked, false) }
          if (!cancelled) setBooted(true)
        })()
        return function () { cancelled = true }
      }, [fetchBooks, fetchBook])

      useEffect(function () {
        if (typeof window === 'undefined' || !window.addEventListener) return undefined
        let busy = false
        function onFocus() {
          if (busy) return
          busy = true
          Promise.resolve(fetchBooks(true)).catch(() => {}).then(() => { busy = false })
        }
        window.addEventListener('focus', onFocus)
        return function () { window.removeEventListener('focus', onFocus) }
      }, [fetchBooks])

      useEffect(function () {
        const node = shellRef.current
        if (!node) return
        if (typeof node.scrollTo === 'function') node.scrollTo({ top: 0, behavior: 'auto' })
        else node.scrollTop = 0
      }, [view.type, view.chapterId, view.sectionId, view.pointId])

      useEffect(function () {
        if (!toast) return undefined
        const timer = setTimeout(function () { setToast(null) }, 5000)
        return function () { clearTimeout(timer) }
      }, [toast])

      const selectBook = useCallback(function (event) {
        const target = asText(event && event.target && event.target.value)
        if (!target || target === asText(bookIdRef.current)) return
        bookIdRef.current = target
        setBookId(target); setView({ type: 'book' }); setChapter(null); setError(null)
        fetchBook(target, false)
      }, [fetchBook])

      const openChapter = useCallback(function (chapterId) {
        const target = asText(chapterId)
        if (!target || !asText(bookIdRef.current)) return
        setView({ type: 'chapter', chapterId: target })
        setError(null)
        const cached = cacheRef.current[target]
        if (cached) { setChapter(cached); setLoading(null); return }
        setChapter(null)
        fetchChapter(target, false)
      }, [fetchChapter])

      const openSection = useCallback(function (chapterId, sectionId) {
        setView({ type: 'section', chapterId: asText(chapterId), sectionId: asText(sectionId) })
        setError(null)
      }, [])

      const openPoint = useCallback(function (chapterId, sectionId, pointId) {
        setView({ type: 'point', chapterId: asText(chapterId), sectionId: asText(sectionId), pointId: asText(pointId) })
        setError(null)
      }, [])

      const goBook = useCallback(function () { setView({ type: 'book' }); setError(null) }, [])

      const goBack = useCallback(function () {
        const current = viewRef.current || { type: 'book' }
        if (current.type === 'point') setView({ type: 'section', chapterId: current.chapterId, sectionId: current.sectionId })
        else if (current.type === 'section') setView({ type: 'chapter', chapterId: current.chapterId })
        else setView({ type: 'book' })
        setError(null)
      }, [])

      const flatPoints = useMemo(function () {
        const sections = chapter && Array.isArray(chapter.sections) ? chapter.sections : []
        const out = []
        sections.forEach(function (entry) {
          const points = entry && Array.isArray(entry.points) ? entry.points : []
          points.forEach(function (point) { if (point) out.push({ point: point, section: entry }) })
        })
        return out
      }, [chapter])

      const chapterForView = chapter && (!asText(chapter.id) || asText(chapter.id) === asText(view.chapterId)) ? chapter : null
      let pointIndex = -1
      if (view.type === 'point') {
        for (let index = 0; index < flatPoints.length; index += 1) {
          const entry = flatPoints[index]
          if (asText(entry.point.id) === asText(view.pointId) && asText(entry.section.id) === asText(view.sectionId)) { pointIndex = index; break }
        }
      }
      const currentEntry = pointIndex >= 0 ? flatPoints[pointIndex] : null
      const prevEntry = pointIndex > 0 ? flatPoints[pointIndex - 1] : null
      const nextEntry = pointIndex >= 0 && pointIndex < flatPoints.length - 1 ? flatPoints[pointIndex + 1] : null
      const goEntry = function (entry) {
        if (!entry) return
        setView({ type: 'point', chapterId: asText(view.chapterId), sectionId: asText(entry.section.id), pointId: asText(entry.point.id) })
      }

      const runExport = async function (kind) {
        if (exporting) return
        const currentBook = book
        if (!currentBook) return
        const activeBookId = asText(bookIdRef.current)
        const chapterMetas = Array.isArray(currentBook.chapters)
          ? currentBook.chapters.filter((meta) => meta && asText(meta.id))
          : []
        setMenuOpen(false)
        setExporting(kind)
        setProgress(t('preparingAll'))
        try {
          const collected = {}
          for (let index = 0; index < chapterMetas.length; index += 1) {
            const chapterId = asText(chapterMetas[index].id)
            setProgress(t('preparing') + ' ' + (index + 1) + '/' + chapterMetas.length + ' ' + t('chaptersUnit') + '…')
            const cached = cacheRef.current[chapterId]
            if (cached) { collected[chapterId] = cached; continue }
            try {
              const data = await apiGet('dsh-textbook-parser/api/books/' + encodeURIComponent(activeBookId) + '/chapters/' + encodeURIComponent(chapterId))
              const chapterData = data && data.chapter && typeof data.chapter === 'object' ? data.chapter : null
              if (chapterData) { cacheRef.current[chapterId] = chapterData; collected[chapterId] = chapterData }
            } catch (error) {
              /* 单章缺失不阻断整本导出：继续整理其余章节 */
            }
          }
          const html = buildExportDocument(currentBook, collected, kind === 'word' ? 'word' : 'web')
          if (kind === 'pdf') {
            if (openPrintWindow(html)) setToast({ kind: 'ok', text: t('pdfDone') })
            else {
              downloadExport(currentBook, html, 'html')
              setToast({ kind: 'err', text: t('pdfFallback') })
            }
          } else {
            downloadExport(currentBook, html, kind === 'word' ? 'word' : 'html')
            setToast({ kind: 'ok', text: t('exportOk') })
          }
        } catch (err) {
          setToast({ kind: 'err', text: t('exportFail') + '：' + errText(err) })
        } finally {
          setExporting(null)
          setProgress('')
        }
      }

      const hasBooks = books.length > 0
      let content = null
      if (!hasBooks) {
        if (loading === 'books' && !booted) content = h(Spinner, { label: t('loading') })
        else if (error) content = h(ErrorBox, { message: error, onRetry: refreshAll })
        else content = h(EmptyState, { onRefresh: refreshAll })
      } else if (!book) {
        content = error ? h(ErrorBox, { message: error, onRetry: refreshAll }) : h(Spinner, { label: t('loadingBook') })
      } else if (view.type === 'chapter') {
        content = h(ChapterView, {
          book, chapterId: view.chapterId, chapter: chapterForView, loading: loading === 'chapter', error,
          onRetry: () => openChapter(view.chapterId), onBack: goBook, onOpenSection: openSection,
        })
      } else if (view.type === 'section') {
        content = h(SectionView, {
          book, chapterId: view.chapterId, sectionId: view.sectionId,
          chapter: chapterForView || { sections: [] },
          onBack: () => setView({ type: 'chapter', chapterId: view.chapterId }),
          onOpenPoint: (sectionId, pointId) => openPoint(view.chapterId, sectionId, pointId),
        })
      } else if (view.type === 'point') {
        content = h(PointDetail, {
          point: currentEntry ? currentEntry.point : {},
          section: currentEntry ? currentEntry.section : {},
          chapter: chapterForView || {},
          onBack: goBack,
          onPrev: () => goEntry(prevEntry),
          onNext: () => goEntry(nextEntry),
          hasPrev: !!prevEntry,
          hasNext: !!nextEntry,
          onOpenPoint: (pointId) => openPoint(view.chapterId, view.sectionId, pointId),
        })
      } else {
        content = h(BookView, { book, onOpenChapter: openChapter })
      }

      const panelBody = h('div', { className: 'tbp-root-inner' },
        h('div', { className: 'tbp-topbar' },
          h('div', { className: 'tbp-brand' },
            h('span', { className: 'tbp-brand-mark', 'aria-hidden': true }, h(SidebarIcon, { size: 18, active: true })),
            h('div', { className: 'tbp-headings' },
              h('p', { className: 'tbp-title' }, t('title')),
              h('p', { className: 'tbp-subtitle' }, t('subtitle')))),
          h('div', { className: 'tbp-grow' }),
          progress ? h('span', { className: 'tbp-progress' }, progress) : null,
          hasBooks ? h('select', {
            className: 'tbp-select', value: bookId, onChange: selectBook,
            'aria-label': t('allBooks'), title: t('allBooks'),
          }, books.map((entry) => h('option', { key: asText(entry.id), value: asText(entry.id) },
            asText(entry.title) || asText(entry.id)))) : null,
          h('div', { className: 'tbp-menu-wrap' },
            h('button', {
              type: 'button', className: 'tbp-btn', disabled: !book || !!exporting,
              onClick: () => setMenuOpen((value) => !value),
              'aria-haspopup': 'menu', 'aria-expanded': menuOpen,
              title: t('export'),
            }, exporting ? t('exporting') : t('export')),
            menuOpen && book ? h('div', { className: 'tbp-menu', role: 'menu' },
              h('button', { type: 'button', className: 'tbp-menu-item', role: 'menuitem', onClick: () => runExport('html') }, t('exportHtml')),
              h('button', { type: 'button', className: 'tbp-menu-item', role: 'menuitem', onClick: () => runExport('word') }, t('exportWord')),
              h('button', { type: 'button', className: 'tbp-menu-item', role: 'menuitem', onClick: () => runExport('pdf') }, t('exportPdf')),
              h('div', { className: 'tbp-menu-tip' }, t('exportHint'))) : null),
          h('button', {
            type: 'button', className: 'tbp-btn', onClick: refreshAll, disabled: !!loading,
            title: loading ? t('refreshing') : t('refresh'),
          }, loading ? t('refreshing') : t('refresh'))),
        h('div', { className: 'tbp-shell', ref: shellRef },
          h('div', { className: 'tbp-wrap' }, content)))

      const toastNode = toast
        ? h('div', { className: cs('tbp-toast', toast.kind === 'err' && 'tbp-toast-err'), role: 'status', 'aria-live': 'polite' }, toast.text)
        : null

      return h('div', { className: 'tbp-root' }, h(StyleTags), h(ErrorBoundary, null, panelBody), toastNode)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        /* 槽位注册：冷启动时本模块可能早于 ui-layout / ui-sidebar 声明槽位。
           优先用 slots.inject 等声明后注册；旧版客户端若无 inject 则退回直接注册。 */
        const mountSlot = function (slotName, register, label) {
          try {
            if (ctx.slots && typeof ctx.slots.inject === 'function') {
              ctx.effect(() => ctx.slots.inject(slotName, register), label)
            } else {
              ctx.effect(() => register(), label)
            }
          } catch (e) {
            console.error('[textbook-parser] ' + label + ' failed', e)
          }
        }
        try {
          ctx.effect(() => ctx.locale.register('textbook-parser', { zh: ZHDICT, en: ENDICT }), 'tbp: dict')
          try { setTranslate(ctx.locale.bind('textbook-parser')) } catch (e) {
            console.error('[textbook-parser] locale bind failed', e)
          }
        } catch (e) {
          console.error('[textbook-parser] locale mount failed', e)
        }
        mountSlot('main', () => ctx.slots.register({
          name: 'main', key: 'textbook-parser', locale: 'textbook-parser',
        }, TextbookPanel), 'tbp: main panel')
        mountSlot('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'textbook-parser', order: 20,
          label: () => t('nav'), locale: 'textbook-parser',
        }, SidebarIcon), 'tbp: sidebar icon')
      },
    }
  },
})
