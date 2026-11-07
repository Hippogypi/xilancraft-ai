/**
 * 登录限试（契约§3）：同一用户名连续失败5次 → 锁定10分钟
 * 内存实现；成功登录即清零
 */
'use strict';

const config = require('../config/env');
const { ApiError } = require('../utils/respond');

// username → {fails, lockedUntil(ms)}
const attempts = new Map();

function assertNotLocked(username) {
  const a = attempts.get(username);
  if (a && a.lockedUntil && Date.now() < a.lockedUntil) {
    const remainMin = Math.ceil((a.lockedUntil - Date.now()) / 60000);
    throw new ApiError(429, 'AUTH_LOCKED', `登录失败次数过多，账号已临时锁定，请约 ${remainMin} 分钟后再试`);
  }
}

function recordLoginFailure(username) {
  const a = attempts.get(username) || { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= config.LOGIN_MAX_FAILS) {
    a.lockedUntil = Date.now() + config.LOGIN_LOCK_MS;
    a.fails = 0; // 锁定后清零计数，解锁后重新累计
  }
  attempts.set(username, a);
}

function recordLoginSuccess(username) {
  attempts.delete(username);
}

module.exports = { assertNotLocked, recordLoginFailure, recordLoginSuccess };
