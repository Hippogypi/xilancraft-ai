/**
 * Provider settings_json 公共校验（避免 mock/index 循环依赖而独立成模块）
 * settings 形状：{ timeout?: 秒(5..300), dailyLimit?: 次(1..10000), size?: "WxH" }
 */
'use strict';

const { ApiError } = require('../utils/respond');

function validateSettingsShape(settings) {
  if (settings == null) return {};
  if (typeof settings !== 'object' || Array.isArray(settings)) {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', 'settings 必须为JSON对象');
  }
  if (settings.timeout !== undefined) {
    const t = Number(settings.timeout);
    if (!Number.isFinite(t) || t < 5 || t > 300) {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', 'settings.timeout 必须为 5~300 的秒数');
    }
  }
  if (settings.dailyLimit !== undefined) {
    const d = Number(settings.dailyLimit);
    if (!Number.isInteger(d) || d < 1 || d > 10000) {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', 'settings.dailyLimit 必须为 1~10000 的整数');
    }
  }
  if (settings.size !== undefined && !/^\d{2,5}x\d{2,5}$/.test(String(settings.size))) {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', 'settings.size 格式必须为 宽x高，如 1024x1024');
  }
  return settings;
}

module.exports = { validateSettingsShape };
