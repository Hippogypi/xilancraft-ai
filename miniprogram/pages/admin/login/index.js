/**
 * pages/admin/login —— 管理员登录
 * POST /api/admin/login {username, password} → {token, expiresAt}
 * 成功：adminAuth.setToken → redirectTo 管理首页
 * 失败：红字显示 err.friendlyMessage（AUTH_INVALID_CREDENTIALS / AUTH_LOCKED
 *       已由 services/api.js 映射为中文提示）
 */
const adminAuth = require('../../../services/admin-auth.js');
const api = require('../../../services/api.js');

Page({
  data: {
    username: '',
    password: '',
    error: '',
    submitting: false
  },

  onLoad() {
    // 已有会话则直接进入管理首页（token 失效时 api.js 会清除后由守卫跳回本页）
    if (adminAuth.isLogged()) {
      wx.redirectTo({ url: '/pages/admin/home/index' });
    }
  },

  onUserInput(e) {
    this.setData({ username: e.detail.value, error: '' });
  },
  onPwdInput(e) {
    this.setData({ password: e.detail.value, error: '' });
  },

  onLogin() {
    if (this.data.submitting) return;
    const username = (this.data.username || '').trim();
    const password = this.data.password || '';
    if (!username) {
      this.setData({ error: '请输入管理员账号' });
      return;
    }
    if (!password) {
      this.setData({ error: '请输入密码' });
      return;
    }
    this.setData({ submitting: true, error: '' });
    const that = this;

    api
      .post('/api/admin/login', { username: username, password: password })
      .then(function (res) {
        adminAuth.setToken(res && res.token);
        that.setData({ submitting: false });
        wx.redirectTo({ url: '/pages/admin/home/index' });
      })
      .catch(function (err) {
        // 账密错误 / 登录锁定的中文提示直接红字展示（契约 §2 错误码）
        that.setData({
          submitting: false,
          error: (err && err.friendlyMessage) || '登录失败，请稍后重试'
        });
      });
  }
});
