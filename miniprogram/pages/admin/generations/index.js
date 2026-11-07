/**
 * pages/admin/generations —— 生成记录列表
 * 阶段2底座：空列表 + 空态 + 详情弹层结构；阶段3接入
 *   GET /api/admin/generations?status=&page=&pageSize=（默认 20/页）
 *   GET /api/admin/generations/:id（详情：提示词全文/错误码）
 */
const adminAuth = require('../../../services/admin-auth.js');

Page({
  data: {
    filters: [
      { label: '全部', value: 'all' },
      { label: '成功', value: 'succeeded' },
      { label: '失败', value: 'failed' }
    ],
    filter: 'all',
    list: [], // [{ id, createdAt, modelId, status, prompt, imageUrl }]
    showDetail: false,
    detail: null
  },

  onLoad() {
    if (!adminAuth.isLogged()) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    // TODO(阶段3): this.fetchList()
  },

  // TODO(阶段3): fetchList() → api.get('/api/admin/generations?status=' + filter)

  onFilterChange(e) {
    this.setData({ filter: e.detail.value });
    // TODO(阶段3): this.fetchList()
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find(function (x) { return x.id === id; });
    if (!item) return;
    // TODO(阶段3): 详情改调 api.get('/api/admin/generations/' + id)
    this.setData({
      detail: item,
      showDetail: true
    });
  },

  onDetailClose() {
    this.setData({ showDetail: false });
  }
});
