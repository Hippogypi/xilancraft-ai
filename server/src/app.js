/**
 * Express 应用组装（契约§4全部端点）
 * 路由前缀：/api/health /api/admin /api/generations /api/uploads /api/orders /api/images
 */
'use strict';

const express = require('express');
const requestId = require('./middleware/requestId');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { log } = require('./utils/logger');

// 请求日志（结构化JSON，含requestId；不含请求体与鉴权头）
function requestLogger(req, res, next) {
  const t0 = Date.now();
  res.on('finish', () => {
    log('info', 'http', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - t0,
    });
  });
  next();
}

const app = express();
app.disable('x-powered-by');
app.use(requestId);
app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', require('./routes/health'));
app.use('/api/generations', require('./routes/generations'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/images', require('./routes/images'));
app.use('/api/admin', require('./routes/admin'));

// 404 与统一错误处理（必须最后挂载）
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
