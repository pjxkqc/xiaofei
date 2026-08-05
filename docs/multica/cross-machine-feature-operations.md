# 跨机器 Feature 操作契约

本文是 Xiaofei 在获批 Mac、Windows 和 Private Proxy 主机间启动与交接
Feature 的 canonical 操作手册。它负责机器准备、能力与权限、每日启动、冲突和
交接；PR、Preview、UAT、清理与 Production 晋级的执行细节只由
[`xiaofei-pr-delivery`](./skills/xiaofei-pr-delivery/SKILL.md) 定义。

## 1. 不变量

- 一个 Feature 只有一个父 Issue、一个 Origin Codex session、一个当前 Managing
  session、一个共享分支和一个面向 `uat` 的 Draft PR。
- 一个文件边界同一时刻只有一个实现 Owner。多机器用于并行不重叠边界或只读验证，
  不用于竞写同一文件。
- 凭据属于主机。只传能力状态、账号名、Runtime/Agent ID、变量名和脱敏错误；不把
  Token、Cookie、密码、连接串、`custom_env` 值或浏览器会话复制到仓库、Issue、PR、
  日志或另一台机器。
- 标准 Codex Runtime 是核心执行路径。Private Proxy 是可选的 host-local 网络适配，
  不得成为核心 checkout、GitHub、Multica、Node、pnpm 或 Git 能力的前置条件。
- 普通工作只从接受的 `uat` 基线进入 Draft PR；不得直接操作 `main` 或 Production。

## 2. 首次准备

### Mac

在 Terminal 中安装项目要求的 Node、pnpm、Git、GitHub CLI 和 Multica CLI，并在本机
分别完成登录。不要把另一台主机的配置目录、Keychain、浏览器 profile 或环境文件复制
过来。

```bash
node --version
pnpm --version
git --version
gh auth status
multica auth status
```

### Windows

在 PowerShell 中安装相同工具并逐项登录。命令示例必须能直接在 PowerShell 执行，
不得依赖 zsh、`export`、POSIX 路径或 `/tmp`。

```powershell
node --version
pnpm --version
git --version
gh auth status
multica auth status
```

推荐依次使用官方安装入口：Multica 的 Windows `install.ps1`、GitHub CLI 的官方
Windows release，以及仓库锁定版本的 pnpm。若 Corepack 因 NVM 安装目录权限失败，
将同版本 pnpm 安装到当前用户可写目录，不修改系统级 Node。安装完成后要关闭并重开
Multica Desktop；重新启动的进程必须继承当前 Machine PATH 与 User PATH，不能沿用安装
前的旧环境。

```powershell
irm https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.ps1 | iex
```

如果 Desktop Runtime 中的普通任务仍看不到用户级 `gh` 或 `pnpm`，可以在一个已经位于
该 Runtime PATH 的**用户级**目录放置只指向已校验官方安装的最小 shim；不得覆盖现有
文件，也不得把另一台机器的二进制或凭据复制过来。若 Git 访问私有仓库复现 Windows
Schannel `SEC_E_NO_CREDENTIALS`，先记录当前非敏感 `http.sslBackend` 设置，再在当前
用户范围改用 `openssl`，执行 `gh auth setup-git` 并用目标仓库的 `git ls-remote` 验证；
同时记录恢复原设置的回滚步骤。

Windows 最终 smoke 应从无改动的 exact-SHA checkout 直接运行仓库脚本，避免 package
script 为一个只读检查触发依赖安装：

```powershell
node scripts/verify-feature-runtime.mjs --profile runtime --json
git ls-remote origin refs/heads/<shared-branch>
gh api user --jq .login
gh repo view pjxkqc/xiaofei
multica project get dd543ecd-01d2-495d-a517-3c8455050581 --output json
```

输出只保留版本、账号名、项目/Runtime 标识、分支 SHA、检查状态和脱敏错误。完成一次性
主机修复后，应立即撤销临时写权限；后续 smoke Agent 保持只读。

普通沙箱 Runtime 如需读取私有仓库，可在 Agent secret `custom_env` 中使用该 Runtime
专用、仅限 `pjxkqc/xiaofei` 的 fine-grained PAT。Token 只能作为环境变量存在，绝不写入
仓库、日志或命令输出；记录其 90 天到期日并在到期前轮换。Git HTTPS 必须使用同样仅在
环境中存在的 scoped 配置：`GIT_CONFIG_COUNT`、`GIT_CONFIG_KEY_0` 和
`GIT_CONFIG_VALUE_0`，不得持久化 credential helper 或配置值。`gh api user --jq .login`、
私有仓库 `gh repo view pjxkqc/xiaofei` 与目标分支的 `git ls-remote` 共同构成权威只读
验收；单独 `gh auth status` 不能验证仅通过环境变量提供的 token。

两类主机都通过项目资源 checkout，不假设固定本机路径：

```text
multica repo checkout https://github.com/pjxkqc/xiaofei --ref uat
```

进入命令返回的目录后，用 `git rev-parse --show-toplevel` 确认仓库根，再运行仓库命令。
若已有获批共享分支，checkout 该分支并验证远端 exact SHA；不要从 `uat` 另建竞争分支。

## 3. 能力与最小权限

“可用”表示该主机本地已认证且通过只读 smoke；不表示应把凭据注入 Agent。

| 能力                       | Controller         | Lead/实现 Agent | Platform           | Quality/Windows smoke |
| -------------------------- | ------------------ | --------------- | ------------------ | --------------------- |
| repo、Node、pnpm、Git      | 必需               | 必需            | 必需               | 必需                  |
| GitHub 读 PR/check         | 必需               | 必需            | 必需               | 必需                  |
| GitHub 写 branch/PR        | 协调时按需         | 自有分支按需    | 自有边界按需       | 不需要                |
| Multica Issue/Agent 读取   | 必需               | 必需            | 必需               | 必需                  |
| Multica 路由/metadata 写入 | 父 Issue 按需      | 自有 Issue 按需 | 自有 Issue 按需    | 不需要                |
| Vercel Preview 读取        | 跟进时按需         | 不需要          | 按需               | 验收时按需            |
| Neon Preview 读取          | 数据 Feature 按需  | 不需要          | 按需               | 验收时按需            |
| Chrome/浏览器              | 人工 Preview 按需  | UI Feature 按需 | 不需要             | 验收时按需            |
| Production 写入            | 禁止，除非独立授权 | 禁止            | 禁止，除非独立授权 | 禁止                  |

Controller 的最小权限是读取项目、Issue、PR、check、Runtime 和 Agent 状态，并更新自己
管理的父 Issue/PR 协调记录。实现 Agent 只需 checkout、修改自己的路径、运行门禁并更新
自己的分支/Issue。不要为了“能力一致”给所有 Agent 发放 Vercel、Neon、Chrome 或
Production 权限。

标准 Runtime 的 core profile 包含 repo、GitHub、Multica、Node、pnpm 和 Git。Vercel、
Neon、Chrome 是按任务选择的 capability profile。Private Proxy 只解决某台主机的本地
出网路径：路径、端口、证书和启动方式留在该主机；不可修时记录最小本机处理指引，
切回标准 Runtime，且不阻断其他主机。

## 4. 每日新 Feature 启动清单

每天或换机后都重新查事实，不沿用昨日快照：

1. 读取 `CODEX_THREAD_ID`，声明完整 ID、`CX-<第一段>` 标签和本次 Feature。
2. 读取 `AGENTS.md`、本文件、`collaboration.md`、`repository-structure.md`、
   `$xiaofei-feature-orchestration` 和 `$xiaofei-pr-delivery`。
3. 只读查询 `origin/uat`、open PR、相关 Issue/metadata/comments、Agent/Runtime 状态；
   核对目标和 protected paths 是否重叠。
4. 写出 P0 的 Outcome、Scope、Non-goals、Acceptance、Validation、Risk 和 Owner 顺序；
   未获确认前不建重复 Issue、不写共享路径。
5. 创建或认领唯一父 Issue。只在首次创建时写 Origin；认领时验证当前 manager，未经
   交接不得覆盖。
6. 从 accepted baseline 创建或接入唯一共享分支与 Draft PR；为每个边界指定唯一 Owner。
7. 每次 handoff 比较远端 exact SHA 和 protected paths；有偏移或冲突就停写。

固定启动提示：

```text
使用 $xiaofei-feature-orchestration 启动 Xiaofei Feature：<目标>。先声明
CODEX_THREAD_ID/CX tag 和当前主机，只读核对 uat、open PR、Issue metadata、
Agent/Runtime 与 protected paths；给出最小 P0 brief 和串行 Owner 计划，等我确认后再
认领父 Issue。全程只用一个共享分支和一个 Draft PR 到 uat，并用
$xiaofei-pr-delivery 记录 exact-head、Preview、Quality、人工合并、UAT 与 handoff；
不复制 host-local 凭据，不改 Production。
```

## 5. 状态机

```text
Brief
  -> Parent Issue claimed (Origin immutable, Manager current)
  -> Owners sequenced
  -> Shared branch
  -> Draft PR to uat
  -> Preview/evidence for exact head
  -> Quality for exact head
  -> Human merge decision
  -> UAT verification and disposable Preview cleanup
  -> Handoff/close
```

任何写入前，状态必须能从父 Issue metadata、PR ownership block、远端 branch head 和
handoff comment 四处互相核对。人工“允许合并”不是 Production 晋级许可；晋级必须另开
授权 Issue，并遵循 `xiaofei-pr-delivery`。

## 6. Protected paths 与冲突停写

父 Issue 和 PR body 记录 shared branch、accepted baseline、Owner 顺序和 protected
paths。每个 Owner 开始及交接时至少执行：

```text
git fetch origin --prune
git status --short --branch
git rev-parse HEAD
git diff --name-only <accepted-sha>...HEAD
git ls-remote origin refs/heads/<shared-branch>
```

随后把 diff 与自己的允许路径、其他 open PR 的 changed paths、前一 Owner 的 handoff
逐项比较。出现以下任一情况立即停止编辑和提交：

- 远端 head 不等于接收的 exact SHA；
- worktree 非预期不干净；
- diff 进入另一 Owner 或另一个 PR 的 protected path；
- baseline、Issue metadata、PR body 或 handoff 相互矛盾。

后到者在 Issue 报告冲突，由 Lead 选择串行等待、拆契约或改文件边界。不得 force-push、
rebase/丢弃未知改动、另建竞争实现，或把同一共享分支同时交给两个写 Owner。

## 7. Origin、Manager 与 exact SHA 审计

Origin 标识首次创建父 Issue 后永久不变。Manager 只有在用户或当前 Manager 明确批准后
才能变更；接收方先核对 Issue、PR、worktree、remote head 和 protected paths，再只更新
`codex_manager_thread_id`、`codex_manager_tag`、`codex_manager_updated_at`，并评论旧/新
Manager、exact SHA、主机/工作树标识、保护路径和剩余动作。子 Issue 继承父 Issue 的
controller，不复制整套 session metadata。

commit、amend、rebase、merge 或接收上游提交都会产生新 head，并立即作废旧的本地门禁、
Quality、Vercel、Neon 和人工 Preview 证据。最终交接必须记录：

- Issue/PR、Origin/Manager 和实现 Owner；
- base/head ref 与 exact SHA；
- changed paths 和 protected paths audit；
- `delivery:check`、`delivery:head`、Quality/Preview 结果；
- host-local 未决风险与下一位 Owner/人工决定。

只传这些非敏感审计字段。凭据缺失或 Private Proxy 故障应由对应主机本地修复，不通过
Issue、PR、commit 或 Agent `custom_env` 搬运现有值。
