/**
 * 订单服务（契约§4 orders + 规格§5.3/§9）
 * - 订单号：XLKP-日期-4位序号（本地日期，按日递增，库级UNIQUE兜底）
 * - 校验：privacyAccepted必须true；generationJobId必须存在且succeeded；garmentTemplateId非空
 * - 状态单向流转：pending → confirming → completed（只许前进，不许回退/重复）
 */
'use strict';

const path = require('node:path');
const { getDb } = require('../db');
const { ApiError } = require('../utils/respond');
const { newId } = require('../utils/crypto');
const { todayKey } = require('./quota');

const ORDER_STATUSES = ['pending', 'confirming', 'completed'];

function pad4(n) {
  return String(n).padStart(4, '0');
}

/** 生成订单号：XLKP-YYYYMMDD-XXXX；并发下循环避让重号 */
function nextOrderNo(db) {
  const day = todayKey().replace(/-/g, '');
  const prefix = `XLKP-${day}-`;
  const count = db.prepare('SELECT COUNT(*) c FROM orders WHERE order_no LIKE ?').get(prefix + '%').c;
  const exists = db.prepare('SELECT 1 FROM orders WHERE order_no=?');
  let seq = count + 1;
  while (seq <= 9999 && exists.get(prefix + pad4(seq))) seq++;
  if (seq > 9999) throw new ApiError(500, 'INTERNAL_ERROR', '当日订单号已用尽（演示环境请联系管理员清理）');
  return prefix + pad4(seq);
}

/** 校验 placement（可空；字段若给出须为合法数值） */
function sanitizePlacement(placement) {
  if (placement === undefined || placement === null) return null;
  if (typeof placement !== 'object' || Array.isArray(placement)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'placement 必须为对象 {scale, offsetX, offsetY, opacity}');
  }
  const num = (v, min, max, name) => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new ApiError(400, 'VALIDATION_ERROR', `placement.${name} 须为 ${min}~${max} 的数值`);
    return n;
  };
  const out = {
    scale: num(placement.scale, 0.1, 5),
    offsetX: num(placement.offsetX, -2000, 2000),
    offsetY: num(placement.offsetY, -2000, 2000),
    opacity: num(placement.opacity, 0, 1),
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length ? out : null;
}

/**
 * 创建订单，返回 {id, orderNo}
 */
function createOrder(body) {
  const b = body || {};
  const db = getDb();

  const customerName = typeof b.customerName === 'string' ? b.customerName.trim() : '';
  if (!customerName || customerName.length > 50) throw new ApiError(400, 'VALIDATION_ERROR', '请填写联系人姓名（1~50字符）');
  const contact = typeof b.contact === 'string' ? b.contact.trim() : '';
  if (!contact || contact.length > 100) throw new ApiError(400, 'VALIDATION_ERROR', '请填写联系方式（演示数据即可）');
  const garmentTemplateId = typeof b.garmentTemplateId === 'string' ? b.garmentTemplateId.trim() : '';
  if (!garmentTemplateId || garmentTemplateId.length > 64) throw new ApiError(400, 'VALIDATION_ERROR', '请选择服装款式（garmentTemplateId）');
  const size = typeof b.size === 'string' ? b.size.trim() : '';
  if (!size || size.length > 16) throw new ApiError(400, 'VALIDATION_ERROR', '请选择尺码');
  let quantity = b.quantity === undefined || b.quantity === null ? 1 : Number(b.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new ApiError(400, 'VALIDATION_ERROR', '数量须为1~99的整数');

  // 隐私：必须主动勾选（契约§4）
  if (b.privacyAccepted !== true) throw new ApiError(400, 'VALIDATION_ERROR', '请先阅读并勾选隐私说明后再提交订单');

  // 关联生成任务：必须存在且已成功
  if (typeof b.generationJobId !== 'string' || !b.generationJobId.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', '缺少关联的生成任务（generationJobId）');
  }
  const job = db.prepare('SELECT * FROM generation_jobs WHERE id=?').get(b.generationJobId.trim());
  if (!job) throw new ApiError(400, 'VALIDATION_ERROR', '关联的生成任务不存在，请重新生成纹样');
  if (job.status !== 'succeeded') throw new ApiError(400, 'VALIDATION_ERROR', '关联的生成任务尚未成功，无法用于下单');

  const placement = sanitizePlacement(b.placement);

  const id = newId('ord');
  const orderNo = nextOrderNo(db);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO orders (id, order_no, customer_name, contact, garment_template_id, size, quantity,
      generation_job_id, pattern_image_path, placement_json, status, privacy_accepted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).run(
    id,
    orderNo,
    customerName,
    contact,
    garmentTemplateId,
    size,
    quantity,
    job.id,
    job.output_image_path, // 纹样快照：引用该任务的落盘图
    placement ? JSON.stringify(placement) : null,
    now,
    now,
    now
  );
  return { id, orderNo };
}

/** 对外序列化（camelCase；纹样图给可访问URL） */
function serializeOrder(row) {
  let placement = null;
  try {
    placement = row.placement_json ? JSON.parse(row.placement_json) : null;
  } catch (e) {
    placement = null;
  }
  return {
    id: row.id,
    orderNo: row.order_no,
    customerName: row.customer_name,
    contact: row.contact,
    garmentTemplateId: row.garment_template_id,
    size: row.size,
    quantity: row.quantity,
    generationJobId: row.generation_job_id,
    patternImageUrl: row.pattern_image_path ? `/api/images/generated/${path.basename(row.pattern_image_path)}` : null,
    placement,
    status: row.status,
    privacyAcceptedAt: row.privacy_accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 分页列表：status筛选 + keyword（订单号/姓名模糊） */
function listOrders({ status, keyword, page, pageSize }) {
  const db = getDb();
  const conds = [];
  const params = [];
  if (status) {
    conds.push('status = ?');
    params.push(status);
  }
  if (keyword) {
    const kw = keyword.replace(/[\\%_]/g, (c) => '\\' + c);
    conds.push('(order_no LIKE ? ESCAPE \'\\\' OR customer_name LIKE ? ESCAPE \'\\\')');
    params.push(`%${kw}%`, `%${kw}%`);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM orders ${where}`).get(...params).c;
  const rows = db
    .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  return { list: rows.map(serializeOrder), page, pageSize, total };
}

function getOrderRow(id) {
  return getDb().prepare('SELECT * FROM orders WHERE id=?').get(id) || null;
}

/** 状态流转：仅允许沿 pending→confirming→completed 前进（可跳级、不可回退/原地） */
function updateOrderStatus(id, newStatus) {
  const db = getDb();
  const row = getOrderRow(id);
  if (!row) throw new ApiError(404, 'NOT_FOUND', '订单不存在');
  if (!ORDER_STATUSES.includes(newStatus)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `非法订单状态：${newStatus}（可选：${ORDER_STATUSES.join(' / ')}）`);
  }
  const cur = ORDER_STATUSES.indexOf(row.status);
  const next = ORDER_STATUSES.indexOf(newStatus);
  if (next <= cur) {
    throw new ApiError(400, 'VALIDATION_ERROR', `订单状态只能单向流转（${ORDER_STATUSES.join('→')}），当前为 ${row.status}`);
  }
  db.prepare('UPDATE orders SET status=?, updated_at=? WHERE id=?').run(newStatus, new Date().toISOString(), id);
  return serializeOrder(getOrderRow(id));
}

module.exports = { createOrder, listOrders, getOrderRow, updateOrderStatus, serializeOrder, ORDER_STATUSES };
