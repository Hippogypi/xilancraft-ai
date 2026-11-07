/**
 * pages/admin/order-detail —— 订单详情 + 状态流转（阶段3：真实接口）
 * - GET   /api/admin/orders/:id        详情（纹样快照 patternImageUrl 拼 BASE_URL）
 * - PATCH /api/admin/orders/:id/status body {status}
 *   仅允许 pending → confirming（确认设计）→ completed（标记完成）单向流转；
 *   操作成功后重新拉取详情刷新
 */
const api = require('../../../services/api.js');
const common = require('../common.js');
const assetUrl = require('../../../utils/url.js').absoluteUrl;

/** placement 参数 → 展示行 */
function placementRows(placement) {
  if (!placement) return [];
  const rows = [];
  if (placement.scale !== undefined) rows.push({ label: '纹样缩放', value: '× ' + placement.scale });
  if (placement.offsetX !== undefined) rows.push({ label: '水平偏移', value: placement.offsetX + ' px' });
  if (placement.offsetY !== undefined) rows.push({ label: '垂直偏移', value: placement.offsetY + ' px' });
  if (placement.opacity !== undefined) rows.push({ label: '不透明度', value: Math.round(placement.opacity * 100) + '%' });
  return rows;
}

Page({
  data: {
    orderId: '',
    loading: true,
    order: null, // 序列化后含展示字段
    placementRows: [],
    advancing: false,
    statusText: common.ORDER_STATUS_TEXT,
    statusTagClass: common.ORDER_STATUS_TAG,
    action: common.ORDER_NEXT.pending // { status, label } 或 null
  },

  onLoad(options) {
    if (!common.requireLogin()) return;
    const id = (options && options.id) || '';
    this.setData({ orderId: id });
    this.fetchDetail();
  },

  fetchDetail() {
    const that = this;
    api
      .get('/api/admin/orders/' + this.data.orderId)
      .then(function (res) {
        that.applyOrder(res);
      })
      .catch(function (err) {
        that.setData({ loading: false });
        common.onApiError(err);
      });
  },

  applyOrder(order) {
    this.setData({
      loading: false,
      order: Object.assign({}, order, {
        patternImageFull: assetUrl(order.patternImageUrl),
        garmentName: common.garmentName(order.garmentTemplateId),
        timeText: common.formatTime(order.createdAt),
        updatedText: common.formatTime(order.updatedAt)
      }),
      placementRows: placementRows(order.placement),
      action: common.ORDER_NEXT[order.status] || null
    });
  },

  /** 状态流转：pending→确认设计(confirming) / confirming→标记完成(completed) */
  onAdvance() {
    const action = this.data.action;
    if (this.data.advancing || !action || !this.data.order) return;
    const that = this;
    this.setData({ advancing: true });
    api
      .patch('/api/admin/orders/' + this.data.order.id + '/status', { status: action.status })
      .then(function (res) {
        that.setData({ advancing: false });
        wx.showToast({ title: '已' + action.label, icon: 'success' });
        that.applyOrder(res); // 接口返回更新后的订单，直接应用（并刷新按钮态）
      })
      .catch(function (err) {
        that.setData({ advancing: false });
        common.onApiError(err, '流转失败，请重试');
      });
  }
});
