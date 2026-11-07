/**
 * services/admin-auth.js —— 管理端会话 token 存取
 * 登录成功后 token 存本地 storage（key: xl_admin_token）；
 * services/api.js 对 /api/admin/* 请求自动附带 Bearer。
 */
const TOKEN_KEY = 'xl_admin_token';

module.exports = {
  TOKEN_KEY,
  getToken() {
    try {
      return wx.getStorageSync(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  },
  setToken(token) {
    try {
      wx.setStorageSync(TOKEN_KEY, token || '');
    } catch (e) {
      // storage 异常不阻断流程，后续请求将以未登录身份发出
    }
  },
  isLogged() {
    return !!this.getToken();
  },
  clear() {
    try {
      wx.removeStorageSync(TOKEN_KEY);
    } catch (e) {
      // 忽略清除失败
    }
  }
};
