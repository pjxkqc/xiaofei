# FLY-116 三阶段知识闭环 Preview 验收

本指南用于验收单一“知识与托管”入口。验收对象必须是 PR 当前精确 head 对应的
Vercel Preview 与独立 Neon Preview branch；不得在 UAT 或 Production 上执行。

## 前置证据

开始前记录以下信息，并核对三者指向同一 PR head：

- Draft PR、base `uat`、完整 head SHA；
- GitHub Quality run 与结论；
- Vercel deployment、branch alias、`githubCommitSha`、`READY`；
- Neon project、branch name/id、`ready`、non-primary、non-default；
- Organization A（有商户资料）和 Organization B（空白隔离对照）。

## 验收路径

### 1. 知识准备

1. 以 Organization owner/admin 登录，只从侧栏“知识与托管”进入
   `/knowledge?stage=prepare`。
2. 确认主路径只有“知识准备 → 测试与修正 → 验收与托管”三阶段；平台兜底知识只读。
3. 上传一份覆盖产品、使用、网络、售后的完整商户文档，执行“一键准备 Test CA”。
4. 确认当前源文档的条目被启用，缺失 KU 被生成并发布为 eligible revision，随后创建
   Test CA；记录平台/商户成员数与 CA Version。此时 Active 不得变化。

### 2. 多轮 Test CA 与持久化状态

1. 进入 `/knowledge?stage=test`，在同一 Test session 连续测试至少三轮：
   明确产品问题 → 缺少主语的短跟进 → 基于前文继续追问。
2. 刷新页面后继续第四轮，确认服务端 `ConversationState`、session、固定 Test CA 和上下文
   均未丢失。
3. 每轮记录 TestTurn、session、CA Version、命中来源和 KU Revision；商户问题必须优先命中
   具体商户知识，不能被宽泛平台关键词抢占。

### 3. 单条回答修正与同题复测

1. 选择一条命中商户知识的回答并提交修正后的商户口径。
2. 核对系统保留 source TestTurn/answer/CA/KU Revision，并生成新的 KU Revision、Test CA 和
   rerun TestTurn；Before/After 技术证据默认折叠但可展开。
3. 修正前 Active 仍保持原版本。使用同一问题复测，确认新回答采用修正后的知识且 Test CA
   成员关系展示 KU Revision ↔ CA Version 多对多复用。
4. 再选择一条平台兜底或未命中的回答，确认页面显示“补充为商户知识并修正”；提交后应新增
   商户 KU Revision 并追加到新 Test CA，平台 KU 不变，随后自动完成同题 Before/After 复测。

### 4. 人工验收与托管

1. 进入 `/knowledge?stage=hosting`，验收前确认 Active/Test diff 非零且“启用托管”不可用。
2. 人工验收 Test CA 后确认 Active=Test，再启用托管。
3. 刷新后确认“Test CA 已验收”、Active/Test 成员一致、托管状态仍为启用。

### 5. 兜底、未知与人工接管

在 Test CA 中分别验证并记录 TestTurn：

- 仅由平台基线覆盖的问题：返回安全且有用的兜底答案；
- 完全未知的问题：澄清或标记待关注，不编造；
- 投诉、明确要求人工等高风险问题：`risk=high`、`nextAction=stop`，回复进入人工接管。

### 6. 多租户与旧入口

1. 切到 Organization B，确认看不到 A 的文档、KU revision、CA、test session、intervention、
   binding 或托管状态。
2. 逐一访问以下旧 URL，确认只重定向到新工作台且没有循环：

   - `/knowledge/entries` → `/knowledge?stage=prepare`
   - `/knowledge/units`、`/knowledge/capabilities`、`/knowledge/documents` →
     `/knowledge?stage=advanced`
   - `/agent-settings` 及其 `general`、`fallback`、`status` 子页 →
     `/knowledge?stage=advanced`
   - `/chatbot` → `/knowledge?stage=test`

3. 桌面与窄屏均确认三阶段顺序、主动作和折叠技术证据可读。

### 7. 交付与运行日志

1. 在最终未变更 head 上运行 `pnpm delivery:head` 与 `pnpm delivery:check`。
2. 等待该 SHA 的 GitHub Quality 与 Vercel Preview 完成。
3. 扫描最终 deployment 日志，确认无 HTTP 5xx、cross-tenant、transaction timeout、
   internal server error；已知依赖级 SSL deprecation warning 单独记录，不得混同应用错误。
4. 将完整 SHA、云端资源、TestTurn/session/CA/KU/intervention ID 和结论写入 FLY-123 与
   PR #40。SHA 不写死在本文件中，以免文档提交造成自引用失效。

## 2026-08-05 基准执行记录

以下记录用于复核验收链条，不替代最终精确 head 的 PR/FLY-123 交付记录：

- Organization A：`FLY-116 P0 验收商户 A`（`fly-116-p0-a`）；Organization B：
  `FLY-116 P0 验收商户 B`（`fly-116-p0-b`）。
- Test CA 成员：平台兜底 9、商户资料 4；人工验收后 Active=Test，托管已启用。
- 持久化 session：`f14218fc-7e0e-424a-940f-19feebb1305d`；四轮 TestTurn：
  `cmsfbaokc000004kwb8u8glwf`、`cmsfbbg9a000104kwkq5aacqe`、
  `cmsfbc94m000204kw7vahudua`、`cmsfbdtnv000004i876as182p`。刷新后第四轮仍承接
  房间面积与 2.4 GHz 上下文。
- 修正：source TestTurn `cmsfbdtnv000004i876as182p` → rerun TestTurn
  `cmsfbfamb000i04i8l5zg46as`；CA `cmsfat20h001304juqqw08c9s` →
  `cmsfbf1r1000204i8sc65k5mp`；KU Revision `cmsfasyge000m04juz6cfonai` →
  `cmsfbf11x000104i8sfzk8kko`；intervention `cmsfbf23v000g04i86uixep7e`。
- 平台兜底、未知澄清、高风险人工接管 TestTurn 分别为
  `cmsfbh9y5000j04i8q3asfcs5`、`cmsfbhurx000k04i8des5g280`、
  `cmsfbii6a000l04i862epqh3c`。
- Organization B 保持 platform/merchant/TestTurn 均为 0、hosting=false；最终 Preview
  日志扫描未发现 5xx、超时、隔离或非 SSL 应用错误。
