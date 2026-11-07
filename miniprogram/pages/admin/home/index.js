/**
 * pages/admin/home —— 管理首页
 * 三入口卡（API 配置 / 生成记录 / 订单管理）+ P2 统计卡占位
 * 未登录访问自动重定向到登录页（WBS 01.05 拦截）
 */
const adminAuth = require('../../../services/admin-auth.js');

Page({
  onLoad() {
    if (!adminAuth.isLogged()) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
    }
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

  onLogout() {
    // TODO(阶段3): 先调 api.post('/api/admin/logout') 注销服务端会话
    adminAuth.clear();
    wx.redirectTo({ url: '/pages/admin/login/index' });
  }
});
