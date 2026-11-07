/**
 * 统一错误处理（契约§1/§2错误码表）
 * - ApiError → 对应状态码与错误码
 * - JSON解析失败 → 400 VALIDATION_ERROR
 * - 请求体过大 → 上传接口映射 UPLOAD_REJECTED
 * - 其他异常 → 500 INTERNAL_ERROR（脱敏消息，详情只进服务端结构化日志）
 */
'use strict';

const { ApiError, fail } = require('../utils/respond');
const { sanitizeMessage, log } = require('../utils/logger');

function notFoundHandler(req, res) {
  fail(req, res, 404, 'NOT_FOUND', `接口不存在：${req.method} ${req.path}`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return;
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = '服务内部错误，请稍后重试';

  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    log('warn', '业务错误', { requestId: req.requestId, code, status, path: req.path });
  } else if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = '请求体不是合法的JSON';
    log('warn', '请求体解析失败', { requestId: req.requestId, path: req.path });
  } else if (err && (err.type === 'entity.too.large' || err.statusCode === 413)) {
    status = 400;
    code = String(req.path).startsWith('/api/uploads') ? 'UPLOAD_REJECTED' : 'VALIDATION_ERROR';
    message = '请求体过大';
    log('warn', '请求体过大', { requestId: req.requestId, path: req.path });
  } else {
    log('error', '服务内部异常', {
      requestId: req.requestId,
      path: req.path,
      err: sanitizeMessage(err && err.message),
      stack: sanitizeMessage(err && err.stack, 800),
    });
  }
  fail(req, res, status, code, message);
}

module.exports = { notFoundHandler, errorHandler };
