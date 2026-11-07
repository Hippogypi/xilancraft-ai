/**
 * pages/admin/providers-edit —— 新增/编辑 Provider（query 带 id 为编辑）
 * - 编辑：GET /api/admin/providers 后本地取该项回填（密钥不回显，仅 hasApiKey）
 * - 保存：新增 POST /api/admin/providers；编辑 PATCH /api/admin/providers/:id
 *   body { name, adapterType, baseUrl, modelId, settings:{timeout,dailyLimit} }
 *   apiKey 留空不传（= 不修改）；成功后返回列表（列表 onShow 自动刷新）
 * - 测试生成 / 激活：仅已保存（编辑态）可用
 */
const api = require('../../../services/api.js');
const common = require('../common.js');
const assetUrl = require('../../../utils/url.js').absoluteUrl;

const ADAPTER_TYPES = ['openai_compatible', 'mock'];

Page({
  data: {
    isEdit: false,
    providerId: '',
    loadingDetail: false, // 编辑态拉取详情中
    active: false, // 编辑态：当前是否激活
    name: '',
    adapterTypes: ADAPTER_TYPES,
    adapterIndex: 0,
    baseUrl: '',
    modelId: '',
    apiKey: '',
    hasApiKey: false, // 编辑态：服务端是否已存密钥
    timeoutSec: '120',
    dailyLimit: '50',
    saving: false,
    testing: false,
    activating: false,
    testResult: null // { status, durationMs, imageUrl(完整), error }
  },

  onLoad(options) {
    if (!common.requireLogin()) return;
    if (options && options.id) {
      this.setData({ isEdit: true, providerId: options.id });
      wx.setNavigationBarTitle({ title: '编辑配置' });
      this.fetchDetail(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新增配置' });
    }
  },

  /** 编辑态：GET 列表后本地取详情回填 */
  fetchDetail(id) {
    const that = this;
    this.setData({ loadingDetail: true });
    api
      .get('/api/admin/providers')
      .then(function (res) {
        const item = (((res && res.list) || []).filter(function (p) { return p.id === id; })[0]);
        that.setData({ loadingDetail: false });
        if (!item) {
          wx.showToast({ title: '该配置不存在或已被删除', icon: 'none' });
          setTimeout(function () { wx.navigateBack(); }, 900);
          return;
        }
        const settings = item.settings || {};
        that.setData({
          name: item.name,
          adapterIndex: Math.max(0, ADAPTER_TYPES.indexOf(item.adapterType)),
          baseUrl: item.baseUrl || '',
          modelId: item.modelId || '',
          hasApiKey: !!item.hasApiKey,
          active: !!item.active,
          timeoutSec: String(settings.timeout || 120),
          dailyLimit: String(settings.dailyLimit || 50)
        });
      })
      .catch(function (err) {
        that.setData({ loadingDetail: false });
        common.onApiError(err);
      });
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onAdapterChange(e) { this.setData({ adapterIndex: Number(e.detail.value) }); },
  onBaseUrlInput(e) { this.setData({ baseUrl: e.detail.value }); },
  onModelIdInput(e) { this.setData({ modelId: e.detail.value }); },
  onApiKeyInput(e) { this.setData({ apiKey: e.detail.value }); },
  onTimeoutInput(e) { this.setData({ timeoutSec: e.detail.value }); },
  onDailyLimitInput(e) { this.setData({ dailyLimit: e.detail.value }); },

  /** 本地校验，返回错误文案或空串（与服务端 validateConfig / settings 校验对齐） */
  validate() {
    const d = this.data;
    const name = (d.name || '').trim();
    const baseUrl = (d.baseUrl || '').trim();
    const modelId = (d.modelId || '').trim();
    const apiKey = (d.apiKey || '').trim();
    const adapterType = ADAPTER_TYPES[d.adapterIndex];
    const timeout = Number(d.timeoutSec);
    const dailyLimit = Number(d.dailyLimit);

    if (!name) return '请填写名称';
    if (name.length > 50) return '名称最多 50 字';
    if (adapterType === 'openai_compatible') {
      if (!baseUrl) return 'openai_compatible 需填写 Base URL（如 https://open.bigmodel.cn/api/paas/v4）';
      if (!/^https?:\/\//i.test(baseUrl)) return 'Base URL 需以 http(s):// 开头';
      if (!modelId) return 'openai_compatible 需填写模型 ID（如 cogview-3-flash）';
      if (!apiKey && (!d.isEdit || !d.hasApiKey)) {
        return '新增/未配置密钥时需填写 API Key（仅服务端加密存储）';
      }
    }
    if (!Number.isFinite(timeout) || Math.floor(timeout) !== timeout || timeout < 5 || timeout > 300) {
      return '超时时间须为 5~300 的整数秒';
    }
    if (!Number.isFinite(dailyLimit) || Math.floor(dailyLimit) !== dailyLimit || dailyLimit < 1 || dailyLimit > 10000) {
      return '每日调用上限须为 1~10000 的整数';
    }
    return '';
  },

  /** 保存：新增 POST / 编辑 PATCH；apiKey 留空不传 = 不修改 */
  onSave() {
    if (this.data.saving) return;
    const invalid = this.validate();
    if (invalid) {
      wx.showToast({ title: invalid, icon: 'none' });
      return;
    }
    const d = this.data;
    const body = {
      name: (d.name || '').trim(),
      adapterType: ADAPTER_TYPES[d.adapterIndex],
      baseUrl: (d.baseUrl || '').trim(),
      modelId: (d.modelId || '').trim(),
      settings: { timeout: Number(d.timeoutSec), dailyLimit: Number(d.dailyLimit) }
    };
    const apiKey = (d.apiKey || '').trim();
    if (apiKey) body.apiKey = apiKey; // 留空 = 不传 = 服务端保持原密钥

    this.setData({ saving: true });
    const that = this;
    const req = d.isEdit
      ? api.patch('/api/admin/providers/' + d.providerId, body)
      : api.post('/api/admin/providers', body);

    req
      .then(function () {
        that.setData({ saving: false });
        wx.showToast({ title: '已保存', icon: 'success' });
        // 返回列表页（其 onShow 自动刷新）
        setTimeout(function () { wx.navigateBack(); }, 600);
      })
      .catch(function (err) {
        that.setData({ saving: false });
        common.onApiError(err, '保存失败，请检查配置');
      });
  },

  /** 测试生成：POST /api/admin/providers/:id/test → {status,durationMs,imageUrl?,error?} */
  onTest() {
    if (this.data.testing) return;
    if (!this.data.isEdit) {
      wx.showToast({ title: '请先保存配置再测试', icon: 'none' });
      return;
    }
    this.setData({ testing: true, testResult: null });
    const that = this;
    api
      .post('/api/admin/providers/' + this.data.providerId + '/test')
      .then(function (res) {
        that.setData({
          testing: false,
          testResult: {
            status: res.status,
            durationMs: res.durationMs,
            imageUrl: assetUrl(res.imageUrl),
            error: res.error || null
          }
        });
      })
      .catch(function (err) {
        that.setData({ testing: false });
        common.onApiError(err, '测试请求失败，请稍后重试');
      });
  },

  /** 激活：POST /api/admin/providers/:id/activate（原子切换） */
  onActivate() {
    if (this.data.activating) return;
    if (!this.data.isEdit) {
      wx.showToast({ title: '请先保存配置再激活', icon: 'none' });
      return;
    }
    if (this.data.active) {
      wx.showToast({ title: '该配置已是使用中', icon: 'none' });
      return;
    }
    const that = this;
    wx.showModal({
      title: '激活该 AI 服务？',
      content: '激活后用户端生成将使用该服务，其余配置自动停用。',
      confirmText: '激活',
      confirmColor: '#C9A063',
      success: function (r) {
        if (!r.confirm) return;
        that.setData({ activating: true });
        api
          .post('/api/admin/providers/' + that.data.providerId + '/activate')
          .then(function () {
            that.setData({ activating: false, active: true });
            wx.showToast({ title: '已激活', icon: 'success' });
          })
          .catch(function (err) {
            that.setData({ activating: false });
            common.onApiError(err, '激活失败，请先保存并检查配置');
          });
      }
    });
  }
});
