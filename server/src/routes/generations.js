/**
 * 契约端点（用户端，无需鉴权）：
 * - POST /api/generations        提交生成任务
 * - GET  /api/generations/:id    轮询任务状态
 */
'use strict';

const express = require('express');
const { ok } = require('../utils/respond');
const { ApiError } = require('../utils/respond');
const { submitGeneration, getJobForUser } = require('../services/generation');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const data = await submitGeneration(req.body);
    ok(req, res, data);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const job = getJobForUser(req.params.id);
    if (!job) throw new ApiError(404, 'NOT_FOUND', '生成任务不存在');
    ok(req, res, job);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
