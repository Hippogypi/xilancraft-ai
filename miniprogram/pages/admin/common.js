/**
 * pages/admin/common.js —— 管理端页面共用工具（仅供 pages/admin/** 引用）
 * - requireLogin：onLoad/onShow 登录守卫（未登录/会话被清 → 重定向登录页）
 * - onApiError：请求失败统一处理。401/AUTH_REQUIRED 时 services/api.js 已自动清
 *   token，此处检测后统一 redirectTo 登录页；其余错误 toast 中文友好提示。
 * - formatTime：ISO8601 → "YYYY-MM-DD HH:mm"（本地时区）
 * - 订单状态文案/tag/流转表、生成状态映射、服装款式名映射（本地 JSON）
 */
const adminAuth = require('../../services/admin-auth.js');

const LOGIN_URL = '/pages/admin/login/index';

/** 登录守卫：返回 false 表示已触发跳转，页面须立即 return */
function requireLogin() {
  if (!adminAuth.isLogged()) {
    wx.redirectTo({ url: LOGIN_URL });
    return false;
  }
  return true;
}

/** API 失败统一处理：会话失效 → 登录页；其余 toast（可自定义兜底文案） */
function onApiError(err, fallback) {
  // api.js 遇 AUTH_REQUIRED / HTTP 401 已自动清 token → 此处统一跳登录页
  const authLost = (err && err.code === 'AUTH_REQUIRED') || !adminAuth.isLogged();
  if (authLost) {
    wx.redirectTo({ url: LOGIN_URL });
    return;
  }
  const msg = (err && err.friendlyMessage) || fallback || '请求失败，请稍后重试';
  wx.showToast({ title: msg, icon: 'none', duration: 2500 });
}

/** ISO8601 时间 → 本地 "YYYY-MM-DD HH:mm"；非法值原样返回 */
function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return (
    d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  );
}

/* ---- 订单状态（契约 §4：pending → confirming → completed 单向） ---- */
const ORDER_STATUS_TEXT = { pending: '待处理', confirming: '设计确认', completed: '已完成' };
const ORDER_STATUS_TAG = {
  pending: 'xl-tag--warn',
  confirming: 'xl-tag--info',
  completed: 'xl-tag--success'
};
/** 当前状态 → 下一步可流转动作；completed 无后续 */
const ORDER_NEXT = {
  pending: { status: 'confirming', label: '确认设计' },
  confirming: { status: 'completed', label: '标记完成' },
  completed: null
};

/* ---- 生成任务状态 → xl-status-dot type / 文案 ---- */
function genDotType(status) {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'failed';
  return 'running'; // queued / running
}
function genStatusText(status) {
  if (status === 'succeeded') return '成功';
  if (status === 'failed') return '失败';
  if (status === 'queued') return '排队中';
  return '进行中';
}

/* ---- 服装款式：id → 名称（素材为小程序本地 JSON，契约 §4 注） ---- */
let garmentNameMap = null;
function garmentName(id) {
  if (!id) return '—';
  if (!garmentNameMap) {
    garmentNameMap = {};
    try {
      const list = require('../../assets/data/garments.json') || [];
      list.forEach(function (g) { garmentNameMap[g.id] = g.name; });
    } catch (e) {
      garmentNameMap = {};
    }
  }
  return garmentNameMap[id] || id;
}

module.exports = {
  requireLogin: requireLogin,
  onApiError: onApiError,
  formatTime: formatTime,
  ORDER_STATUS_TEXT: ORDER_STATUS_TEXT,
  ORDER_STATUS_TAG: ORDER_STATUS_TAG,
  ORDER_NEXT: ORDER_NEXT,
  genDotType: genDotType,
  genStatusText: genStatusText,
  garmentName: garmentName
};
