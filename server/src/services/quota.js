/**
 * 配额服务（规格§8.1成本护栏）：全局冷却3s + 每Provider每日调用上限（默认50）
 */
'use strict';

const config = require('../config/env');
const { getDb } = require('../db');
const { ApiError } = require('../utils/respond');

// 全局冷却：上一次生成提交时间（内存态，防连点/防批量计费）
let lastSubmittedAt = 0;

function assertCooldown() {
  if (lastSubmittedAt && Date.now() - lastSubmittedAt < config.GLOBAL_COOLDOWN_MS) {
    throw new ApiError(429, 'RATE_LIMITED', `操作过于频繁，请 ${Math.ceil((config.GLOBAL_COOLDOWN_MS - (Date.now() - lastSubmittedAt)) / 1000)} 秒后再试`);
  }
}

function markSubmitted() {
  lastSubmittedAt = Date.now();
}

/** 本地日期键 YYYY-MM-DD（演示机本地时区） */
function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function getUsedToday(providerId) {
  const row = getDb().prepare('SELECT used FROM daily_usage WHERE provider_id=? AND day=?').get(providerId, todayKey());
  return row ? row.used : 0;
}

/** 校验每日上限：settings_json.dailyLimit（默认50） */
function assertDailyQuota(providerRow) {
  let limit = config.DEFAULT_DAILY_LIMIT;
  try {
    const s = JSON.parse(providerRow.settings_json || '{}');
    if (Number.isInteger(s.dailyLimit) && s.dailyLimit > 0) limit = s.dailyLimit;
  } catch (e) {
    /* 沿用默认上限 */
  }
  if (getUsedToday(providerRow.id) >= limit) {
    throw new ApiError(429, 'DAILY_QUOTA_EXCEEDED', `今日调用次数已达上限（${limit}次），请明天再试或由管理员调整配置`);
  }
}

/** 计数一次真实调用（用户生成与Provider测试都计入，规格§8.1） */
function recordUsage(providerId) {
  const db = getDb();
  db.prepare(
    `INSERT INTO daily_usage (provider_id, day, used) VALUES (?, ?, 1)
     ON CONFLICT(provider_id, day) DO UPDATE SET used = used + 1`
  ).run(providerId, todayKey());
}

module.exports = { assertCooldown, markSubmitted, assertDailyQuota, recordUsage, getUsedToday, todayKey };
