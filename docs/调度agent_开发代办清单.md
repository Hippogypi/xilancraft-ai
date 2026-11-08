# 调度 Agent 开发代办清单

> 项目：西兰卡普非遗纹样 AI 服装定制工坊（比赛 Demo，不实际上线）
> 主控：ZCode 调度 Agent（负责任务派遣、代码审查、验收、提交推送）
> 仓库：`github.com/Hippogypi/xilancraft-ai`（main 小步直推）
> 基线规格：`docs/西兰卡普AI服装定制工坊_需求WBS与技术规格_V5.1.md`
> UI 基准：`docs/西兰卡普AI定制服装工坊界面全景.png`（提炼稿：`shared/UI-SPEC.md`）
>
> **用法**：每完成一项勾选 `[x]`，并在「变更记录」登记提交号；发现新事项追加到对应阶段末尾。

---

## 〇、决策基线（已锁定，不再讨论）

- [x] 生图 API：智谱 CogView，`openai_compatible` 生图协议；默认模型 **`cogview-3-flash`（免费）**，管理端可切 `cogview-4`（付费慎用）；开发期用 mock 适配器
- [x] 小程序 AppID：测试号（真实值存 `miniprogram/project.private.config.json`，gitignore 不入库；仓库内 `project.config.json` 用 `touristappid` 占位。GitHub 曾对其误报 secret，已按测试用途关闭告警）
- [x] 砍掉：TD 纹样动画（WBS 02.04 / 11.02，纯装饰）
- [x] 图生图（P1）：智谱无免费图生图 → 实现为「选参考纹样→关键词注入文生图提示词」的近似方案，真·图生图留 Provider 扩展位
- [x] Git 策略：main 分支小步直推，conventional commits
- [x] 环境：本机无 Node → 便携版 Node.js LTS 装至 `tools/node`（gitignored）；微信开发者工具 CLI 不可用 → 每阶段产出人工验证清单由用户执行
- [x] 素材获取：全部由开发方（subagent）负责整理入库；智谱 API Key 用户已持有（不入仓库、不发聊天，演示时管理端录入）

---

## 一、阶段 0：基线（主控自做）

- [x] 0.1 提交现有 docs（V5.1 规格书 + UI 全景图 + 删除旧版文档）并推送
- [x] 0.2 素材归位：`loom_weaving.mp4`、`白色服装透明底单件素材_15件/` → `assets_raw/`（gitignored）
- [x] 0.3 下载便携 Node.js LTS 至 `tools/node`，验证 `node -v` / `npm -v` 可用（v22.23.4 / npm 10.9.9）
- [x] 0.4 建仓库骨架：`miniprogram/ server/ shared/ assets_raw/ tools/ scripts/` + `.gitignore`（node_modules、server/data、.env*、tools/、assets_raw/、project.private.config.json）
- [x] 0.5 冻结 API 契约 → `shared/api-contract.md`（依据规格书 §6，前后端唯一依据）
- [x] 0.6 提炼 UI 规格 → `shared/UI-SPEC.md`（设计 token + 各页布局）
- [x] 0.7 README 骨架（启动指南占位）
- [x] 0.8 提交推送：`chore: 工程骨架与契约基线`

## 二、阶段 1：后端纵切（1 个 subagent）

- [x] 1.1 Express 服务 + `/api/health` + 环境配置 + 统一响应/错误码/请求 ID/结构化日志（WBS 10.01/10.07）
- [x] 1.2 SQLite 初始化与迁移（用 Node 内置 `node:sqlite`，免原生编译）、事务安全（WBS 10.02）
- [x] 1.3 管理员登录：密码哈希、会话 token、登录限试、全管理接口鉴权 401/403（WBS 06.01/06.02、10.08）
- [x] 1.4 providers CRUD：密钥 AES-256-GCM 加密存储、「留空=不变」语义、只回 `hasApiKey`、激活原子切换（WBS 07.01/07.02/07.03/07.06）
- [x] 1.5 Provider 适配层：`zhipu`（openai_compatible 生图协议，先验证协议再编码）+ `mock`（开发/测试）+ SSRF 地址校验（WBS 07.04、10.03）
- [x] 1.6 生成任务：提交/查询/状态机（queued/running/succeeded/failed）、图片下载落盘 `data/generated`、超时与限频与每日上限（WBS 10.04/10.05、04.09、8.1）
- [x] 1.7 订单：唯一订单号、SQLite 持久化、状态流转、`generationJobId` 校验（WBS 09.01/09.03）
- [x] 1.8 上传参考图：类型/大小校验、安全路径（WBS 10.06）
- [x] 1.9 管理端查询接口：providers/generations/orders 列表详情（WBS 08.01/08.02/09.02/09.04）
- [x] 1.10 curl 验收脚本 + mock 走通全链路 + `.env.example`（`scripts/test-api.sh`，32 项断言全绿）
- [x] 1.11 审查验收后提交推送：`feat(server): P0 API 全量`

## 三、阶段 2：小程序底座（1 个 subagent）

- [x] 2.1 原生工程：`project.config.json`（AppID 占位 touristappid + 私有配置真实值）、`app.json` 四 Tab（非遗导览/灵感素材库/AI 工坊/服装定制）、`sitemap.json`（WBS 01.01）
- [x] 2.2 目录规范 `pages/ components/ services/ utils/ assets/` + 全局样式/主题变量（WBS 01.02/01.03）
- [x] 2.3 通用组件：xl-button/xl-card/xl-chips/xl-empty/xl-loading/xl-status-dot/xl-half-screen
- [x] 2.4 统一 API 客户端：环境配置（localhost:3000）、超时、统一错误处理、requestId（WBS 01.04）
- [x] 2.5 隐藏管理入口（首页 logo 连点 5 次）+ `pages/admin/*` 路由与未登录拦截（WBS 01.05）
- [x] 2.6 模拟器/真机环境差异说明（WBS 01.06，`miniprogram/README-dev.md` + `config/env.js` 注释）
- [x] 2.7 审查验收后提交推送：`feat(miniprogram): 底座`

## 四、阶段 3：P0 端到端（2 个 subagent 并行 + 主控联调）

**用户端（WBS 04 P0 + 05 P0）**
- [x] 3.1 AI 工坊：提示词输入、风格/配色/应用部位选择（04.01）
- [x] 3.2 西兰卡普重构型 Prompt 模板组装（04.02，utils/prompt-builder.js）
- [x] 3.3 生成请求 + 轮询 + 真实结果展示（04.03）
- [x] 3.4 五态处理：生成中/成功/失败/超时/额度不足，均有恢复操作（04.04）
- [x] 3.5 结果预览、重新生成、使用该纹样（04.05）
- [x] 3.6 服装模板选择 + 纹样印花区叠加预览（05.01/05.02）
- [x] 3.7 尺码/数量/款式 + 表单校验 + 模拟订单提示（05.04/05.05）
- [x] 3.8 隐私告知勾选，未勾选拦截（05.06）
- [x] 3.9 订单提交、成功页、订单号（05.07）

**管理端（WBS 06/07/08/09 界面）**
- [x] 3.10 管理员登录页 + 会话 + 退出（06.01/06.02）
- [x] 3.11 管理首页三入口（06.03）+ 统计卡（06.04 P2 提前完成）
- [x] 3.12 Provider 列表/新增/编辑、密钥掩码、测试连接/测试生成、激活切换、调用上限设置（07.01~07.08）
- [x] 3.13 生成记录列表/详情/筛选（08.02/08.04）
- [x] 3.14 订单列表/详情/状态流转（09.02/09.03）

**联调**
- [x] 3.15 主控：mock 全链路联调（后端E2E 32项 + 两agent冒烟）；开发者工具人工验证清单已交用户执行
- [x] 3.16 提交推送：`feat: P0 端到端闭环`

## 五、阶段 4：P1 内容与体验（2-3 个 subagent 并行）

- [x] 4.1 素材整理：织机 MP4（7.3MB ≤20MB，经服务端 `/api/assets/loom.mp4` 提供，不占包体）+ 15 件服装中精选 6 款 + 像素分析+视觉复核测量 `printArea`（WBS 11.01/11.03/11.04）
- [x] 4.2 传统纹样真实数字图像搜集：5 张真实图（四十八勾/阳雀花/台台花/马毕岩墙花/凤穿牡丹，共778KB）+ 来源登记 `sources.md`（WBS 03.06、11.05；注：蛇花无可信图源，以现代转译条目保留符号）
- [x] 4.2b TabBar 图标 8 张程序化生成（81×81 菱形系，normal/active 双态），已接入 app.json
- [x] 4.3 文化导览页：主视觉、西兰卡普历史/工艺/价值介绍、符号解构案例、织机 MP4 播放（封面+失败占位+重试）、跳转按钮（WBS 02.01/02.02/02.03/02.05）
- [x] 4.4 灵感素材库：素材 JSON、分类切换、详情弹层、传统/现代对比卡、「以此为灵感」带参跳转 AI 工坊（WBS 03.01~03.05，globalData 传递）
- [x] 4.5 工坊 P1：防重复点击/限频 UI、参考纹样关键词注入（近似图生图）、生成记录（04.06 近似方案/04.08/04.09，阶段3已实现）
- [x] 4.6 预览 P1：纹样位置/大小/透明度调节（05.03，阶段3已实现）；P2：Canvas 合成导出（05.08）——**未做**，属可选增强，演示不依赖
- [x] 4.7 管理首页统计卡片（06.04 P2，阶段3已实现）
- [x] 4.8 提交推送：`feat: P1 内容与体验`

## 六、阶段 5：验收交付（主控主导）

- [x] 5.1 AT-01~AT-14 验收矩阵：自动项已全过（test-api.sh 32断言复跑全绿）；人工项操作步骤见《演示与验收手册》，待用户开发者工具执行
- [x] 5.2 密钥泄露检查：全 git 历史智谱key格式/sk-前缀 0 命中；.env/.db 未被跟踪（AT-13 ✅）
- [x] 5.3 0 元审查：默认模型 cogview-3-flash 免费；每日50次上限+冷却3s+0自动重试；未启用任何付费服务
- [x] 5.4 README 完成：架构、启动、真实AI切换、素材替换、安全要点、已知限制
- [x] 5.5 演示脚本：docs/演示与验收手册.md（含AT矩阵/8分钟脚本/故障处置/备用剧本）
- [x] 5.6 tag `v0.1.0-demo` 最终推送

---

## 七、用户侧待办

- [x] 提供测试号 AppID（已转存私有配置文件，仓库内不再出现明文）
- [x] 注册智谱 API Key（已持有，演示时管理端录入）
- [x] 提供素材：织机 MP4 + 15 件服装透明底 PNG（已放仓库根目录，待归位 `assets_raw/`）
- [ ] 按各阶段「人工验证清单」在微信开发者工具中执行并反馈（阶段 2 起）

## 八、变更记录

| 日期 | 变更 | 关联提交 |
|---|---|---|
| 2026-11-08 | 计划定稿：砍 TD 动画；智谱 CogView；测试号 AppID；main 直推 | — |
| 2026-11-08 | 素材到位：loom_weaving.mp4（7.3MB）+ 白色服装透明底 15 件 | — |
| 2026-11-08 | GitHub secret 扫描误报测试号 AppID：文档改掩码、真实值移入 gitignore 的 project.private.config.json | 本次 |
| 2026-11-08 | 阶段 0 完成：便携 Node v22.23.4、骨架、API 契约与 UI-SPEC 冻结；开发者工具 CLI 位于 D:\Program Files (x86)\Tencent\微信web开发者工具 | 本次 |
| 2026-11-08 | 乱码修复：Windows Git Bash 下 curl 中文请求体经 GBK 损坏污染演示库（测试数据），test-api.sh 请求体 ASCII 化 + 新增 `scripts/reset-demo-data.js` 演示数据清理工具（顺带完成 WBS 09.05），库已重置并重建干净备用 Mock | 4e538d5 |
| 2026-11-08 | 用户实测修复：①素材库/定制页 require(*.json) 在用户基础库运行时异常 → 数据文件转为 JS 模块（motifs.js/garments.js，5处引用切换）；②生图输出照片风景 → Prompt 模板 v2 强化图案稿硬约束 | 本次 |
