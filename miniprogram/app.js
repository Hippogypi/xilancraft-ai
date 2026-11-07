/**
 * app.js —— 全局入口
 * apiBase 统一引自 config/env.js（后端地址唯一维护处，见 shared/api-contract.md §1）
 */
const env = require('./config/env.js');

// 版本号常量（阶段2底座）
const APP_VERSION = '0.1.0-stage2';

App({
  globalData: {
    apiBase: env.BASE_URL,
    version: APP_VERSION,
    /**
     * 跨页传参（switchTab 无法带 URL 参数，经由 globalData 传递并即时消费）：
     * - pendingMotif：灵感素材页 → 工坊页（参考纹样：{ id, name, keywords }）
     * - pendingPattern：工坊页 → 定制页（生成结果：{ jobId, imageUrl, prompt }）
     */
    pendingMotif: null,
    pendingPattern: null
  },
  onLaunch() {
    // 阶段2底座：暂无启动期请求；阶段3可在此做 /api/health 预检
  }
});
