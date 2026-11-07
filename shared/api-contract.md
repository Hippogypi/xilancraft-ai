# API 契约（冻结版 v1）

> 前后端唯一依据。变更须经主控调度 Agent 修改本文件后再实施。
> 依据：规格书 §5/§6/§8 + 决策基线（见 docs/调度agent_开发代办清单.md）。

## 1. 基础约定

- Base URL：开发/演示 `http://127.0.0.1:3000`（小程序端在 `miniprogram/config/env.js` 中统一维护）
- Content-Type：`application/json`（上传接口除外，multipart/form-data）
- 每个响应带 `requestId`（服务端生成，响应头 `X-Request-Id` 同值）
- 统一响应包络：

```json
// 成功
{ "success": true, "data": { ... }, "requestId": "req-..." }
// 失败
{ "success": false, "error": { "code": "GENERATION_FAILED", "message": "人类可读信息" }, "requestId": "req-..." }
```

- HTTP 状态码：200 成功；400 参数错误；401 未登录/凭证失效；403 无权限；404 不存在；429 限频/额度；500 服务端错误；504 上游超时。

## 2. 错误码表

| code | HTTP | 含义 |
|---|---|---|
| VALIDATION_ERROR | 400 | 参数校验失败（message 指明字段） |
| AUTH_INVALID_CREDENTIALS | 401 | 用户名或密码错误 |
| AUTH_LOCKED | 429 | 登录失败次数过多，暂时锁定 |
| AUTH_REQUIRED | 401 | 未携带/失效的管理员会话 |
| NOT_FOUND | 404 | 资源不存在 |
| PROVIDER_NOT_ACTIVE | 409 | 无激活的 Provider，请管理员配置 |
| PROVIDER_CONFIG_INVALID | 400 | Provider 配置不合法（URL/模型/密钥缺失） |
| PROVIDER_UNREACHABLE | 502 | 上游无法访问 |
| GENERATION_FAILED | 502 | 上游返回失败/非图片内容 |
| GENERATION_TIMEOUT | 504 | 超过超时上限 |
| RATE_LIMITED | 429 | 触发限频（防连点/冷却） |
| DAILY_QUOTA_EXCEEDED | 429 | 当日调用上限已到 |
| UPLOAD_REJECTED | 400 | 上传文件类型/大小不合法 |
| INTERNAL_ERROR | 500 | 服务端异常（脱敏信息） |

## 3. 鉴权

- 管理员账号首次启动时由 `.env` 的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 初始化，密码以 SHA-256 加盐哈希存库；`.env` 只作首启种子。
- `POST /api/admin/login` 成功返回随机 token（32 hex）；后续管理请求带 `Authorization: Bearer <token>`。
- 会话内存存储、24h 过期；logout 即失效；登录失败 5 次锁 10 分钟。
- 普通用户端接口（generations/uploads/orders/images）无需鉴权（演示简化，已在规格书允许范围内）。

## 4. 端点清单

### 公开

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | /api/health | `{status:"ok", uptime, db:"ok", activeProvider}` |
| POST | /api/admin/login | body `{username, password}` → `{token, expiresAt}` |

### 管理员（Bearer）

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | /api/admin/logout | 注销当前 token |
| GET | /api/admin/providers | 列表：含 `hasApiKey`，**绝不含密钥** |
| POST | /api/admin/providers | 新增（见 §5 providers 字段） |
| PATCH | /api/admin/providers/:id | 修改；`apiKey` 留空=不变，填新值=替换 |
| DELETE | /api/admin/providers/:id | 删除（激活项不可删，先停用） |
| POST | /api/admin/providers/:id/test | 用 1 条固定测试提示词真实生成，返回 `{status, durationMs, imageUrl?, error?}`，并更新 last_test_* |
| POST | /api/admin/providers/:id/activate | 原子激活（其余自动置 inactive） |
| GET | /api/admin/generations?status=&page=&pageSize= | 生成记录分页（默认 20/页） |
| GET | /api/admin/generations/:id | 记录详情（提示词/模型/状态/结果图/错误码） |
| GET | /api/admin/orders?status=&keyword=&page= | 订单分页，keyword 匹配订单号/姓名 |
| GET | /api/admin/orders/:id | 订单详情 |
| PATCH | /api/admin/orders/:id/status | body `{status}`，仅允许 pending→confirming→completed 单向流转 |
| GET | /api/admin/stats | （P2）`{totalGenerations, successRate, totalOrders}` |

### 用户端

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | /api/generations | 提交生成任务，body 见下 |
| GET | /api/generations/:id | 轮询任务状态 |
| POST | /api/uploads/reference | multipart 字段 `file`（JPG/PNG ≤5MB）→ `{imageId, url}` |
| POST | /api/orders | 提交模拟订单，body 见下 |
| GET | /api/images/generated/:file | 生成图片（落盘产物） |
| GET | /api/images/uploads/:file | 参考图 |

> 素材库纹样与服装模板为**小程序本地 JSON**（`miniprogram/assets/data/`），不走后端。

**POST /api/generations 请求：**

```json
{
  "mode": "text_to_image",
  "prompt": "最终组装后的完整提示词（前端已按重构模板拼装）",
  "style": "modern_streetwear",
  "size": "1024x1024",
  "referenceMotifId": "motif-bird-001"  // 可空；近似图生图：后端把该纹样关键词注入提示词
}
```

响应 `{jobId, status}`；轮询 `GET /api/generations/:id`：

```json
{ "jobId": "...", "status": "succeeded", "imageUrl": "/api/images/generated/xxx.png", "modelId": "cogview-3-flash" }
// 失败：{ "status": "failed", "error": { "code": "...", "message": "..." } }
```

状态机：`queued → running → succeeded | failed`。前端轮询间隔 2s、最长 150s（后端超时默认 120s）。

**POST /api/orders 请求：**

```json
{
  "customerName": "演示用户", "contact": "13800000000",
  "garmentTemplateId": "hoodie-001", "size": "L", "quantity": 1,
  "generationJobId": "job-uuid",
  "placement": { "scale": 1.0, "offsetX": 0, "offsetY": 0, "opacity": 1.0 },
  "privacyAccepted": true
}
```

响应 `{orderNo: "XLKP-20261108-XXXX"}`。后端校验：privacyAccepted 必须 true；generationJobId 必须存在且 succeeded；garmentTemplateId 非空字符串。pattern_image 取该 job 的落盘图快照引用。

## 5. 数据模型（SQLite，见规格书 §5）

表：`providers`、`generation_jobs`、`orders`、`admin_users`、`sessions`（可内存代替）。
- providers：id(uuid)/name/adapter_type(`openai_compatible`|`mock`)/base_url/model_id/encrypted_api_key/settings_json/enabled/active/last_test_status/last_test_at/created_at/updated_at
- generation_jobs：id/provider_id/model_id/prompt/reference_image_path/status/remote_job_id/output_image_path/error_code/error_message/started_at/finished_at
- orders：id/order_no/customer_name/contact/garment_template_id/size/quantity/generation_job_id/pattern_image_path/placement_json/status/privacy_accepted_at/created_at/updated_at
- 时间戳一律 ISO8601 文本。

## 6. Provider 适配层

```ts
interface ImageProviderAdapter {
  validateConfig(config): Promise<void>;        // URL 协议/私网拦截(SSRF)/模型必填
  generate(input, config): Promise<
    | { kind: 'completed'; imageBytes: Buffer; mimeType: string }
    | { kind: 'pending'; remoteJobId: string }>;
  poll?(remoteJobId, config): Promise<...);     // 同步协议可不实现
}
```

- `openai_compatible`：目标智谱 `https://open.bigmodel.cn/api/paas/v4`，POST `/images/generations`，Bearer Key，body `{model, prompt}`（cogview-3-flash 免费；cogview-4 支持 size）。同步返回 `{data:[{url}]}` → 下载落盘。**实现前先以官方文档核实协议字段。**
- `mock`：程序化生成一张西兰卡普风格几何 PNG（纯 Node zlib 编码，无外部依赖），立即完成，供开发联调。
- SSRF 防护：仅 http/https；解析后拒绝私网/环回/链路本地地址（127/8、10/8、172.16/12、192.168/16、169.254/16、::1）。
- 成本护栏：单任务不自动重试；每 Provider 可设 `settings_json.dailyLimit`（默认 50）与全局冷却 3s。

## 7. 安全红线

- API Key 仅存服务端（AES-256-GCM 加密，密钥来自 `.env` `SECRET_KEY`）；接口只回 `hasApiKey`；日志/错误信息不含密钥与完整鉴权头。
- `.env`、`server/data/`、生成图片目录一律不入 git。
