/**
 * requestId 中间件（契约§1）：每个响应带 requestId，响应头 X-Request-Id 同值
 */
'use strict';

const { randomHex } = require('../utils/crypto');

module.exports = function requestId(req, res, next) {
  req.requestId = 'req-' + randomHex(8);
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
