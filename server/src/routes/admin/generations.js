/**
 * 契约端点（管理员）：
 * - GET /api/admin/generations?status=&page=&pageSize=  生成记录分页（默认20/页）
 * - GET /api/admin/generations/:id                     记录详情（提示词/模型/状态/结果图/错误码）
 */
'use strict';

const express = require('express');
const { getDb } = require('../../db');
const { ok, ApiError } = require('../../utils/respond');
const { listJobs, serializeJobAdmin } = require('../../services/generation');

const router = express.Router();

const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'];

// 分页参数解析：page≥1，pageSize 1~100 默认20（契约§4）
function parsePaging(query) {
  let page = Number.parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let pageSize = Number.parseInt(query.pageSize, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
  if (pageSize > 100) pageSize = 100;
  return { page, pageSize };
}

router.get('/', (req, res, next) => {
  try {
    const { page, pageSize } = parsePaging(req.query);
    let status = req.query.status;
    if (status !== undefined && status !== '') {
      if (!JOB_STATUSES.includes(status)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `status 仅支持：${JOB_STATUSES.join(' / ')}`);
      }
    } else {
      status = '';
    }
    ok(req, res, listJobs({ status, page, pageSize }));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const row = getDb()
      .prepare(
        `SELECT g.*, p.name AS provider_name, p.adapter_type FROM generation_jobs g
         LEFT JOIN providers p ON p.id = g.provider_id WHERE g.id=?`
      )
      .get(req.params.id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', '生成记录不存在');
    ok(req, res, serializeJobAdmin(row, row.provider_name));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
