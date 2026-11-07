/**
 * 管理员路由总装（契约§3/§4）
 * - POST /api/admin/login  公开：登录 → {token, expiresAt}
 * - 其余 /api/admin/**    需 Bearer 会话（401 AUTH_REQUIRED）
 */
'use strict';

const express = require('express');
const { getDb } = require('../../db');
const { ok, ApiError } = require('../../utils/respond');
const { verifyPassword } = require('../../utils/crypto');
const { createSession, revokeSession, requireAdmin } = require('../../middleware/auth');
const throttle = require('../../middleware/loginThrottle');
const { log } = require('../../utils/logger');

const providersRouter = require('./providers');
const generationsRouter = require('./generations');
const ordersRouter = require('./orders');
const statsRouter = require('./stats');

const router = express.Router();

// ---- 登录（公开；失败5次锁10分钟）----
router.post('/login', (req, res, next) => {
  try {
    const b = req.body || {};
    const username = typeof b.username === 'string' ? b.username.trim() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    if (!username || !password) throw new ApiError(400, 'VALIDATION_ERROR', '请输入用户名和密码');

    throttle.assertNotLocked(username);
    const user = getDb().prepare('SELECT * FROM admin_users WHERE username=?').get(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throttle.recordLoginFailure(username);
      log('warn', '管理员登录失败', { username });
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', '用户名或密码错误');
    }
    throttle.recordLoginSuccess(username);
    const sess = createSession(user.username);
    log('info', '管理员登录成功', { username });
    ok(req, res, { token: sess.token, expiresAt: sess.expiresAt });
  } catch (e) {
    next(e);
  }
});

// ---- 以下全部需要管理员会话 ----
router.use(requireAdmin);

// 注销当前token（立即失效）
router.post('/logout', (req, res, next) => {
  try {
    revokeSession(req.sessionToken);
    log('info', '管理员注销', { username: req.admin && req.admin.username });
    ok(req, res, { loggedOut: true });
  } catch (e) {
    next(e);
  }
});

router.use('/providers', providersRouter);
router.use('/generations', generationsRouter);
router.use('/orders', ordersRouter);
router.use('/stats', statsRouter);

module.exports = router;
