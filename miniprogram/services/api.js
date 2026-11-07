/**
 * services/api.js —— 统一 API 客户端（依据 shared/api-contract.md 冻结版 v1）
 *
 * - Promise 化 wx.request，超时 15s（config/env.js REQUEST_TIMEOUT）
 * - 统一解析契约响应包络 { success, data | error, requestId }
 * - /api/admin/*（登录除外）自动附带存储的 Bearer token
 * - 契约错误码映射为中文友好提示（err.friendlyMessage）
 * - 网络失败统一映射 INTERNAL_ERROR
 *
 * 阶段2底座：封装就绪，页面暂不发起真实请求，阶段3接线。
 */
const env = require('../config/env.js');
const adminAuth = require('./admin-auth.js');

/** 契约错误码 → 中文友好提示（api-contract.md §2） */
const ERROR_MESSAGES = {
  VALIDATION_ERROR: '提交的内容有误，请检查后重试',
  AUTH_INVALID_CREDENTIALS: '管理员账号或密码错误',
  AUTH_LOCKED: '登录失败次数过多，已临时锁定，请约 10 分钟后再试',
  AUTH_REQUIRED: '登录状态已失效，请重新登录',
  NOT_FOUND: '请求的内容不存在',
  PROVIDER_NOT_ACTIVE: '暂无激活的 AI 服务，请联系管理员在管理端配置',
  PROVIDER_CONFIG_INVALID: 'AI 服务配置不合法，请联系管理员检查 Base URL / 模型 / 密钥',
  PROVIDER_UNREACHABLE: 'AI 服务暂时无法访问，可稍后重试或联系工作人员切换服务',
  GENERATION_FAILED: '生成失败，可点击重试或联系工作人员切换 AI 服务',
  GENERATION_TIMEOUT: '生成超时，请稍后重试',
  RATE_LIMITED: '操作太频繁，请稍候再试',
  DAILY_QUOTA_EXCEEDED: '今日生成额度已用完，请联系工作人员',
  UPLOAD_REJECTED: '图片需为 JPG/PNG 且不超过 5MB',
  INTERNAL_ERROR: '服务暂时不可用，请稍后重试',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试'
};

/** HTTP 状态码兜底（响应体无 error 包络时使用） */
const HTTP_MESSAGES = {
  400: '请求参数有误',
  401: '未登录或登录已过期',
  403: '没有权限执行此操作',
  404: '请求的内容不存在',
  429: '请求过于频繁或额度不足',
  500: '服务暂时不可用，请稍后重试',
  502: '上游 AI 服务异常，请联系工作人员切换服务',
  504: '请求超时，请稍后重试'
};

/** 取错误对象的中文友好提示 */
function friendly(err) {
  if (!err) return ERROR_MESSAGES.INTERNAL_ERROR;
  if (ERROR_MESSAGES[err.code]) return ERROR_MESSAGES[err.code];
  if (err.message) return err.message;
  return ERROR_MESSAGES.INTERNAL_ERROR;
}

/** 管理接口（登录除外）自动附带 Authorization: Bearer <token> */
function buildHeader(path) {
  const header = { 'content-type': 'application/json' };
  const isAdminPath = path.indexOf('/api/admin') === 0;
  const isLoginPath = path.indexOf('/api/admin/login') === 0;
  if (isAdminPath && !isLoginPath) {
    const token = adminAuth.getToken();
    if (token) header.Authorization = 'Bearer ' + token;
  }
  return header;
}

/**
 * 发起请求。path 支持 '/api/...' 相对路径（拼 BASE_URL）或完整 http(s) 地址。
 * 成功 resolve 包络 data；失败 reject { code, message, requestId, friendlyMessage }。
 */
function request(method, path, data) {
  return new Promise(function (resolve, reject) {
    const url = /^https?:\/\//.test(path) ? path : env.BASE_URL + path;
    wx.request({
      url: url,
      method: method,
      data: data || {},
      timeout: env.REQUEST_TIMEOUT,
      header: buildHeader(path),
      success: function (res) {
        const body = res.data || {};
        const okHttp = res.statusCode >= 200 && res.statusCode < 300;
        if (okHttp && body.success) {
          resolve(body.data);
          return;
        }
        // 包络失败 或 非法 HTTP 状态
        const err = (body && body.error)
          ? { code: body.error.code, message: body.error.message }
          : {
              code: res.statusCode >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
              message: HTTP_MESSAGES[res.statusCode] || HTTP_MESSAGES[500]
            };
        if (body.requestId) err.requestId = body.requestId;
        err.friendlyMessage = friendly(err);
        // 会话失效：清空本地 token，管理端跳转登录由页面层处理
        if (err.code === 'AUTH_REQUIRED' || res.statusCode === 401) {
          adminAuth.clear();
        }
        reject(err);
      },
      fail: function () {
        // 网络不可达 / 超时 / 域名不合法 → 统一 INTERNAL_ERROR
        const err = {
          code: 'INTERNAL_ERROR',
          message: ERROR_MESSAGES.NETWORK_ERROR,
          friendlyMessage: ERROR_MESSAGES.NETWORK_ERROR
        };
        reject(err);
      }
    });
  });
}

module.exports = {
  request: request,
  get: function (path) { return request('GET', path); },
  post: function (path, data) { return request('POST', path, data); },
  patch: function (path, data) { return request('PATCH', path, data); },
  del: function (path) { return request('DELETE', path); },
  ERROR_MESSAGES: ERROR_MESSAGES,
  friendly: friendly
};
