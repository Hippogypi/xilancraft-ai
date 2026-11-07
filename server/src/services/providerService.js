/**
 * Provider 配置服务：查询/序列化（密钥只回hasApiKey）/解密构建适配器配置
 */
'use strict';

const config = require('../config/env');
const { getDb } = require('../db');
const { ApiError } = require('../utils/respond');
const { decryptSecret } = require('../utils/crypto');

/** 当前激活的Provider（至多一个），无则返回null */
function getActiveProviderRow() {
  return getDb().prepare('SELECT * FROM providers WHERE active=1 ORDER BY created_at DESC LIMIT 1').get() || null;
}

function getProviderRow(id) {
  return getDb().prepare('SELECT * FROM providers WHERE id=?').get(id) || null;
}

/** 对外序列化：snake→camel，绝不输出 encrypted_api_key（契约§7红线） */
function serializeProvider(row) {
  let settings = {};
  try {
    settings = JSON.parse(row.settings_json || '{}');
  } catch (e) {
    settings = {};
  }
  return {
    id: row.id,
    name: row.name,
    adapterType: row.adapter_type,
    baseUrl: row.base_url || '',
    modelId: row.model_id || '',
    hasApiKey: Boolean(row.encrypted_api_key),
    settings,
    enabled: !!row.enabled,
    active: !!row.active,
    lastTestStatus: row.last_test_status,
    lastTestAt: row.last_test_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseSettings(json) {
  try {
    return JSON.parse(json || '{}');
  } catch (e) {
    return {};
  }
}

/**
 * 构建传给适配器的运行时配置（含解密后的明文密钥，仅在服务端内存中存在）。
 * 解密失败（SECRET_KEY变更）抛 400 PROVIDER_CONFIG_INVALID，提示重新录入。
 */
function buildProviderConfig(row) {
  let apiKey = '';
  if (row.encrypted_api_key) {
    try {
      apiKey = decryptSecret(row.encrypted_api_key, config.dataKey);
    } catch (e) {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', e.message.includes('解密') ? e.message : '无法解密已保存的API Key，请重新录入');
    }
  }
  const settings = parseSettings(row.settings_json);
  const timeoutMs = settings.timeout ? settings.timeout * 1000 : config.GENERATION_TIMEOUT_MS;
  return {
    baseUrl: row.base_url || '',
    modelId: row.model_id || '',
    apiKey,
    settings,
    timeoutMs,
  };
}

module.exports = { getActiveProviderRow, getProviderRow, serializeProvider, buildProviderConfig, parseSettings };
