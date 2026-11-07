/**
 * 管理员会话鉴权（契约§3）
 * - 内存 session Map，24h过期，logout即失效（重启后失效，属演示可接受行为）
 * - Authorization: Bearer <32位hex token>
 */
'use strict';

const config = require('../config/env');
const { ApiError } = require('../utils/respond');
const { randomHex } = require('../utils/crypto');

// token → {username, expiresAt(ms)}
const sessions = new Map();

// 定期清理过期会话（不阻塞进程退出）
const cleaner = setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (now > s.expiresAt) sessions.delete(t);
}, 10 * 60 * 1000);
if (cleaner.unref) cleaner.unref();

function createSession(username) {
  const token = randomHex(16); // 32 hex 字符
  const expiresAt = Date.now() + config.SESSION_TTL_MS;
  sessions.set(token, { username, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

function revokeSession(token) {
  return sessions.delete(token);
}

/** 管理接口统一鉴权：缺失/失效 → 401 AUTH_REQUIRED */
function requireAdmin(req, res, next) {
  const header = req.headers['authorization'] || '';
  const m = /^Bearer\s+(\S+)$/i.exec(String(header));
  if (!m) return next(new ApiError(401, 'AUTH_REQUIRED', '未登录或缺少管理员凭证'));
  const sess = sessions.get(m[1]);
  if (!sess) return next(new ApiError(401, 'AUTH_REQUIRED', '会话不存在或已注销，请重新登录'));
  if (Date.now() > sess.expiresAt) {
    sessions.delete(m[1]);
    return next(new ApiError(401, 'AUTH_REQUIRED', '会话已过期，请重新登录'));
  }
  req.admin = sess;
  req.sessionToken = m[1];
  next();
}

module.exports = { createSession, revokeSession, requireAdmin };
