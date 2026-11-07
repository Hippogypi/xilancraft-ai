/**
 * pages/admin/providers —— Provider 列表（阶段3：真实接口）
 * - GET  /api/admin/providers           列表（camelCase，含 hasApiKey，绝不含密钥）
 * - POST /api/admin/providers/:id/test  测试生成（按钮 loading，显示耗时+缩略图/错误）
 * - POST /api/admin/providers/:id/activate 激活（确认弹窗：激活后用户端使用该服务；
 *   契约无独立"停用"端点，激活其他 Provider 即自动切换，故不提供停用按钮）
 * - 下拉刷新；从编辑页返回 onShow 自动刷新
 */
const api = require('../../../services/api.js');
const common = require('../common.js');
const assetUrl = require('../../../utils/url.js').absoluteUrl;

Page({
  data: {
    loading: true,
    list: [], // [{ id,name,adapterType,modelId,baseUrl,hasApiKey,active,lastTestStatus,... }]
    testingId: '', // 正在执行测试生成的 provider id（按钮 loading）
    activatingId: '', // 正在激活的 provider id
    testView: null // 最近一次测试结果 { providerId,status,durationMs,imageUrl,error }
  },

  onLoad() {
    if (!common.requireLogin()) return;
  },

  onShow() {
    // 初次进入与从编辑页返回均刷新（含 lastTestStatus）
    if (!common.requireLogin()) return;
    this.fetchList();
  },

  onPullDownRefresh() {
    this.fetchList(true);
  },

  fetchList(silent) {
    const that = this;
    if (!silent) this.setData({ loading: true });
    api
      .get('/api/admin/providers')
      .then(function (res) {
        that.setData({ list: (res && res.list) || [], loading: false });
        wx.stopPullDownRefresh();
      })
      .catch(function (err) {
        that.setData({ loading: false });
        wx.stopPullDownRefresh();
        common.onApiError(err);
      });
  },

  /** 测试生成：POST /api/admin/providers/:id/test → {status,durationMs,imageUrl?,error?} */
  onTest(e) {
    if (this.data.testingId) return;
    const id = e.currentTarget.dataset.id;
    const that = this;
    this.setData({ testingId: id, testView: null });
    api
      .post('/api/admin/providers/' + id + '/test')
      .then(function (res) {
        that.setData({
          testingId: '',
          testView: {
            providerId: id,
            status: res.status, // success | failed
            durationMs: res.durationMs,
            imageUrl: assetUrl(res.imageUrl),
            error: res.error || null
          }
        });
        // 服务端已更新 last_test_status，刷新列表徽标
        that.fetchList(true);
      })
      .catch(function (err) {
        that.setData({ testingId: '' });
        common.onApiError(err, '测试请求失败，请稍后重试');
      });
  },

  /** 激活：确认后 POST activate（原子切换，其余自动停用） */
  onActivate(e) {
    if (this.data.activatingId) return;
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '激活该 AI 服务？',
      content: '激活后用户端生成将使用该服务，其余配置自动停用。',
      confirmText: '激活',
      confirmColor: '#C9A063',
      success: function (r) {
        if (!r.confirm) return;
        that.setData({ activatingId: id });
        api
          .post('/api/admin/providers/' + id + '/activate')
          .then(function () {
            that.setData({ activatingId: '' });
            wx.showToast({ title: '已激活', icon: 'success' });
            that.fetchList(true);
          })
          .catch(function (err) {
            that.setData({ activatingId: '' });
            common.onApiError(err, '激活失败，请检查配置');
          });
      }
    });
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/providers-edit/index?id=' + id });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/admin/providers-edit/index' });
  }
});
