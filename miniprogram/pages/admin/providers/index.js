/**
 * pages/admin/providers —— Provider 列表
 * 阶段2底座：空数据 + 空态；阶段3接入 GET /api/admin/providers
 */
const adminAuth = require('../../../services/admin-auth.js');

Page({
  data: {
    list: [] // [{ id, name, adapter_type, model_id, active, last_test_status }]
  },

  onLoad() {
    if (!adminAuth.isLogged()) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    // TODO(阶段3): api.get('/api/admin/providers').then(list => this.setData({ list }))
  },

  onShow() {
    // 从编辑页返回时阶段3需刷新列表
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/providers-edit/index?id=' + id });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/admin/providers-edit/index' });
  }
});
