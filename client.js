/**
 * Client half of the git-sentry bundle — 第一期 UI 原型。
 *
 * 形态说明：单文件、零构建。`require` 解析走平台种子表
 * （deepseek-harness/packages/client/web/src/seed.ts），其中可用的 specifier 为：
 *   react / react/jsx-runtime / react-dom / react-dom/client / @deepseek-ai/cordis /
 *   @deepseek-ai/dsh-client-store / @deepseek-ai/dsh-client-ui-slots /
 *   @deepseek-ai/dsh-client-ui-primitives / @deepseek-ai/dsh-client-ui-dockkit
 * 上述模块全部以平台单例注入，因此本文件无需打包步骤，改完刷新页面即可。
 *
 * 落点（见 docs/plan.md §5.1 / §5.2）：
 *   - sidebar.footer.action  侧边栏常驻状态行，可展开逐仓库列表
 *   - main                   主区操作台（左列表右详情）——功能的完整载体
 *   - settings.section       设置页一节
 * 刻意不注册 sidebar.panellist：状态行已承担入口职责，重复入口只会造成困惑。
 * 亦不注册 sidebar.right.pane.tab（需额外注册 tab 类型定义，延期到 P3）。
 *
 * 第一期范围：纯 UI + mock 数据，不进行任何 git 调用。
 * 注意 RK-11：状态行整块消失时，主区页面必须依然完整可用，因此本文件
 * 不把任何功能放在 footer 槽位上，它只是「少切一次页」的便利。
 */
window.__ModuleLoader__.load({
  id: 'dsh-git-sentry',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useMemo } = React
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { Button, Tag, StateDot, Switch, Input } = primitives

    /* ------------------------------------------------------------------ *
     * 1. mock 数据层
     *
     * 第一期不接 git。这里用用户环境里真实的四个仓库名，并刻意让它们
     * 覆盖全部状态分支（干净 / 落后 / 脏 / 冲突 / 远程不可达），
     * 这样一次就能看到所有状态长什么样。
     * ------------------------------------------------------------------ */

    /** 仓库状态枚举 → 展示用文案与语义色。 */
    const STATUS = {
      'up-to-date': { label: '已是最新', dot: 'done', tag: 'success' },
      'behind': { label: '有待拉取', dot: 'warning', tag: 'warning' },
      'dirty': { label: '有未提交改动', dot: 'warning', tag: 'warning' },
      'conflict': { label: '合并冲突', dot: 'error', tag: 'danger' },
      'unreachable': { label: '远程不可达', dot: 'error', tag: 'danger' },
    }

    const MOCK_PROJECTS = [
      {
        id: 'artpass',
        name: 'ArtPass',
        path: '/home/tokamak/dev/repos/ArtPass',
        branch: 'main',
        syncSource: 'origin/main',
        pushTarget: 'origin/main',
        status: 'up-to-date',
        ahead: 0,
        behind: 0,
        autoSync: true,
        lastSync: { at: '2026-10-14 20:41', result: 'up-to-date' },
        incoming: [],
        conflictFiles: [],
        dirtyFiles: [],
      },
      {
        id: 'dogear',
        name: 'DogEar',
        path: '/home/tokamak/dev/repos/DogEar',
        branch: 'main',
        syncSource: 'origin/main',
        pushTarget: 'origin/main',
        status: 'behind',
        ahead: 0,
        behind: 3,
        autoSync: true,
        lastSync: { at: '2026-10-14 20:41', result: 'up-to-date' },
        incoming: [
          { sha: 'a3f91c2', subject: '修正书签排序在空列表下崩溃', author: 'chen', at: '10-14 14:02' },
          { sha: '7b2e804', subject: '补充 README 安装说明', author: 'lin', at: '10-13 22:18' },
          { sha: 'e5d0a17', subject: '移除废弃的 syncLegacy() 调用', author: 'chen', at: '10-13 11:47' },
        ],
        conflictFiles: [],
        dirtyFiles: [],
      },
      {
        id: 'dutybot',
        name: 'dutybot',
        path: '/home/tokamak/dev/repos/dutybot',
        branch: 'server',
        syncSource: 'origin/server',
        pushTarget: 'origin/server',
        status: 'dirty',
        ahead: 2,
        behind: 1,
        autoSync: false,
        lastSync: { at: '2026-10-14 19:55', result: 'skipped', detail: '工作区有未提交改动，本轮跳过' },
        incoming: [
          { sha: '9c14fb0', subject: '值班表接口增加时区参数', author: 'wang', at: '10-14 09:30' },
        ],
        conflictFiles: [],
        dirtyFiles: [
          { path: 'src/roster/dispatch.ts', state: 'M' },
          { path: 'src/roster/format.ts', state: 'M' },
          { path: 'docs/duty-flow.md', state: 'A' },
        ],
      },
      {
        id: 'vibecodingpack',
        name: 'VibeCodingPack',
        path: '/home/tokamak/dev/repos/VibeCodingPack',
        branch: 'main',
        syncSource: 'origin/main',
        pushTarget: 'origin/main',
        status: 'conflict',
        ahead: 0,
        behind: 2,
        autoSync: true,
        lastSync: {
          at: '2026-10-14 20:12',
          result: 'conflict',
          detail: '合并 origin/main 时产生冲突，已中止并回滚',
          conflictFiles: ['package.json', 'src/preset/loader.ts'],
        },
        incoming: [
          { sha: '1f8ab93', subject: '拆分 preset 加载器为独立模块', author: 'zhao', at: '10-14 16:20' },
          { sha: 'b07c4e5', subject: '升级依赖并锁定 pnpm 版本', author: 'zhao', at: '10-14 10:05' },
        ],
        conflictFiles: ['package.json', 'src/preset/loader.ts'],
        dirtyFiles: [],
      },
    ]

    /* ------------------------------------------------------------------ *
     * 2. 共享视图状态（模块级）
     *
     * footer 状态行与 main 面板是两棵独立的 React 树，无法共享 useState。
     * 第一期用模块级订阅实现最小共享：两侧都读同一份状态，任一侧改动
     * 通知另一侧重渲染。真实实现对接到 Host 侧后可替换为 client-store。
     * ------------------------------------------------------------------ */

    const listeners = new Set()
    let state = {
      /** 侧边栏状态行是否展开为逐仓库列表。 */
      expanded: false,
      /** 主区当前选中的仓库 id。 */
      selectedId: MOCK_PROJECTS[0].id,
    }

    function getState() {
      return state
    }

    function setState(patch) {
      state = { ...state, ...patch }
      for (const fn of listeners) fn()
    }

    /** 订阅共享状态；返回取消订阅函数（供 useEffect 使用）。 */
    function subscribe(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    }

    /**
     * 把模块级订阅接进 React。
     * @returns 当前共享状态。
     */
    function useSharedState() {
      const [, force] = useState(0)
      React.useEffect(() => subscribe(() => { force(n => n + 1) }), [])
      return getState()
    }

    /* ------------------------------------------------------------------ *
     * 3. 样式体系
     *
     * 只用 --dsw-alias-* 语义 token，不写死颜色，跟随主题明暗。
     *
     * 这里定义一套纯函数样式（而不是散落的内联字面量），目的是让侧边栏
     * 状态行与宿主的原生行（如「设置」）在**留白、行高、字号、圆角**上
     * 严格对齐：
     *   - 侧边栏行的水平内边距统一由 SIDE_PAD 控制；
     *   - 行高统一由 ROW_H 控制，与宿主行的垂直节奏一致；
     *   - 字号走主题字号 token 而非硬编码 px。
     * 之前用 10px/12px/8px 这类手拍数字，是「与主题不搭」的根因。
     * ------------------------------------------------------------------ */

    /** 语义色 token 速查。 */
    const c = {
      text: 'var(--dsw-alias-label-primary)',
      text2: 'var(--dsw-alias-label-secondary)',
      text3: 'var(--dsw-alias-label-tertiary)',
      caption: 'var(--dsw-alias-label-caption)',
      border: 'var(--dsw-alias-border-l2)',
      borderStrong: 'var(--dsw-alias-border-l3)',
      hover: 'var(--dsw-alias-interactive-bg-hover)',
      hoverSolid: 'var(--dsw-alias-interactive-bg-hover-solid)',
      active: 'var(--dsw-alias-interactive-bg-active)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      brand: 'var(--dsw-alias-brand-primary)',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      /* 状态语义色。sidebar 状态行用它表达「最严重级别」。 */
      ok: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      error: 'var(--dsw-alias-state-error-primary)',
    }

    /** 字号 token —— 与宿主保持一致，不写死 px。 */
    const fs = {
      xxs: 'var(--dsw-font-xxs-12)',
      xs: 'var(--dsw-font-xs-13)',
      s: 'var(--dsw-font-s-14)',
      /* 侧边栏状态行的尺寸：压到最小一级，但不小于 12px。 */
      row: 'var(--dsw-font-xxs-12)',
    }

    /** 侧边栏行几何 —— 所有侧边栏内的行共用同一组数字，保证垂直节奏一致。 */
    const SIDE = {
      /** 水平内边距。宿主侧边栏行的统一留白。 */
      pad: 8,
      /** 行最小高度，与宿主 `设置` 行对齐。 */
      rowH: 32,
      /** 行内圆角。 */
      radius: 6,
      /** 图标与文字之间的间距。 */
      gap: 8,
    }

    /** 状态点的像素尺寸（侧边栏与列表共用）。 */
    const DOT = 8
    /** 语义圆点的着色映射。 */
    const DOT_COLOR = { done: c.ok, warning: c.warn, error: c.error }

    /** 汇总所有仓库的状态计数，供侧边栏一行文案使用。 */
    function summarize(projects) {
      const needs = projects.filter(p => p.status === 'behind' || p.status === 'conflict' || p.status === 'unreachable')
      const conflicts = projects.filter(p => p.status === 'conflict')
      const unreachable = projects.filter(p => p.status === 'unreachable')
      return { total: projects.length, needs: needs.length, conflicts: conflicts.length, unreachable: unreachable.length }
    }

    /** 按状态优先级取整组的最严重级别，用于侧边栏圆点。 */
    function worstDot(projects) {
      if (projects.some(p => p.status === 'conflict' || p.status === 'unreachable')) return 'error'
      if (projects.some(p => p.status === 'behind' || p.status === 'dirty')) return 'warning'
      return 'done'
    }

    /* ------------------------------------------------------------------ *
     * 4. 侧边栏状态行（slot: sidebar.footer.action）
     *
     * owner props 只有 { wide }。窄态（56px 轨道）退化为一个图标 + 角标。
     *
     * 视觉要点（对齐宿主原生行的原因）：
     *   - 整块用「卡片式」容器包住，展开的列表落在同一个容器里，
     *     而不是散在空隙中——这是此前「元素缺失」的主因；
     *   - 每一行都用 SIDE.rowH 固定高度，与宿主行等高；
     *   - 分隔线只在容器顶部画一条，内部行之间不画线。
     * ------------------------------------------------------------------ */

    /**
     * 一条侧边栏行的基础样式（按钮形态）。
     * @param active - 是否处于选中/展开态。
     * @returns 可直接展开到 style 的样式对象。
     */
    function sideRowStyle(active) {
      return {
        display: 'flex',
        alignItems: 'center',
        gap: SIDE.gap,
        width: '100%',
        minHeight: SIDE.rowH,
        boxSizing: 'border-box',
        padding: `0 ${SIDE.pad}px`,
        background: active ? c.active : 'transparent',
        border: 'none',
        borderRadius: SIDE.radius,
        cursor: 'pointer',
        textAlign: 'left',
        color: c.text2,
        font: 'inherit',
      }
    }

    /** 一个语义状态点。自带 title 便于悬停理解颜色含义。 */
    function Dot({ dot, size = DOT, title }) {
      return h('span', {
        'aria-hidden': true,
        title,
        style: {
          flexShrink: 0, width: size, height: size, borderRadius: '50%',
          background: DOT_COLOR[dot] || c.text3,
        },
      })
    }

    /**
     * 状态行上的计数徽标。
     *
     * 用「着色数字 + 语义底色」替代单纯的小圆点：圆点只能表达级别，
     * 徽标能同时表达「有几个」——这是此前状态点「语义不足」的修正。
     */
    function CountBadge({ count, dot, title }) {
      return h('span', {
        title,
        style: {
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 18, padding: '0 6px', borderRadius: 9,
          background: c.layer2, fontSize: fs.xxs, fontWeight: 500,
          color: DOT_COLOR[dot] || c.text3, fontVariantNumeric: 'tabular-nums',
        },
      }, count)
    }

    /**
     * 渲染侧边栏底部状态行。
     * @param props.wide - 侧边栏是否处于展开态（false = 56px 轨道）。
     */
    function GitSentryStatusRow({ wide }) {
      const s = useSharedState()
      const projects = MOCK_PROJECTS
      const sum = useMemo(() => summarize(projects), [projects])
      const dot = worstDot(projects)
      const expanded = s.expanded
      /** 空状态：一个仓库都没有导入时，不显示一个有误导性的「0 个仓库」。 */
      const empty = projects.length === 0

      /** 切到主区并选中某个仓库（点计数徽标或列表项都用它）。 */
      const openProject = (id) => { setState({ selectedId: id }) }

      // 窄态：只画图标 + 有事时的角标，点击展开/收起。
      if (!wide) {
        return h('div', { style: { padding: `0 ${SIDE.pad}px` } },
          h('button', {
            type: 'button',
            title: empty ? 'git-sentry：尚未导入仓库'
              : sum.needs > 0 ? `git-sentry：${sum.needs} 个仓库需要处理` : 'git-sentry：全部最新',
            'aria-label': 'Git 仓库状态',
            'aria-expanded': expanded,
            onClick: () => { setState({ expanded: !expanded }) },
            style: {
              ...sideRowStyle(expanded),
              position: 'relative',
              justifyContent: 'center',
              minHeight: SIDE.rowH,
              padding: 0,
            },
          },
            h(GitIcon, { size: 18 }),
            sum.needs > 0 && h('span', {
              'aria-hidden': true,
              style: {
                position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%',
                background: DOT_COLOR[dot],
              },
            }),
          ),
        )
      }

      // 宽态：一行汇总 + 可展开的逐仓库列表，共用同一个容器。
      return h('div', {
        style: {
          margin: `0 ${SIDE.pad}px ${SIDE.pad}px`,
          borderTop: `0.5px solid ${c.border}`,
          paddingTop: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        },
      },
        // 汇总行。左侧图标 + 文案，右侧「待处理」徽标 + 展开箭头。
        h('button', {
          type: 'button',
          'aria-expanded': expanded,
          title: empty ? '尚未导入仓库' : '点击展开各仓库状态',
          onClick: () => { setState({ expanded: !expanded }) },
          style: sideRowStyle(expanded),
          onMouseEnter: (e) => { if (!expanded) e.currentTarget.style.background = c.hover },
          onMouseLeave: (e) => { e.currentTarget.style.background = expanded ? c.active : 'transparent' },
        },
          h(GitIcon, { size: 16 }),
          h('span', {
            style: {
              flex: 1, minWidth: 0, fontSize: fs.row, color: c.text2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            },
          }, empty ? 'Git Sentry · 尚未导入' : `Git Sentry · ${sum.total} 个仓库`),

          // 计数徽标：可点，直接跳到「第一个待处理的仓库」——把「告知」变成「入口」。
          sum.needs > 0 && h('span', {
            onClick: (e) => {
              e.stopPropagation()
              const first = projects.find(p => p.status !== 'up-to-date')
              if (first) { openProject(first.id); setState({ expanded: true }) }
            },
            style: { display: 'inline-flex', flexShrink: 0 },
          }, h(CountBadge, {
            count: sum.needs,
            dot,
            title: `${sum.needs} 个仓库待处理，点击查看`,
          })),

          h('span', {
            'aria-hidden': true,
            style: {
              flexShrink: 0, width: 14, textAlign: 'center',
              fontSize: 9, color: c.text3, transition: 'transform .12s',
              transform: expanded ? 'rotate(90deg)' : 'none',
            },
          }, '\u25B6'),
        ),

        // 展开区：逐仓库一行，点击切到主区并选中该仓库。
        expanded && projects.map(p => h('button', {
          key: p.id,
          type: 'button',
          onClick: () => { openProject(p.id) },
          title: p.path,
          style: sideRowStyle(p.id === s.selectedId),
          onMouseEnter: (e) => {
            if (p.id !== s.selectedId) e.currentTarget.style.background = c.hover
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = p.id === s.selectedId ? c.active : 'transparent'
          },
        },
          h(Dot, { dot: STATUS[p.status].dot, size: 7, title: STATUS[p.status].label }),
          h('span', {
            style: {
              flex: 1, minWidth: 0, fontSize: fs.row, color: c.text2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            },
          }, p.name),
          // 领先/落后：只在与 0 不同时才占位，避免一排 `↑0↓0` 的噪音。
          (p.ahead > 0 || p.behind > 0) && h('span', {
            style: {
              flexShrink: 0, fontSize: fs.row, color: c.text3,
              fontFamily: c.mono, fontVariantNumeric: 'tabular-nums',
            },
          },
            p.ahead > 0 ? `\u2191${p.ahead}` : '',
            p.behind > 0 ? `\u2193${p.behind}` : '',
          ),
        )),

        // 全部新鲜时给一条明确的收尾文案，避免展开后「什么都没有」的空洞感。
        expanded && !empty && sum.needs === 0 && h('div', {
          style: {
            padding: `4px ${SIDE.pad}px`, fontSize: fs.row, color: c.text3,
          },
        }, '所有仓库均为最新'),
      )
    }

    /* ------------------------------------------------------------------ *
     * 5. 主区操作台（slot: main）
     * ------------------------------------------------------------------ */

    /** 侧边栏/主区共用的 Git 图标（自绘，不依赖 primitives 的图标集）。 */
    function GitIcon({ size = 16 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
        style: { flexShrink: 0, display: 'block' },
      },
        h('g', { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' },
          h('path', { d: 'M7 6v12' }),
          h('path', { d: 'M7 11h3a5 5 0 0 1 5 5v2' }),
        ),
        h('g', { fill: 'currentColor' },
          h('circle', { cx: 7, cy: 4, r: 2.4 }),
          h('circle', { cx: 7, cy: 20, r: 2.4 }),
          h('circle', { cx: 15, cy: 20, r: 2.4 }),
        ),
      )
    }

    /** 一个带标签的详情字段行。 */
    function Field({ label, children, mono }) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
        h('span', { style: { fontSize: 11, color: c.text3 } }, label),
        h('span', {
          style: { fontSize: 12, color: c.text2, fontFamily: mono ? c.mono : 'inherit', wordBreak: 'break-all' },
        }, children),
      )
    }

    /**
     * 受控文本输入。
     *
     * 注意：不能直接给 `<Input>` 传 children——primitives 的 Input 内部渲染的是
     * 原生自闭合 `<input>`，带 children 会抛
     * 「input is a self-closing tag and must neither have children nor use dangerouslySetInnerHTML」。
     * 这里统一用此包装，把 value／onChange 透传为受控 props。
     */
    function TextInput({ value, onChange, placeholder, label, style }) {
      return h(Input, {
        value,
        placeholder,
        'aria-label': label,
        style,
        onChange: (e) => { onChange(e.target.value) },
      })
    }

    /** 危险动作前的一行内联确认（第一期只演示交互，不真的执行）。 */
    function ConfirmButton({ label, confirmLabel, danger, onConfirm }) {
      const [arming, setArming] = useState(false)
      if (!arming) {
        return h(Button, {
          size: 'sm',
          variant: 'outline',
          onClick: () => { setArming(true) },
        }, label)
      }
      return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
        h(Button, {
          size: 'sm',
          variant: 'primary',
          style: danger ? { background: 'var(--dsw-alias-state-error-primary)' } : undefined,
          onClick: () => { setArming(false); onConfirm?.() },
        }, confirmLabel),
        h(Button, { size: 'sm', variant: 'ghost', onClick: () => { setArming(false) } }, '取消'),
      )
    }

    /** 左侧项目列表的一行。 */
    function ProjectRow({ project, selected, onSelect }) {
      const st = STATUS[project.status]
      return h('button', {
        type: 'button',
        onClick: onSelect,
        style: {
          display: 'flex', flexDirection: 'column', gap: 5, width: '100%',
          padding: '9px 10px', textAlign: 'left', cursor: 'pointer',
          background: selected ? c.active : 'transparent',
          border: 'none', borderLeft: `2px solid ${selected ? c.brand : 'transparent'}`,
          color: c.text,
        },
        onMouseEnter: (e) => { if (!selected) e.currentTarget.style.background = c.hover },
        onMouseLeave: (e) => { if (!selected) e.currentTarget.style.background = 'transparent' },
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          h(StateDot, { state: st.dot, size: 8 }),
          h('span', {
            style: { flex: 1, fontSize: 13, fontWeight: selected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          }, project.name),
          project.autoSync && h('span', { title: '已开启自动同步', style: { fontSize: 10, color: c.text3 } }, '\u21BB'),
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 15 } },
          h('span', { style: { fontSize: 11, color: c.text3, fontFamily: c.mono } }, project.branch),
          h('span', { style: { fontSize: 11, color: c.text3 } },
            project.ahead > 0 ? `\u2191${project.ahead} ` : '',
            project.behind > 0 ? `\u2193${project.behind}` : '',
          ),
        ),
      )
    }

    /** 右侧详情区。 */
    function ProjectDetail({ project }) {
      const st = STATUS[project.status]
      const [commitMessage, setCommitMessage] = useState('')
      const isDirty = project.dirtyFiles.length > 0
      const canCommit = isDirty && commitMessage.trim().length > 0

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 18, padding: '14px 16px', overflowY: 'auto' } },
        // 标题 + 状态
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
            h('span', { style: { fontSize: 15, fontWeight: 600, color: c.text } }, project.name),
            h(Tag, { tone: st.tag }, st.label),
            project.autoSync && h(Tag, { tone: 'quiet' }, '自动同步中'),
          ),
          h(Field, { label: '路径', mono: true }, project.path),
        ),

        h('div', { style: { height: 1, background: c.border } }),

        // 同步来源 / 推送目标 —— D-09：两个独立引用，分两栏显示
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            h('span', { style: { fontSize: 11, fontWeight: 600, color: c.text3, letterSpacing: .3 } }, '同步来源'),
            h(Field, { label: '引用', mono: true }, project.syncSource),
            h(Field, { label: '落后', mono: true }, project.behind > 0 ? `${project.behind} 个提交` : '无'),
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            h('span', { style: { fontSize: 11, fontWeight: 600, color: c.text3, letterSpacing: .3 } }, '推送目标'),
            h(Field, { label: '引用', mono: true }, project.pushTarget),
            h(Field, { label: '领先', mono: true }, project.ahead > 0 ? `${project.ahead} 个提交` : '无'),
          ),
        ),

        h('div', { style: { height: 1, background: c.border } }),

        // 待合入提交
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 9 } },
          h('span', { style: { fontSize: 12, fontWeight: 600, color: c.text2 } },
            `待合入提交（${project.incoming.length}）`),
          project.incoming.length === 0
            ? h('span', { style: { fontSize: 12, color: c.text3 } }, '没有需要合入的提交。')
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
                project.incoming.map(cm => h('div', {
                  key: cm.sha,
                  style: {
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '6px 9px', background: c.layer1, borderRadius: 7,
                  },
                },
                  h('span', { style: { fontSize: 11, fontFamily: c.mono, color: c.link } }, cm.sha),
                  h('span', {
                    style: { flex: 1, fontSize: 12, color: c.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                  }, cm.subject),
                  h('span', { style: { fontSize: 11, color: c.text3 } }, `${cm.author} · ${cm.at}`),
                )),
              ),
        ),

        // 冲突文件
        project.conflictFiles.length > 0 && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 9 } },
          h('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-state-error-primary)' } },
            `冲突文件（${project.conflictFiles.length}）`),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            project.conflictFiles.map(f => h('div', {
              key: f,
              style: {
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                background: c.layer1, borderRadius: 7, border: `0.5px solid var(--dsw-alias-state-error-primary)`,
              },
            },
              h('span', { style: { fontSize: 12, fontFamily: c.mono, color: c.text2, flex: 1 } }, f),
            )),
          ),
          h('span', { style: { fontSize: 11, color: c.text3 } },
            project.lastSync.detail || '需要手动处理后才能继续同步。'),
        ),

        // 未提交改动 + 提交表单
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 9 } },
          h('span', { style: { fontSize: 12, fontWeight: 600, color: c.text2 } },
            `未提交改动（${project.dirtyFiles.length}）`),
          project.dirtyFiles.length === 0
            ? h('span', { style: { fontSize: 12, color: c.text3 } }, '工作区干净。')
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                project.dirtyFiles.map(f => h('div', {
                  key: f.path,
                  style: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', background: c.layer1, borderRadius: 7 },
                },
                  h('span', {
                    style: { fontSize: 11, fontFamily: c.mono, width: 14, color: 'var(--dsw-alias-state-warn-primary)' },
                  }, f.state),
                  h('span', { style: { fontSize: 12, fontFamily: c.mono, color: c.text2 } }, f.path),
                )),
                // 提交：必须由用户填写信息（FR-05），不让 agent 生成
                h('div', { style: { display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 } },
                  h(TextInput, {
                    value: commitMessage,
                    onChange: setCommitMessage,
                    placeholder: '提交信息（必填）',
                    label: '提交信息',
                  }),
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    h(Button, {
                      size: 'sm',
                      variant: 'primary',
                      disabled: !canCommit,
                      onClick: () => { setCommitMessage('') },
                    }, '提交全部改动'),
                    h('span', { style: { fontSize: 11, color: c.text3 } },
                      canCommit ? '将暂存所有改动并提交' : '请先填写提交信息'),
                  ),
                ),
              ),
        ),

        h('div', { style: { height: 1, background: c.border } }),

        // 操作区
        h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 } },
          h(ConfirmButton, {
            label: project.behind > 0 ? `拉取 ${project.behind} 个提交` : '拉取',
            confirmLabel: '确认拉取',
            onConfirm: () => {},
          }),
          h(Button, { size: 'sm', variant: 'outline', disabled: project.ahead === 0 }, `推送 ${project.ahead > 0 ? project.ahead : ''}`.trim()),
          h(Button, { size: 'sm', variant: 'ghost' }, '刷新状态'),
        ),

        // 上次同步结果
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 } },
          h('span', { style: { fontSize: 11, color: c.text3 } },
            `上次同步 ${project.lastSync.at} · ${project.lastSync.result}`),
        ),

        // 未接入提示
        h('div', {
          style: {
            padding: '8px 10px', background: c.layer1, borderRadius: 7,
            border: `0.5px dashed ${c.borderStrong}`, fontSize: 11, color: c.text3, lineHeight: 1.6,
          },
        }, '第一期 UI 原型：以上均为演示数据，拉取 / 提交 / 推送尚未接入真实 Git 操作。'),
      )
    }

    /** 主区操作台：左列表 + 右详情。 */
    function GitSentryPage() {
      const s = useSharedState()
      const projects = MOCK_PROJECTS
      const sum = useMemo(() => summarize(projects), [projects])
      const selected = projects.find(p => p.id === s.selectedId) || projects[0]

      return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: c.text } },
        // 页头
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px', borderBottom: `0.5px solid ${c.border}`,
          },
        },
          h(GitIcon, { size: 18 }),
          h('span', { style: { fontSize: 14, fontWeight: 600 } }, 'Git Sentry'),
          h('span', { style: { fontSize: 12, color: c.text3, flex: 1 } },
            `${sum.total} 个仓库 · ${sum.needs} 个待处理`),
          h(Button, { size: 'sm', variant: 'ghost' }, '导入项目'),
        ),

        // 主体：左列表右详情
        h('div', { style: { display: 'flex', flex: 1, minHeight: 0 } },
          h('div', {
            style: {
              width: 210, flexShrink: 0, borderRight: `0.5px solid ${c.border}`,
              overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 1,
            },
          }, projects.map(p => h(ProjectRow, {
            key: p.id,
            project: p,
            selected: p.id === selected.id,
            onSelect: () => { setState({ selectedId: p.id }) },
          }))),

          h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
            h(ProjectDetail, { project: selected }),
          ),
        ),
      )
    }

    /* ------------------------------------------------------------------ *
     * 6. 设置节（slot: settings.section）
     * ------------------------------------------------------------------ */

    function GitSentrySettings() {
      const [interval, setIntervalValue] = useState('60')
      const [autoCreate, setAutoCreate] = useState(true)
      const [autoMap, setAutoMap] = useState(() => Object.fromEntries(MOCK_PROJECTS.map(p => [p.id, p.autoSync])))

      const row = (label, desc, control) => h('div', {
        style: {
          display: 'flex', alignItems: 'flex-start', gap: 16,
          padding: '11px 0', borderBottom: `0.5px solid ${c.border}`,
        },
      },
        h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 } },
          h('span', { style: { fontSize: 13, color: c.text } }, label),
          desc && h('span', { style: { fontSize: 11, color: c.text3, lineHeight: 1.5 } }, desc),
        ),
        h('div', { style: { flexShrink: 0, paddingTop: 1 } }, control),
      )

      return h('div', { style: { display: 'flex', flexDirection: 'column' } },
        row('自动同步间隔（秒）', '按此间隔轮询各仓库的远程状态。默认 60 秒。',
          h('div', { style: { width: 90 } }, h(TextInput, {
            value: interval,
            onChange: (v) => { setIntervalValue(v.replace(/[^0-9]/g, '')) },
            label: '自动同步间隔（秒）',
          }))),
        row('自动创建远程分支', '推送时若远程尚无同名分支，则自动创建。关闭后推送将因目标不存在而失败。',
          h(Switch, { checked: autoCreate, onChange: setAutoCreate, label: '自动创建远程分支' })),
        h('div', { style: { padding: '13px 0 4px', display: 'flex', flexDirection: 'column', gap: 2 } },
          h('span', { style: { fontSize: 13, color: c.text } }, '逐项目自动同步'),
          h('span', { style: { fontSize: 11, color: c.text3, lineHeight: 1.5, marginBottom: 6 } },
            '自动同步只做「合入远程新提交」，不会自动推送，也不会覆盖你未提交的改动。'),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
            MOCK_PROJECTS.map(p => h('div', {
              key: p.id,
              style: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px' },
            },
              h(StateDot, { state: STATUS[p.status].dot, size: 7 }),
              h('span', { style: { flex: 1, fontSize: 12, color: c.text2 } }, p.name),
              h('span', { style: { fontSize: 11, color: c.text3, fontFamily: c.mono, marginRight: 4 } }, p.branch),
              h(Switch, {
                checked: autoMap[p.id],
                onChange: (next) => { setAutoMap(m => ({ ...m, [p.id]: next })) },
                label: `${p.name} 自动同步`,
              }),
            )),
          ),
        ),
        h('div', {
          style: {
            marginTop: 12, padding: '8px 10px', background: c.layer1, borderRadius: 7,
            border: `0.5px dashed ${c.borderStrong}`, fontSize: 11, color: c.text3, lineHeight: 1.6,
          },
        }, '第一期 UI 原型：设置项暂未持久化，刷新页面会恢复默认值。'),
      )
    }

    /* ------------------------------------------------------------------ *
     * 7. 注册
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots'],
      apply(ctx) {
        // 注册范式：ctx.slots.inject(slot, () => ctx.slots.register(...))。
        //
        // 不能直接调 ctx.slots.register()：slot 必须由父条目的 children 表先声明
        // （SlotCore.register 对未声明的 slot 会抛 "is not declared"）。
        // slots.inject 会等待该声明出现再执行回调，并在声明失效时自动回收注册
        // （registry.ts:209，回调被包进嵌套 ctx.effect）。因此这里不再额外套
        // ctx.effect —— 生命周期已由 inject 负责。

        // 侧边栏常驻状态行。注意：这是便利入口，不是功能依赖（RK-11）。
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'git-sentry-status',
          order: 10,
          label: () => 'Git Sentry',
          locale: 'git-sentry',
        }, GitSentryStatusRow))

        // 主区操作台 —— 功能的完整载体。
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'git-sentry',
          locale: 'git-sentry',
        }, GitSentryPage))

        // 侧边栏面板入口图标。
        //
        // 注：此处刻意不注册 sidebar.panellist。底部状态行已经承担了入口职责
        // （点展开 → 点仓库 → 主区定位到该仓库），再放一个顶部图标会与它重复，
        // 让用户面对两个功能相同的入口。若将来状态行因 RK-11 降级消失，
        // 再把它加回来作为兜底入口。

        // 设置页一节。
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'git-sentry',
          order: 30,
          label: () => 'Git Sentry',
          locale: 'git-sentry',
        }, GitSentrySettings))
      },
    }
  },
})
