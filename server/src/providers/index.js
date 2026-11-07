/**
 * Provider 适配器注册表（契约§6）
 * 适配器统一接口：validateConfig(config) / generate(input, config) / poll?(remoteJobId, config)
 */
'use strict';

const { mockAdapter } = require('./mock');
const { openaiCompatibleAdapter } = require('./openai_compatible');
const { ApiError } = require('../utils/respond');

const ADAPTERS = {
  mock: mockAdapter,
  openai_compatible: openaiCompatibleAdapter,
};

const ADAPTER_TYPES = Object.keys(ADAPTERS);

function getAdapter(type) {
  const a = ADAPTERS[type];
  if (!a) throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `未知的适配器类型：${type}（可选：${ADAPTER_TYPES.join(' / ')}）`);
  return a;
}

module.exports = { getAdapter, ADAPTER_TYPES, ADAPTERS };
