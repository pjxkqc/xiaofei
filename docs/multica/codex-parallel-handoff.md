# Codex 并行 Feature 交接

> 快照核对时间：2026-08-03（Asia/Shanghai）。状态会继续变化；新会话必须重新查询 GitHub、Multica、Vercel 和 Neon，不能把本页快照当成永久事实。

本文用于把新的 Codex 会话接入 Xiaofei，并让它通过 Multica 独立跟进一个 Feature。它补充现有规范，不创建第二套 Skill。

跨机器首次准备、Mac/Windows 命令、能力矩阵、固定每日提示、状态机、protected paths
audit、冲突停写和 Origin/Manager 交接，以
[`cross-machine-feature-operations.md`](./cross-machine-feature-operations.md) 为唯一事实源。
本页只保留项目快照、路由背景和可复制提示；PR/Preview/UAT/晋级细节继续以
`xiaofei-pr-delivery` 为准。

## 1. 当前状态

| 项目       | 当前状态                                                                                |
| ---------- | --------------------------------------------------------------------------------------- |
| Production | `v0.1.0`；`main` 为 `ecb44a7baa27f109701fdbd3450cba42c4dc2878`                          |
| UAT        | 已验收 `afe89ef60a3715005a110d22e60b3266c47ab07d`；稳定分支 `uat`                       |
| 数据       | Production 为 Neon `main`；UAT 为 `preview/uat`；普通 PR 为独立 `preview/<head-branch>` |
| Multica    | Xiaofei 项目 45/45 个 Issue 已完成；Lead、Runtime、App、Platform、Quality 均为 idle     |
| 在途 PR    | [#37](https://github.com/pjxkqc/xiaofei/pull/37) 是面向 `uat` 的文档型 Draft PR         |

新 Feature 必须从执行时最新的 `origin/uat` 创建独立分支。不要以 PR #37 的分支作为功能基线，也不要让两个 Codex 会话共用同一个工作树或任务分支。

最新环境、URL 和测试入口以 [`../releases/README.md`](../releases/README.md) 为准；UAT 证据见 [`../acceptance/UAT-2026-08-03.md`](../acceptance/UAT-2026-08-03.md)。

### 已完成基线

- Supastarter 认证、角色、Organization 和公开 `/support`。
- 文档、网页、手工问答录入；PDF、DOCX、XLSX、Markdown/TXT 与单页网页解析。
- 持久化 Knowledge Entry、KU、Capability Review 和同版本 Eval。
- LangGraph 编排会话；Mastra/模型生成受控候选；Guardrail 与 `ownerEpoch` 决定最终回复。
- 多轮上下文、软性知识未命中、保持接管和重新命中后的恢复回答。
- Organization 隔离的配置、知识、客户、会话、Inbox 与 Global Admin。
- 耐久 S2S Inbox、幂等接入、投递/重放监控，以及 Email/WhatsApp Mock Worker 闭环。
- GitHub Quality、Vercel Preview、PR 级 Neon 分支、长期 UAT 与受控 Production 晋级。

### 刻意保留的边界

- 真实 Kafka Consumer、渠道 Worker 和真实 Email/WhatsApp 发送尚未实现。
- 公开 `/support` 仍是共享 P0 工作区，尚未绑定 Organization 客户。
- Organization 知识与公开 C-Air 演示知识彼此独立。
- UAT 的 Organization/Worker 能力尚未晋级 Production。
- Production 配置、数据、部署和晋级必须单独获得用户授权。

## 2. 新会话阅读顺序

1. [`../../AGENTS.md`](../../AGENTS.md)；
2. 本文；
3. [`../repository-structure.md`](../repository-structure.md)；
4. [`README.md`](./README.md)；
5. [`cross-machine-feature-operations.md`](./cross-machine-feature-operations.md)；
6. [`collaboration.md`](./collaboration.md)；
7. [`agents.md`](./agents.md)；
8. [`skills/xiaofei-feature-orchestration/SKILL.md`](./skills/xiaofei-feature-orchestration/SKILL.md)；
9. [`skills/xiaofei-pr-delivery/SKILL.md`](./skills/xiaofei-pr-delivery/SKILL.md)；
10. [`../releases/README.md`](../releases/README.md) 和 Feature 所属边界旁的 README。

## 3. Codex 与 Multica 分工

### Codex 会话

- 和用户确认目标、P0 范围、非目标、风险与验收方式。
- 先只读核对仓库、GitHub、Multica 和环境，再给出最小闭环方案。
- 启动时从 `CODEX_THREAD_ID` 派生 `CX-xxxxxxxx` 会话标签并主动声明。
- 方案确认后创建或认领唯一 Multica 父 Issue，写入不可变 Origin session
  和当前 Managing session 元数据，记录本会话负责的 Feature。
- 跨边界工作拆成串行子 Issue，分配给唯一 Agent。
- 跟进 run、PR、CI、Vercel、Neon 与 Preview；重复故障应修交付规则或 Skill。
- 汇总 Quality 结论；只有用户明确同意后才能合并或晋级。

### Multica

- 保存 Issue、Owner、验收标准、运行记录与交接证据。
- 实现 Agent 使用隔离 checkout 和独立分支完成一个边界。
- Lead 拆解和串行调度；Quality 独立验收，不和实现 Agent 抢写同一边界。
- GitHub、Git 与部署状态仍是事实源，评论不能替代可执行验证。

## 4. 并行安全规则

本节是速查；完整且 canonical 的冲突停写与跨主机交接步骤见
[`cross-machine-feature-operations.md`](./cross-machine-feature-operations.md)。

1. **一个会话，一个 Feature 父 Issue。** 先用 Session metadata 和 PR body
   确认没有别人处理同一目标。
2. **一个边界，一个 Owner。** 不并发修改同一契约、Schema、页面或交付脚本。
3. **隔离工作树。** 实现必须用 `multica repo checkout ... --ref uat`；不能复用另一会话正在使用的工作树或分支。
4. **先契约后消费者。** 跨边界按“领域/数据库契约 → API/持久化 → 页面/交互 → Quality”串行推进。
5. **普通工作只走 UAT。** 从最新 `origin/uat` 开分支，Draft PR 回到 `uat`；不要直接 `uat → main`。
6. **不操作别人交付物。** 未经负责会话或用户授权，不 merge、close、rebase、force-push、删分支或清理别人的 Preview。
7. **每次交接带精确 SHA。** 新 commit、amend、rebase 或 merge 后旧 CI、Preview 和人工证据失效。
8. **不传 Secret。** 只记录变量名和配置位置，不复制 Key、Cookie、数据库 URL 或 Production 账号。
9. **来源与管理分开。** Origin session 创建后永不改；只有获批交接才能更新
   Managing session，并在父 Issue 留下旧/新会话、精确 SHA 与剩余动作。

开始工作前执行：

```bash
test -n "$CODEX_THREAD_ID"
XIAOFEI_CODEX_THREAD_ID="$CODEX_THREAD_ID"
XIAOFEI_SESSION_TAG="CX-${XIAOFEI_CODEX_THREAD_ID%%-*}"

git fetch origin --prune
git status --short --branch
gh pr list --repo pjxkqc/xiaofei --state open
multica auth status
multica project list --output json
multica issue list --project dd543ecd-01d2-495d-a517-3c8455050581 --limit 100 --output json
multica agent list --output json
```

若目标、路径或 PR 重叠，后开始的会话暂停写入，由 Xiaofei Lead 切分或决定顺序。

用户确认方案并创建或认领父 Issue 后，写入会话所有权：

```bash
multica issue metadata set <issue-key> --key codex_origin_thread_id \
  --value "$XIAOFEI_CODEX_THREAD_ID" --type string
multica issue metadata set <issue-key> --key codex_origin_tag \
  --value "$XIAOFEI_SESSION_TAG" --type string
multica issue metadata set <issue-key> --key codex_manager_thread_id \
  --value "$XIAOFEI_CODEX_THREAD_ID" --type string
multica issue metadata set <issue-key> --key codex_manager_tag \
  --value "$XIAOFEI_SESSION_TAG" --type string
multica issue metadata set <issue-key> --key codex_manager_updated_at \
  --value "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --type string
```

认领已有 Issue 时先读取这些键。若 Origin 已存在则不得覆盖；Managing
session 不等于本会话时必须暂停，直到用户或原 Managing session 明确交接。

## 5. Agent 路由

| 边界                                                | 唯一 Owner         | 常见路径                                                          |
| --------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| 架构、跨边界契约、Issue 拆分                        | `Xiaofei Lead`     | `docs/**`、Issue、交接                                            |
| KU、Capability、Guardrail、Owner、LangGraph、Mastra | `Xiaofei Runtime`  | `packages/xiaofei/**`、`packages/ai/**`                           |
| 页面、oRPC、认证、Organization/Support 权限         | `Xiaofei App`      | `apps/saas/**`、`packages/api/**`、必要的 `packages/auth/**`      |
| Prisma、Neon、Vercel、Actions、Preview              | `Xiaofei Platform` | `packages/database/**`、`.github/**`、`scripts/**`、`vercel.json` |
| 独立验收、安全和文档一致性                          | `Xiaofei Quality`  | 全仓库只读评审；默认不实现同一 Issue                              |

跨行 Feature 由 Lead 建父 Issue 和有依赖顺序的子 Issue；父 Issue 在集成和 Preview 证据齐全后才完成。

## 6. Issue → PR → UAT

### 方案与 Issue

每个 Issue 写清 Outcome、Scope、Non-goals、Acceptance、Validation 和 Risk。只有所有权或依赖真正跨边界时才拆分。

### 实现与本地证据

```bash
multica repo checkout https://github.com/pjxkqc/xiaofei --ref uat
git fetch origin --prune
git switch -c agent/FLY-123-cx-019fc9d9-short-outcome origin/uat
pnpm delivery:identity

# 聚焦测试后执行完整门禁
pnpm delivery:check
git add <explicit-files>
git commit -m 'feat: complete short outcome'
pnpm delivery:head
git rev-parse HEAD
```

作者或 committer 不合规时应 amend，不追加空 commit 掩盖。

### Draft PR 与 Preview

- Branch 带 `FLY-123` 与 `cx-xxxxxxxx`，PR 标题带 `FLY-123`；base 必须是
  `uat`，初始为 Draft。
- body 顶部记录 Origin/Managing Codex session、Multica 父 Issue 和实现
  Owner，随后记录范围、验证、精确 Head SHA 与风险。
- 等待同一 Head 的 GitHub Quality、Vercel 和 Neon Preview，在不可变 URL 验收。
- 新 commit 后重跑全部证据，不沿用旧 Head 绿灯。

### Quality、合并与 UAT

- 公开 API、鉴权、租户隔离、Owner/Guardrail、Schema、CI/CD、Secret 或数据清理必须独立 Quality。
- 用户明确批准后才能合入 `uat`。
- 合并后验证稳定 UAT、Neon `preview/uat` 和 PR Preview 清理。
- Production 只通过获批的临时 `promote/uat-YYYYMMDD-<slug> → main` PR。

## 7. 会话间交接

```markdown
### Handoff

- Feature / Multica Issue:
- Origin Codex session:
- Managing Codex session:
- Implementation Agent:
- Outcome:
- Changed files or contracts:
- Validation and result:
- Exact head SHA:
- PR and Preview:
- Manual evidence and retained test data:
- Risks or unresolved decisions:
- Paths another session must not edit yet:
- Next owner and requested action:
```

测试账号只链接到 [`../acceptance/FLY-99.md#test-access--验收访问`](../acceptance/FLY-99.md#test-access--验收访问)，不要重复密码。Production 不使用共享明文测试账号。

## 8. 新 Codex 会话提示词

复制下面内容并替换 `<本次 Feature>`：

```text
你负责 Xiaofei 项目的一个独立 Feature 流，并通过 Multica 安排和跟进。

仓库：通过 Multica 项目资源 checkout，不使用固定本机路径
GitHub：https://github.com/pjxkqc/xiaofei
Multica Project：Xiaofei（dd543ecd-01d2-495d-a517-3c8455050581）
本次 Feature：<本次 Feature>

启动后先读取环境中的 CODEX_THREAD_ID，派生会话标签
CX-<thread-id 第一段>，在第一条进度更新中声明完整 Thread ID、会话标签和
本次 Feature。Origin session 代表最初提出者，创建后不可修改；Managing
session 代表当前管理者，只能在用户或原管理会话明确交接后更新。

开始先只读，不改代码、不建重复 Issue、不操作现有 PR。仓库必须通过项目资源或
`multica repo checkout https://github.com/pjxkqc/xiaofei --ref uat` 获取。完整读取 AGENTS.md、
docs/multica/codex-parallel-handoff.md、docs/repository-structure.md、
docs/multica/README.md、docs/multica/cross-machine-feature-operations.md、
docs/multica/collaboration.md、docs/multica/agents.md、
docs/multica/skills/xiaofei-feature-orchestration/SKILL.md、
docs/multica/skills/xiaofei-pr-delivery/SKILL.md、docs/releases/README.md，
以及 Feature 所属边界旁的 README。

用 GitHub/gh 和 multica CLI 重新核对 uat/main Head、open PR、Issue、runs/comments、
父 Issue 的 codex_origin_* / codex_manager_* metadata、PR body 中的 Coordination
ownership、五个 Xiaofei Agent 状态和路径占用。不要依赖提示词内的旧快照。

先和我确认最小 P0 闭环方案，输出 Outcome、Scope、Non-goals、Acceptance、Validation、
Risk 和 Owner/依赖顺序。确认后创建或认领唯一父 Issue；跨边界按契约 → 数据/API →
页面 → Quality 串行拆分，不并发修改共享边界。新父 Issue 写入 immutable
codex_origin_thread_id/tag 和当前 codex_manager_thread_id/tag/updated_at；认领已有
Issue 时不得覆盖 origin，manager 不属于本会话则先暂停请求交接。

实现用隔离 checkout，从最新 origin/uat 创建
agent/FLY-xxx-cx-xxxxxxxx-*，普通 Draft PR 只到 uat。PR body 顶部写
Coordination ownership：Origin session、Managing session、Multica parent Issue、
Implementation owner；旧分支不为补标签而改名，只回填 metadata/body。
使用 xiaofei-pr-delivery Skill，执行 delivery:identity、delivery:check、delivery:head，
以最终精确 Head SHA 核对 GitHub Quality、Vercel、Neon 和人工 Preview。

未经明确同意，不 merge、不晋级 main、不改 Production 配置/数据、不删除别人的分支或
Preview，不暴露 Secret。交接写明 Issue、Owner、文件/契约、验证、SHA、PR/Preview、
风险、受保护路径和下一步。会话交接时保留 origin，只更新 manager，并在父 Issue
评论记录旧/新会话、精确 SHA、工作树、受保护路径和剩余动作。
```

## 9. 接管完成条件

- 已重新核对 GitHub、Multica 和环境事实；
- 已声明 `CX-xxxxxxxx`，且父 Issue 与 PR 的 Origin/Managing session 一致；
- 已声明唯一 Feature/Issue 和不会触碰的路径；
- 已确认最小闭环方案、Owner 和串行依赖；
- 实现使用隔离 checkout 和最新 `origin/uat`；
- PR、Preview、Quality 和 UAT 证据均可追溯到精确 Head SHA。
