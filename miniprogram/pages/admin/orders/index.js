/**
 * pages/admin/orders —— 订单列表（阶段2：占位模拟数据）
 * 阶段3接入 GET /api/admin/orders?status=&keyword=&page=
 */
const adminAuth = require('../../../services/admin-auth.js');

// 与 order-detail 共用的占位数据（阶段3移除，改服务端拉取）
const DEMO_ORDERS = [
  {
    id: 'demo-1',
    orderNo: 'XLKP-20261108-0001',
    customer: '演示用户',
    contact: '13800000000',
    garment: '现代卫衣',
    garmentId: 'hoodie-001',
    size: 'L',
    quantity: 1,
    status: 'pending',
    createdAt: '2026-11-08 10:00'
  },
  {
    id: 'demo-2',
    orderNo: 'XLKP-20261108-0002',
    customer: '张三',
    contact: '13900000000',
    garment: '基础圆领T恤',
    garmentId: 'tee-001',
    size: 'M',
    quantity: 2,
    status: 'confirming',
    createdAt: '2026-11-08 11:30'
  }
];

Page({
  data: {
    list: DEMO_ORDERS,
    statusText: { pending: '待处理', confirming: '设计确认', completed: '已完成' },
    statusTagClass: { pending: 'xl-tag--warn', confirming: 'xl-tag--info', completed: 'xl-tag--success' }
  },

  onLoad() {
    if (!adminAuth.isLogged()) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    // TODO(阶段3): api.get('/api/admin/orders?status=&keyword=&page=') 填充 list
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/order-detail/index?id=' + id });
  }
});
