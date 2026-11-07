# 西兰卡普非遗纹样 AI 服装定制工坊（比赛 Demo）

土家族西兰卡普织锦 × AI 纹样共创 × 服装定制模拟订单——微信原生小程序 + 本地 Node.js 服务，总预算 0 元。

## 仓库结构

```text
miniprogram/   微信原生小程序（用户端 4 Tab + 隐藏管理端）
server/        Node.js + Express + SQLite（AI Provider 代理/订单/鉴权）
shared/        冻结的 API 契约与 UI 规格（前后端共同依据）
docs/          规格书、UI 全景图、调度代办清单
assets_raw/    原始素材（gitignore，处理后进 miniprogram/assets）
tools/         便携 Node.js（gitignore）
```

## 快速启动

```bash
# 1. Node（仓库已带便携版，不入库的机器需先放置 tools/node）
source scripts/use-node.sh   # Git Bash；CMD 用 scripts\node-env.bat
node -v                       # 应显示 v22.x

# 2. 后端
cd server && npm install && cp .env.example .env && npm run dev
# 健康检查：curl http://127.0.0.1:3000/api/health

# 3. 小程序：微信开发者工具导入 miniprogram/ 目录（AppID: 测试号）
```

## 文档

- 需求与技术规格：`docs/西兰卡普AI服装定制工坊_需求WBS与技术规格_V5.1.md`
- 开发进度清单：`docs/调度agent_开发代办清单.md`
- API 契约：`shared/api-contract.md`｜UI 规格：`shared/UI-SPEC.md`

> 完整启动/演示/素材替换说明在交付阶段（WBS 12.07）补全。
