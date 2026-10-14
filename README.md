# dsh-git-sentry

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DSH 插件，用于集中管理**本机**上的 Git 项目。

在侧边栏一眼看到所有已导入项目的分支与领先/落后状态，用按钮完成拉取 / 提交 / 推送，
并可配置自动把远程新提交合进来。

## 安装

插件**未发布到 npm registry**，因此不能用裸包名安装。用 git 源形式：

```bash
dsh plugin install github:toookamak/dsh-git-sentry
```

其他等效写法（任选其一）：

```bash
dsh plugin install https://github.com/toookamak/dsh-git-sentry
dsh plugin install github:toookamak/dsh-git-sentry#main   # 指定分支
dsh plugin install /abs/path/to/dsh-git-sentry            # 本地源码路径
```

> **两个容易踩的坑**（均为实测踩过）：
>
> 1. **不能用 `toookamak/dsh-git-sentry` 这种裸短写。** 安装流程会把它当 npm
>    包名去 registry 解析，而包名规则不允许斜杠，于是报
>    `not a package name the registry accepts`。这不是「不支持 GitHub」，
>    是格式没被识别成 git 源——必须带 `github:` 前缀或完整 URL。
> 2. **不能用 `dsh plugin install dsh-git-sentry`。** 包没发到 registry，
>    这样装会报找不到。

安装后**需要重启 DSH 或刷新页面**：已安装包的 JavaScript 模块世代不会热更新，
替换包之后必须重新加载才能生效。

> 插件是**独立包目录**。请勿修改 profile 的 `package.json`，
> 也不要在 profile 目录里跑包管理命令——那些改动会在升级 DSH 时被覆盖。

## 当前状态

**第一期：UI 原型（进行中）**

界面先行——按钮可点击，但不执行真实的 Git 操作，点击后以浮窗提示代替。
此阶段不读取仓库、不持久化数据、不启动定时器，**刷新页面即回到初始状态**。

已落地的界面：

| 界面 | 落点 | 内容 |
| --- | --- | --- |
| 侧边栏状态行 | `sidebar.footer.action` | 常驻显示「Git Sentry · N 个仓库」+ 待处理计数徽标，点击徽标直接跳到第一个待处理仓库；可展开逐仓库列表；窄态退化为图标 + 角标 |
| 主区操作台 | `main` | 左列表右详情：状态、分支、同步来源 / 推送目标分两栏、待合入提交、冲突文件、提交表单、拉取/推送按钮 |
| 设置页一节 | `settings.section` | 自动同步间隔、自动创建远程分支、逐项目自动同步开关 |

**只有两个入口，且互不重复**：侧边栏状态行（常驻、看状态 + 快速定位）与主区操作台
（完整功能）。刻意不注册 `sidebar.panellist`——状态行已承担入口职责，
再放一个顶部图标会与它重复，让用户面对两个功能相同的入口。

侧边栏状态行**只是「少切一次页」的便利**：即使它整块消失，主区页面也完整可用。

## 已确定的设计约束

这些不是风格偏好，每条都对应真实损害：

- **拉取来源与推送目标分离**：拉取跟随 `origin/HEAD`，推送发往 `origin/<当前分支>`。
  合并二者的做法在服务器分支上会安静地失效，或把服务器改动推上默认分支。
- **服务器上的改动走独立分支**，不直接落在远程默认分支。
- **不代管凭据**：沿用系统 Git 配置与凭据助手，插件只报告「远程不可达」。
- **不自动推送**：推送是不可逆的对外动作，永远由用户显式触发。
- **不做** `stash` / `checkout` / `reset` / `--force` 推送——这些都可能静默丢失未提交的代码。
- 同一仓库的同步操作**串行**执行；自动同步遇到用户正在操作时**跳过本轮**，不排队、不抢占。
- **非交互保护**：命令带 `GIT_TERMINAL_PROMPT=0`，SSH 走 `BatchMode=yes`，并带硬超时；
  否则在无人值守的服务器上会挂死。
- **设置项以插件 Config 为唯一数据源**，不散落到 `ctx.storage`。
- 不往自己的组件之外写 DOM；浮层只渲染在插件自己的面板容器内。

## 仓库结构

插件以 DSH bundle 形式开发，源码即包本体，**无需构建**：

| 文件 | 作用 | 当前状态 |
| --- | --- | --- |
| `package.json` | 包声明与 `dsh` 元数据 | 已就位 |
| `cordis.patch.yml` | 挂载入口（id: `git-sentry`，name: `dsh-git-sentry`） | 已就位 |
| `index.js` | Host 侧逻辑 | 空实现，仅导出 `apply` |
| `client.js` | 浏览器侧 UI | **已实现第一期四个 slot** |
| `locale/zh.json`、`locale/en.json` | 文案 | 仅 `meta` |
| `icon.svg` | 图标 | 已就位 |
| `docs/` | 需求、决策、方案、复核记录 | 已就位 |

## 文档

接手开发前请按顺序阅读：

1. [`docs/requirements.md`](docs/requirements.md) —— 要什么、明确不要什么、验收标准
2. [`docs/decisions.md`](docs/decisions.md) —— 已定死的决策，**每条都写了理由**
3. [`docs/plan.md`](docs/plan.md) —— 架构、数据模型、接口、决策矩阵、分期、风险

第 2 份要特别认真读。**理由比结论重要**：其中至少两条，如果只看到结论、看不到理由，
你大概率会把它改回去，而改回去会出真问题——`D-09`（拉取来源与推送目标必须分离）
和 `D-03`（脏工作区不 stash、直接 merge）。

## 开发阶段说明

第一期 UI 的落点是**实测 slot 契约后**确定的，不是设计阶段拍定的。
`sidebar.panellist` 只是图标栏（owner props 仅 `{ size, active }`），
`sidebar.right.pane.tab` 需要额外注册 tab 类型定义才能显示——
因此详情面板改为 `main` 内的主从布局，右侧 tab 留到 P3。

改 slot 相关代码前，先用 `Slots.listSubTree` 读出该 slot 的准确形状再动手，不要凭印象写。

## 许可

MIT
