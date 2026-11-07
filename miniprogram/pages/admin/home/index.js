/**
 * pages/admin/home —— 管理首页
 * - 三入口卡：API 配置 / 生成记录 / 订单管理（navigateTo）
 * - 统计卡：GET /api/admin/stats（失败静默，显示 "--"）
 * - 右上角退出登录：POST /api/admin/logout（无论成败均清 token 并回登录页）
 */
const adminAuth = require('../../../services/admin-auth.js');
const api = require('../../../services/api.js');
const common = require('../common.js');

Page({
  data: {
    stats: { totalGenerations: '--', successRate: '--', totalOrders: '--' },
    loggingOut: false
  },

  onLoad() {
    if (!common.requireLogin()) return;
  },

  onShow() {
    if (!common.requireLogin()) return;
    this.fetchStats();
  },

  /** 统计卡：successRate 为 0~1 小数 → 百分比；失败静默保持 "--" */
  fetchStats() {
    const that = this;
    api
      .get('/api/admin/stats')
      .then(function (res) {
        that.setData({
          stats: {
            totalGenerations: String(res.totalGenerations),
            successRate: Math.round((res.successRate || 0) * 100) + '%',
            totalOrders: String(res.totalOrders)
          }
        });
      })
      .catch(function (err) {
        // 统计失败静默保持 "--"；但会话失效（api.js 已清 token）须回登录页
        if (err && err.code === 'AUTH_REQUIRED') {
          wx.redirectTo({ url: '/pages/admin/login/index' });
        }
      });
  },

  goProviders() {
    wx.navigateTo({ url: '/pages/admin/providers/index' });
  },
  goGenerations() {
    wx.navigateTo({ url: '/pages/admin/generations/index' });
  },
  goOrders() {
    wx.navigateTo({ url: '/pages/admin/orders/index' });
  },

  /** 退出登录：先注销服务端会话，再清本地 token 回登录页（注销失败也强制退出） */
  onLogout() {
    if (this.data.loggingOut) return;
    this.setData({ loggingOut: true });
    const that = this;
    const finish = function () {
      adminAuth.clear();
      that.setData({ loggingOut: false });
      wx.redirectTo({ url: '/pages/admin/login/index' });
    };
    api.post('/api/admin/logout').then(finish).catch(finish);
  }
});
