/**
 * 契约端点（管理员，P2）：GET /api/admin/stats
 * 返回 {totalGenerations, successRate, totalOrders}；successRate 为0~1的小数（保留4位）
 */
'use strict';

const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../utils/respond');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const g = db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) ok FROM generation_jobs").get();
    const o = db.prepare('SELECT COUNT(*) total FROM orders').get();
    const totalGenerations = g.total || 0;
    const successRate = totalGenerations > 0 ? Math.round(((g.ok || 0) / totalGenerations) * 10000) / 10000 : 0;
    ok(req, res, { totalGenerations, successRate, totalOrders: o.total || 0 });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
