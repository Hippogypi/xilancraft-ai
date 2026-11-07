/**
 * pages/admin/providers-edit —— 新增/编辑 Provider（query 带 id 为编辑）
 * 阶段2底座：表单结构 + 本地校验；阶段3接入：
 *   POST /api/admin/providers（新增）/ PATCH /api/admin/providers/:id（修改）
 *   POST /api/admin/providers/:id/test（测试生成）
 *   POST /api/admin/providers/:id/activate（激活）
 */
const adminAuth = require('../../../services/admin-auth.js');

Page({
  data: {
    isEdit: false,
    providerId: '',
    name: '',
    adapterTypes: ['openai_compatible', 'mock'],
    adapterIndex: 0,
    baseUrl: '',
    modelId: '',
    apiKey: '',
    timeoutSec: '120',
    dailyLimit: '50',
    saving: false,
    testing: false,
    testResult: null // { status, durationMs, error }
  },

  onLoad(options) {
    if (!adminAuth.isLogged()) {
      wx.redirectTo({ url: '/pages/admin/login/index' });
      return;
    }
    if (options && options.id) {
      this.setData({ isEdit: true, providerId: options.id });
      wx.setNavigationBarTitle({ title: '编辑配置' });
      // TODO(阶段3): api.get('/api/admin/providers') 后取该项回填（密钥不回显，仅 hasApiKey 标记）
    } else {
      wx.setNavigationBarTitle({ title: '新增配置' });
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onAdapterChange(e) { this.setData({ adapterIndex: Number(e.detail.value) }); },
  onBaseUrlInput(e) { this.setData({ baseUrl: e.detail.value }); },
  onModelIdInput(e) { this.setData({ modelId: e.detail.value }); },
  onApiKeyInput(e) { this.setData({ apiKey: e.detail.value }); },
  onTimeoutInput(e) { this.setData({ timeoutSec: e.detail.value }); },
  onDailyLimitInput(e) { this.setData({ dailyLimit: e.detail.value }); },

  /** 保存（新增 POST / 编辑 PATCH；apiKey 留空 = 不修改） */
  onSave() {
    if (this.data.saving) return;
    const name = (this.data.name || '').trim();
    const baseUrl = (this.data.baseUrl || '').trim();
    const modelId = (this.data.modelId || '').trim();
    if (!name) { wx.showToast({ title: '请填写名称', icon: 'none' }); return; }
    if (!baseUrl) { wx.showToast({ title: '请填写 Base URL', icon: 'none' }); return; }
    if (!modelId) { wx.showToast({ title: '请填写模型 ID', icon: 'none' }); return; }
    this.setData({ saving: true });
    const that = this;

    // TODO(阶段3): body = { name, adapter_type, base_url, model_id, timeoutSec, dailyLimit }
    //   apiKey 非空时才携带；新增 api.post('/api/admin/providers', body)
    //   编辑 api.patch('/api/admin/providers/' + providerId, body)，成功后 navigateBack
    setTimeout(function () {
      that.setData({ saving: false });
      wx.showToast({ title: '已保存（阶段3接入真实接口）', icon: 'none' });
    }, 400);
  },

  /** 测试生成（POST /api/admin/providers/:id/test，返回 {status, durationMs, imageUrl?, error?}） */
  onTest() {
    if (this.data.testing) return;
    if (!this.data.isEdit) {
      wx.showToast({ title: '请先保存配置再测试', icon: 'none' });
      return;
    }
    this.setData({ testing: true });
    const that = this;
    // TODO(阶段3): api.post('/api/admin/providers/' + providerId + '/test')
    setTimeout(function () {
      that.setData({
        testing: false,
        testResult: { status: 'success', durationMs: 1360, error: '' }
      });
    }, 600);
  },

  /** 激活（POST /api/admin/providers/:id/activate，原子切换，其余自动停用） */
  onActivate() {
    if (!this.data.isEdit) {
      wx.showToast({ title: '请先保存配置再激活', icon: 'none' });
      return;
    }
    // TODO(阶段3): api.post('/api/admin/providers/' + providerId + '/activate')
    wx.showToast({ title: '已激活（阶段3接入真实接口）', icon: 'none' });
  }
});
