/**
 * utils/url.js —— 生成图相对路径 → 绝对地址
 * 契约（shared/api-contract.md §4）：GET /api/generations/:id 的 imageUrl 为
 * "/api/images/generated/xxx.png" 相对路径，渲染前需拼 config/env.js 的 BASE_URL。
 */
var env = require('../config/env.js');

function absoluteUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  var base = String(env.BASE_URL || '').replace(/\/+$/, '');
  return base + '/' + String(url).replace(/^\/+/, '');
}

module.exports = {
  absoluteUrl: absoluteUrl
};
