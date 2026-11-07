/**
 * 统一响应包络与业务错误（契约§1/§2）
 * 成功：{success:true, data:{...}, requestId}
 * 失败：{success:false, error:{code,message}, requestId}
 */
'use strict';

/** 业务错误：携带契约错误码与HTTP状态码，由统一错误中间件渲染 */
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true; // 该消息可安全返回给客户端
  }
}

function ok(req, res, data) {
  res.status(200).json({ success: true, data: data == null ? {} : data, requestId: req.requestId });
}

function fail(req, res, status, code, message) {
  res.status(status).json({
    success: false,
    error: { code, message },
    requestId: req.requestId,
  });
}

module.exports = { ApiError, ok, fail };
