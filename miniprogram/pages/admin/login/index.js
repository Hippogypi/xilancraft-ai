/**
 * pages/admin/login —— 管理员登录
 * 阶段2底座：本地校验 + 演示 token 暂存；阶段3接入 POST /api/admin/login
 */
const adminAuth = require('../../../services/admin-auth.js');

Page({
  data: {
    username: '',
    password: '',
    error: '',
    submitting: false
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

    // TODO(阶段3): 调 api.post('/api/admin/login', { username, password })
    //   成功 → adminAuth.setToken(res.token)，失败 → error = err.friendlyMessage
    //   （AUTH_INVALID_CREDENTIALS / AUTH_LOCKED 由 services/api.js 映射中文提示）
    setTimeout(function () {
      adminAuth.setToken('demo-token-stage3-pending');
      wx.redirectTo({ url: '/pages/admin/home/index' });
      that.setData({ submitting: false });
    }, 400);
  }
});
