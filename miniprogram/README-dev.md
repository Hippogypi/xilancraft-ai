# miniprogram/README-dev —— 小程序开发与调试环境说明

> 对应 WBS 01.06：模拟器与真机环境差异说明。后端契约见 `shared/api-contract.md`，UI 规格见 `shared/UI-SPEC.md`。

## 1. 用微信开发者工具打开本项目

1. 打开微信开发者工具 → 导入项目 → 目录选择 **本 `miniprogram/` 目录**（不是仓库根目录）。
2. AppID：
   - 仓库内的 `project.config.json` 使用占位值 `"touristappid"`（GitHub secret 扫描要求，不入真实值）。
   - 真实测试号 AppID 保存在 `miniprogram/project.private.config.json`（已被 `.gitignore` 忽略、不会提交；开发者工具会**优先读取**该文件）。若本机没有此文件，请向项目负责人索取 AppID 后自行创建，内容形如：
     ```json
     { "appid": "wxXXXXXXXXXXXXXX", "projectname": "xilankapu-workshop" }
     ```
3. 「详情 → 本地设置」勾选：**不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**（本地后端为 http://127.0.0.1:3000，非 https）。

## 2. 后端地址唯一维护处

`miniprogram/config/env.js`

```js
module.exports = {
  BASE_URL: 'http://127.0.0.1:3000',
  REQUEST_TIMEOUT: 15000
};
```

所有请求经 `services/api.js` 统一发出，页面代码中不出现散落的服务地址。

## 3. 模拟器（开发者工具，默认演示模式，模式 A）

- 微信开发者工具的模拟器运行在电脑本机，`127.0.0.1` 即电脑自身。
- 启动后端：仓库根目录 `server/`（见根 README），默认监听 `3000` 端口。
- 模拟器中 `wx.request` 可直接访问 `http://127.0.0.1:3000`（需勾选上面的「不校验合法域名」）。
- 跨域、HTTPS、域名备案等限制在开发者工具中均不生效，是比赛现场演示的默认方式。

## 4. 真机预览 / 真机调试（模式 B）

**手机的 `127.0.0.1` 指向手机自己，不是电脑**，因此必须改地址：

1. 电脑查询局域网 IP：Windows `ipconfig` → 取 `IPv4 地址`（如 `192.168.1.100`）。
2. 修改 `config/env.js`：`BASE_URL: 'http://192.168.1.100:3000'`。
3. 手机与电脑连接**同一 Wi-Fi / 热点**；确认电脑防火墙放行 3000 端口入站。
4. 使用「真机调试」（推荐，自动走调试通道且不校验域名）或「预览」（需在工具中勾选「不校验合法域名」，仅开发版/体验版有效）。

### 微信对 request 的域名限制（重要）

- **正式发布**的小程序只允许访问 `https://` 且已在小程序后台配置为「request 合法域名」的地址，域名必须经过 ICP 备案，且不接受 IP 地址与端口（仅 443）。
- 本项目是**比赛演示**，不发布上线：只使用开发者工具 + 真机调试模式，「不校验合法域名」仅对开发版生效——因此**不能**把「关闭域名校验」当作正式部署方案（规格书 §4.3 模式 B 的约束）。
- 演示结束后如需恢复 `127.0.0.1`，记得改回 `config/env.js`（此文件在 git 内，请勿提交真机调试用的局域网 IP 修改）。

## 5. 目录速览

```
miniprogram/
├─ app.js / app.json / app.wxss     # 入口、路由（4 tab + 7 admin 页）、主题 token
├─ project.config.json              # appid=touristappid 占位（真实值在 private 配置）
├─ config/env.js                    # BASE_URL 唯一维护处
├─ services/api.js                  # Promise 化请求 + 契约包络解析 + 错误码中文映射
├─ services/admin-auth.js           # 管理端 token 存取（storage key: xl_admin_token）
├─ utils/tap-secret.js              # 隐藏管理入口：2 秒连点 5 次
├─ components/xl-*                  # 7 个通用组件
├─ assets/data/*.json               # 本地素材（纹样 / 服装模板），不走后端
└─ pages/
   ├─ heritage/  inspiration/  workshop/  customization/   # 四 tab 用户端
   └─ admin/    login → home → providers(-edit) / generations / orders(-detail)
```

## 6. 常见问题

| 现象 | 原因与处理 |
|---|---|
| 请求失败 `url not in domain list` | 未勾选「不校验合法域名」，见 §1 步骤 3 |
| 真机请求超时 | BASE_URL 未改为电脑局域网 IP，或手机/电脑不在同一网络，或防火墙拦截 |
| 管理页一直跳登录 | 未登录或 token 过期（24h）；重新走 heritage 页标题连点 5 次 → 登录 |
| 找不到页面/组件 | 检查 `app.json` 的 pages 与页面 json 的 usingComponents 路径 |
| 素材图不显示 | `assets/data/*.json` 的 image 字段当前为空串，UI 显示占位色块，属预期（阶段 4 填图） |
