/**
 * 契约端点（管理员）：
 * - GET   /api/admin/orders?status=&keyword=&page=&pageSize=  订单分页（keyword匹配订单号/姓名）
 * - GET   /api/admin/orders/:id                               订单详情
 * - PATCH /api/admin/orders/:id/status  body {status}         状态单向流转 pending→confirming→completed
 */
'use strict';

const express = require('express');
const { ok, ApiError } = require('../../utils/respond');
const { listOrders, getOrderRow, updateOrderStatus, serializeOrder, ORDER_STATUSES } = require('../../services/order');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    let page = Number.parseInt(req.query.page, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    let pageSize = Number.parseInt(req.query.pageSize, 10);
    if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
    if (pageSize > 100) pageSize = 100;

    let status = req.query.status;
    if (status !== undefined && status !== '') {
      if (!ORDER_STATUSES.includes(status)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `status 仅支持：${ORDER_STATUSES.join(' / ')}`);
      }
    } else {
      status = '';
    }
    let keyword = '';
    if (req.query.keyword !== undefined && req.query.keyword !== null) {
      keyword = String(req.query.keyword).trim();
      if (keyword.length > 50) throw new ApiError(400, 'VALIDATION_ERROR', 'keyword 过长（≤50字符）');
    }
    ok(req, res, listOrders({ status, keyword, page, pageSize }));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const row = getOrderRow(req.params.id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', '订单不存在');
    ok(req, res, serializeOrder(row));
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/status', (req, res, next) => {
  try {
    const b = req.body || {};
    if (typeof b.status !== 'string' || !b.status.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', '缺少 status 字段');
    }
    ok(req, res, updateOrderStatus(req.params.id, b.status.trim()));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
