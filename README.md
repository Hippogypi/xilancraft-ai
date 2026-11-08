# 西兰卡普非遗纹样 AI 服装定制工坊（比赛 Demo）

土家族西兰卡普织锦 × AI 纹样共创 × 服装定制模拟订单。微信**原生**小程序 + 本地 Node.js 服务，总预算 0 元，不涉及真实支付与生产履约。

**核心验收能力：评委现场输入新提示词 → 真实 AI 模型（智谱 CogView）返回新图 → 服装叠加预览 → 模拟订单 → 管理端可见全链路。**

## 架构

```text
微信原生小程序（用户端4Tab + 隐藏管理端）
  │ HTTP (127.0.0.1:3000)
  ▼
Node.js 22 + Express（server/，依赖仅 express + sharp）
  ├─ 管理员鉴权（Bearer会话/登录限试/密码哈希）
  ├─ Provider 配置中心（密钥AES-256-GCM加密，热切换）
  ├─ AI 任务编排 + 适配层（openai_compatible=智谱CogView / mock）
  ├─ 生成图自动抠底（sharp边缘泛洪，纯白背景图案稿→透明PNG，同步保留 .src 原图快照）
  ├─ SQLite（node:sqlite，零依赖）：providers / generation_jobs / orders
  ├─ 生成图片落盘 data/generated/（重启不丢）
  └─ 静态资源 /api/assets/（织机MP4等，不占小程序包体）
```

## 快速启动（演示电脑）

前置：微信开发者工具（已装于演示机）；其余依赖仓库自带（便携 Node 在 `tools/`，gitignore，换机需重放：下载 [node v22 win-x64 zip](https://nodejs.org/dist/latest-v22.x/) 解压到 `tools/node`）。

```bash
# 1. 启动后端（Git Bash）
source scripts/use-node.sh
cd server && npm install        # 首次；仅 express 一个依赖
cp .env.example .env            # 首次；可改 ADMIN_PASSWORD
npm start                       # 或 node src/index.js
# 验证：curl http://127.0.0.1:3000/api/health → {"success":true,...}

# 2. 小程序
# 微信开发者工具 → 导入项目 → 目录选 <仓库>/miniprogram
# （AppID 自动读 project.private.config.json 的测试号）
# 详情 → 本地设置 → 勾选「不校验合法域名」
```

管理员入口：**非遗导览页 logo「西兰卡普」文字 2 秒内连点 5 次** → 登录页（默认 `admin` / `.env` 中的密码，默认 `xilankapu-demo`）。

全量 API 回归：`bash scripts/test-api.sh`（32 项断言：鉴权/SSRF/生成/订单/持久化/锁定）。

## 切换到真实 AI（演示前必做一次）

1. 管理端登录 → 「AI 接口配置」→ 新增配置（二选一或都建、择一激活）：
   - **智谱（纯文生图）**：类型 `openai_compatible`；Base URL `https://open.bigmodel.cn/api/paas/v4`
     - 模型 ID `cogview-3-flash`（**免费**）或 `cogview-4`（**约 0.06 元/张，效果更好**，需账户有余额，充 10 元可生成约 160 张）
   - **硅基流动（文生图 + 纹样图生图）**：类型 `openai_compatible`；Base URL `https://api.siliconflow.cn/v1`
     - 模型 ID `Kwai-Kolors/Kolors`（**免费**，限速）；用户选择参考纹样时自动携带纹样底图走图生图（`images/edits`，重构强度默认 0.55，可在 Provider settings 的 `strength` 调整 0.05~0.95；`img2img:false` 可整体关闭图生图）
   - API Key：对应平台密钥（仅加密存于服务端 SQLite，接口只回 `hasApiKey`）
2. 「测试生成」→ 出图且耗时正常 → 「激活」
3. 用户端任意新提示词即真实生图；额度耗尽（429）时管理端可即时切换其他配置，**无需改前端代码**

**纹样图生图**：`scripts/prepare-motif-bases.js` 将 6 条传统纹样预处理为 1024×1024 规范底图（白底 letterbox + 中值滤波去织物噪）存于 `server/public/assets/motif-bases/`（换机/改素材后重跑一次即可）。用户在工坊选择参考纹样且激活的 Provider 支持 `images/edits` 时，后端携带底图请求图生图，模型"看着"原纹样做现代化重构；4 条现代转译纹样无底图，自动走纯文生图。

**透明底机制**：生图模型均不输出透明通道。本项目的方案：提示词模板 **v6.1b**（v6.1 基线回退版：单徽章式视觉语言 + 补强内部纯色约束"大面积连续均匀纯色块填充、区域单色"；【设计主题】用户原文置顶、【参考纹样】名称+patternCore 短骨架、【配色】中文色名；服务端另有 `sanitizePrompt` 注入短语黑名单清洗）→ 落盘前**质检门闩**（边缘采样：白底或纯色均匀底才判成功，风景/照片类偏离输出如实失败并留 `.src` 快照；Provider settings 加 `retryOnGateFail:true` 可自动重试一次，免费模型建议开启）→ sharp 边缘泛洪 v2.1 抠底：自适应容差、Alpha 向内羽化 1~2px、边缘去污染、**"AI生成"水印残片清理**，输出真 Alpha 透明 PNG。离线回归：`tools/node/node.exe scripts/test-bg-remove.js`。

## 目录

```text
miniprogram/  小程序：pages(heritage/inspiration/workshop/customization + admin×7)、components(xl-*)、services/api.js、assets(纹样/服装/图标/数据JSON)
server/       src/{routes,middleware,providers,services,db,utils,config}、public/assets(loom.mp4)、.env.example；data/ 运行时生成（gitignore）
shared/       api-contract.md（冻结API契约）、UI-SPEC.md（设计规格）
scripts/      use-node.sh、test-api.sh（E2E验收）
docs/         规格书V5.1、UI全景图、调度代办清单、演示与验收手册
assets_raw/   原始素材存档（gitignore）
```

## 素材替换指南

| 素材 | 位置 | 规格要求 |
|---|---|---|
| 织机视频 | `server/public/assets/loom.mp4` | H.264 MP4 ≤20MB，同名覆盖即生效 |
| 服装底图 | `miniprogram/assets/garments/*.png` + `assets/data/garments.js` | 透明底PNG；改图后同步更新该款 `printArea`(top/left/width/height 百分比) |
| 纹样图 | `miniprogram/assets/motifs/` + `assets/data/motifs.js` + `sources.md` | 每图≤300KB；sources.md 登记来源/授权（数据为 JS 模块，兼容全部基础库版本） |
| TabBar 图标 | `miniprogram/assets/tabbar/` | 81×81 PNG；可重跑 `node gen-icons.js` |

「现代转译」4 条素材默认无图（界面优雅占位）——可在演示机用真实 AI 生成后放入 `assets/motifs/` 并回填 JSON 的 `image` 字段。

## 安全要点

- 智谱 Key 只存服务端加密库；`.env`、`server/data/`、`tools/`、`assets_raw/`、`project.private.config.json`（含真实AppID）均已 gitignore，全 git 历史密钥扫描 0 命中
- Provider Base URL 有 SSRF 校验（拒私网/环回）；上传有魔数与大小校验；图片路由防路径穿越
- 登录失败 5 次锁 10 分钟（重启服务即清）；订单必须主动勾选隐私声明

## 已知限制

- 小程序端请求超时 15s：cogview-3-flash 通常 5~8s 出图，正常；若上游偶发超 15s，管理端「测试生成」仍可验证（服务端超时上限 120s）
- 真机演示（模式B）需：BASE_URL 改电脑局域网 IP、手机同 Wi-Fi、真机调试模式勾选「不校验合法域名」；建议以开发者工具模拟器为主演示环境（模式A）
- 免费额度策略：默认每日 50 次/Provider，全局冷却 3s，不自动重试，避免意外计费

更多：需求与技术规格见 `docs/西兰卡普AI服装定制工坊_需求WBS与技术规格_V5.1.md`；现场演示步骤见 `docs/演示与验收手册.md`。
