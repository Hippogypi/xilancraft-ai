/**
 * 契约端点（用户端）：POST /api/orders 提交模拟订单 → {orderNo}
 */
'use strict';

const express = require('express');
const { ok } = require('../utils/respond');
const { createOrder } = require('../services/order');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const { orderNo } = createOrder(req.body);
    ok(req, res, { orderNo });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
