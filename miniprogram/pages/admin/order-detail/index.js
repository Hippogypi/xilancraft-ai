/**
 * pages/admin/order-detail —— 订单详情 + 状态流转
 * 阶段2底座：占位数据本地流转；阶段3接入
 *   GET /api/admin/orders/:id、PATCH /api/admin/orders/:id/status（仅 pending→confirming→completed 单向）
 */
const adminAuth = require('../../../services/admin-auth.js');

// 占位数据（与列表页一致，阶段3移除）
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

const FLOW = [
  { value: 'pending', label: '待处理' },
  { value: 'confirming', label: '设计确认' },
  { value: 'completed', label: '已完成' }
];

Page({
  data: {
    order: null,
    nextStatus: null,
    advancing: false,
    statusText: { pending: '待处理', confirming: '设计确认', completed: '已完成' },
    statusTagClass: { pending: 'xl-tag--warn', confirming: 'xl-tag--info', completed: 'xl-tag--success' }
  },

  onLoad(options) {
    if (!adminAuth.isLogged()) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    // TODO(阶段3): api.get('/api/admin/orders/' + options.id)
    const id = options && options.id;
    const order = DEMO_ORDERS.find(function (o) { return o.id === id; }) || DEMO_ORDERS[0];
    this.applyOrder(order);
  },

  applyOrder(order) {
    const idx = FLOW.findIndex(function (f) { return f.value === order.status; });
    const nextStatus = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
    this.setData({ order: order, nextStatus: nextStatus });
  },

  /** 状态流转（本地演示）；阶段3改 PATCH /api/admin/orders/:id/status body { status: next } */
  onAdvance() {
    if (this.data.advancing || !this.data.nextStatus) return;
    this.setData({ advancing: true });
    const that = this;
    // TODO(阶段3): api.patch('/api/admin/orders/' + order.id + '/status', { status: nextStatus.value })
    setTimeout(function () {
      const order = Object.assign({}, that.data.order, { status: that.data.nextStatus.value });
      that.applyOrder(order);
      that.setData({ advancing: false });
      wx.showToast({ title: '已流转（阶段3接真实接口）', icon: 'none' });
    }, 400);
  }
});
