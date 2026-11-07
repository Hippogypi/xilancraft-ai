/**
 * 契约端点：GET /api/health（公开）
 * 返回 {status:"ok", uptime, db:"ok", activeProvider}
 */
'use strict';

const express = require('express');
const { ok } = require('../utils/respond');
const { getDb } = require('../db');
const { getActiveProviderRow, serializeProvider } = require('../services/providerService');

const router = express.Router();

router.get('/', (req, res) => {
  getDb().prepare('SELECT 1 AS one').get(); // db连通性检查，失败走500
  const active = getActiveProviderRow();
  ok(req, res, {
    status: 'ok',
    uptime: Math.round(process.uptime() * 100) / 100,
    db: 'ok',
    activeProvider: active
      ? { id: active.id, name: active.name, adapterType: active.adapter_type, modelId: active.model_id }
      : null,
  });
});

module.exports = router;
