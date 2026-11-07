/**
 * 契约端点（管理员）：
 * - GET    /api/admin/providers              列表（含hasApiKey，绝不含密钥）
 * - POST   /api/admin/providers              新增
 * - PATCH  /api/admin/providers/:id          修改（apiKey留空=不变）
 * - DELETE /api/admin/providers/:id          删除（激活项不可删）
 * - POST   /api/admin/providers/:id/test     固定提示词真实测试生成
 * - POST   /api/admin/providers/:id/activate 原子激活（其余自动置inactive）
 */
'use strict';

const express = require('express');
const config = require('../../config/env');
const { getDb } = require('../../db');
const { ok, ApiError } = require('../../utils/respond');
const { newId, encryptSecret } = require('../../utils/crypto');
const { getAdapter, ADAPTER_TYPES } = require('../../providers');
const { validateSettingsShape } = require('../../providers/settings');
const { getProviderRow, serializeProvider, buildProviderConfig, parseSettings } = require('../../services/providerService');
const { runProviderTest } = require('../../services/generation');
const { log } = require('../../utils/logger');

const router = express.Router();

const asStr = (v) => (typeof v === 'string' ? v.trim() : '');

// ---- 列表 ----
router.get('/', (req, res, next) => {
  try {
    const rows = getDb().prepare('SELECT * FROM providers ORDER BY created_at DESC').all();
    ok(req, res, { list: rows.map(serializeProvider) });
  } catch (e) {
    next(e);
  }
});

// ---- 新增：默认 enabled=0（规格07.07 未经验证的配置默认关闭）----
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = asStr(b.name);
    if (!name || name.length > 50) throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', '请填写配置名称（1~50字符）');
    const adapterType = asStr(b.adapterType);
    if (!ADAPTER_TYPES.includes(adapterType)) {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `适配器类型必须为：${ADAPTER_TYPES.join(' / ')}`);
    }
    const baseUrl = asStr(b.baseUrl);
    const modelId = asStr(b.modelId);
    const apiKey = asStr(b.apiKey);
    const settings = validateSettingsShape(b.settings === undefined || b.settings === null ? {} : b.settings);

    // 适配器级配置校验（含SSRF地址校验）
    await getAdapter(adapterType).validateConfig({ baseUrl, modelId, apiKey, settings });

    const id = newId('prov');
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO providers (id, name, adapter_type, base_url, model_id, encrypted_api_key, settings_json,
           enabled, active, last_test_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'untested', ?, ?)`
      )
      .run(
        id,
        name,
        adapterType,
        baseUrl || null,
        modelId || null,
        apiKey ? encryptSecret(apiKey, config.dataKey) : null,
        JSON.stringify(settings || {}),
        b.enabled === true || b.enabled === 1 ? 1 : 0,
        now,
        now
      );
    log('info', '新增Provider配置', { providerId: id, adapterType, name });
    ok(req, res, serializeProvider(getProviderRow(id)));
  } catch (e) {
    next(e);
  }
});

// ---- 修改：apiKey 留空/缺省 = 不变，非空 = 替换（契约§5）----
router.patch('/:id', async (req, res, next) => {
  try {
    const row = getProviderRow(req.params.id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Provider配置不存在');
    const b = req.body || {};

    let adapterType = row.adapter_type;
    if (b.adapterType !== undefined) {
      adapterType = asStr(b.adapterType);
      if (!ADAPTER_TYPES.includes(adapterType)) {
        throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `适配器类型必须为：${ADAPTER_TYPES.join(' / ')}`);
      }
    }
    const baseUrl = b.baseUrl !== undefined ? asStr(b.baseUrl) : row.base_url || '';
    const modelId = b.modelId !== undefined ? asStr(b.modelId) : row.model_id || '';
    let settings = null;
    if (b.settings !== undefined) settings = validateSettingsShape(b.settings === null ? {} : b.settings);

    // 用于校验的密钥：新值优先，否则尝试解密旧值
    const newApiKey = asStr(b.apiKey);
    let keyForValidate = newApiKey;
    if (!keyForValidate) {
      const cfg = buildProviderConfig(row); // 解密失败会抛400提示重新录入
      keyForValidate = cfg.apiKey;
    }

    await getAdapter(adapterType).validateConfig({
      baseUrl,
      modelId,
      apiKey: keyForValidate,
      settings: settings || parseSettings(row.settings_json),
    });

    let enabled = row.enabled;
    if (b.enabled !== undefined) enabled = b.enabled === true || b.enabled === 1 ? 1 : 0;
    // 停用(enabled=0)时若该配置处于激活态，则同步取消激活
    let active = row.active;
    if (enabled === 0 && row.active === 1) active = 0;

    const encryptedKey = newApiKey ? encryptSecret(newApiKey, config.dataKey) : row.encrypted_api_key;

    getDb()
      .prepare(
        `UPDATE providers SET name=?, adapter_type=?, base_url=?, model_id=?, encrypted_api_key=?, settings_json=?,
           enabled=?, active=?, updated_at=? WHERE id=?`
      )
      .run(
        b.name !== undefined ? (asStr(b.name) || row.name) : row.name,
        adapterType,
        baseUrl || null,
        modelId || null,
        encryptedKey,
        settings !== null ? JSON.stringify(settings) : row.settings_json,
        enabled,
        active,
        new Date().toISOString(),
        row.id
      );
    log('info', '更新Provider配置', { providerId: row.id, keyReplaced: Boolean(newApiKey) });
    ok(req, res, serializeProvider(getProviderRow(row.id)));
  } catch (e) {
    next(e);
  }
});

// ---- 删除：激活项不可删（先停用）----
router.delete('/:id', (req, res, next) => {
  try {
    const row = getProviderRow(req.params.id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Provider配置不存在');
    if (row.active === 1) throw new ApiError(400, 'VALIDATION_ERROR', '该配置正处于激活状态，请先停用后再删除');
    getDb().prepare('DELETE FROM providers WHERE id=?').run(row.id);
    log('info', '删除Provider配置', { providerId: row.id });
    ok(req, res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

// ---- 测试生成：1条固定测试提示词真实生成，返回 {status,durationMs,imageUrl?,error?} ----
router.post('/:id/test', async (req, res, next) => {
  try {
    const row = getProviderRow(req.params.id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Provider配置不存在');
    const result = await runProviderTest(row);
    ok(req, res, result);
  } catch (e) {
    next(e);
  }
});

// ---- 激活：先校验配置合法，再事务内原子切换（其余自动inactive）----
router.post('/:id/activate', async (req, res, next) => {
  try {
    const row = getProviderRow(req.params.id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Provider配置不存在');
    const cfg = buildProviderConfig(row);
    await getAdapter(row.adapter_type).validateConfig(cfg);

    const db = getDb();
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE providers SET active=0, updated_at=? WHERE active=1').run(now);
      db.prepare('UPDATE providers SET active=1, enabled=1, updated_at=? WHERE id=?').run(now, row.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    log('info', '激活Provider', { providerId: row.id });
    ok(req, res, serializeProvider(getProviderRow(row.id)));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
