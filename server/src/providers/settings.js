/**
 * Provider settings_json 公共校验（避免 mock/index 循环依赖而独立成模块）
 * settings 形状：{ timeout?: 秒(5..300), dailyLimit?: 次(1..10000), size?: "WxH",
 *                 strength?: 图生图重构强度(0.05..0.95，默认0.55),
 *                 img2img?: 是否启用图生图(布尔，默认true；不支持edits端点的Provider可关),
 *                 retryOnGateFail?: 质检门闩失败自动重试一次(布尔，默认false；免费模型建议开启) }
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
  if (settings.strength !== undefined) {
    const s = Number(settings.strength);
    if (!Number.isFinite(s) || s < 0.05 || s > 0.95) {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', 'settings.strength 必须为 0.05~0.95 的小数（图生图重构强度，默认0.55）');
    }
  }
  if (settings.img2img !== undefined && typeof settings.img2img !== 'boolean') {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', 'settings.img2img 必须为布尔值（是否启用纹样图生图）');
  }
  if (settings.retryOnGateFail !== undefined && typeof settings.retryOnGateFail !== 'boolean') {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', 'settings.retryOnGateFail 必须为布尔值（质检门闩失败时是否自动重试一次）');
  }
  return settings;
}

module.exports = { validateSettingsShape };
