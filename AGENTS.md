# git-sentry — 接手须知

> **给接手的 AI**：先读完本文件，再按顺序读 `docs/` 下的三份文档。
> 本仓库的方案已经与用户逐条确认并收敛，**不要在没有充分理由的情况下重新设计**。

## 这是什么

一个 DSH（DeepSeek Harness）插件，用来集中管理**服务器本机**上的 Git 项目：

- 在侧边栏看到所有已导入项目的分支与领先/落后状态
- 用按钮做拉取 / 提交 / 推送
- 按项目配置自动把远程的新提交合进来

## 当前进度

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| 立项 | 需求、决策、方案 | 已完成，见 `docs/` |
| P1 | 纯 UI 原型（可点击、无实际功能） | **未开始 — 这是下一步** |
| P2 | 自动同步 | 未开始 |
| P3 | 增强（Webhook、提交历史、diff、批量） | 未开始 |

**代码现状是空骨架。** `package.json` / `cordis.patch.yml` / `index.js` / `client.js` 已就位，
能安装、能挂载，但 `client.js` **刻意不注册任何 slot**，所以装上去界面上看不到任何变化。

这是有意为之：先保住"可安装"这个前提，同时不把尚未定稿的界面结构固化进代码。
第一期 UI 的落点需要按各 slot 的实际 props 决定，那属于开发阶段的工作。

## 必读顺序

1. **`docs/requirements.md`** —— 用户要什么、明确不要什么、验收标准
2. **`docs/decisions.md`** —— 已定死的 21 条决策，**每条都写了理由**
3. **`docs/plan.md`** —— 架构、数据模型、接口、决策矩阵、分期、风险

第 2 份要特别认真读。**理由比结论重要**：其中至少两条，如果只看到结论、看不到理由，
你大概率会把它改回去，而改回去会出真问题——`D-09`（拉取来源与推送目标必须分离）
和 `D-03`（脏工作区不 stash、直接 merge）。

## 红线

违反其中任何一条都会造成真实损害，这不是风格问题：

1. **不代管 git 凭据**。凭据由用户自行在服务器上配置。插件只报告"远程不可达"，不引导输入密钥。
2. **不自动推送**。推送是不可逆的对外动作，永远由用户显式触发。
3. **不做 `stash` / `checkout` / `reset` / `--force` 推送**。这些都可能静默丢失用户未提交的代码。
4. **同一仓库的 git 操作必须串行**。自动同步遇到用户正在操作时**跳过本轮**，不排队、不抢占。
5. **所有 git 子进程必须非交互**：`GIT_TERMINAL_PROMPT=0`、
   `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15"`，并且带硬超时。
   否则在无人值守的服务器上会挂死。
6. **拉取来源与推送目标是两个独立引用**，不可合并回一个"上游"概念。见 `D-09`。
7. **插件不主动调用 agent**。可以把 git 操作暴露成对话工具给用户用，但插件自己不发 agent 请求。
8. **不往自己组件之外写 DOM**，不 `.append()` 到 `document.body`。浮层只能渲染在自己的面板容器内。
9. **不修改 profile 的 `package.json`**，不在 profile 目录里跑包管理命令。插件是独立包目录，
   以绝对路径安装进 profile。违反这条，升级 DSH 时你的改动会被冲掉。

## 环境事实（已实测，2026-10-14）

| 项 | 值 |
| --- | --- |
| DSH 检出目录 | `/home/tokamak/dev/tools/deepseek-harness/` |
| 插件源码（本仓库） | `/home/tokamak/dev/repos/git-sentry` |
| 被管理的仓库 | `/home/tokamak/dev/repos/` 下的 `ArtPass`、`DogEar`、`dutybot`、`VibeCodingPack` |
| DSH profile | `/home/tokamak/.dsh/profiles/web`（当前唯一 profile） |
| 运行时 | node v26.7.0 / pnpm 11.28.5 / **git 2.43.0** |
| 远程协议 | **全部 HTTPS**（`https://github.com/...`） |
| 凭据 | `gh auth git-credential`，per-URL helper 配在 `~/.gitconfig` |
| 全局 git 身份 | `user.name` / `user.email` **未设置**，身份是仓库级的 |

`git 2.43.0` 这个数字有意义：冲突预判用的 `git merge-tree --write-tree` 需要 **≥ 2.38**，
当前版本满足；但代码里仍要做版本降级分支，见 `docs/plan.md` 的兼容性一节。

## 开发时该读的技能

- **`cordis-plugin-development`** —— 插件怎么写、装在哪、有哪些硬规则
- **`cordis-composition-reference`** —— 包目录、挂载用法

改 slot 相关代码前，先用 `Slots.listSubTree` 读出该 slot 的准确形状再动手，不要凭印象写。
