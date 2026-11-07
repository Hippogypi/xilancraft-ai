/**
 * pages/workshop —— AI 定制工坊
 * 提示词 / 风格 / 配色 / 应用部位 / 参考纹样 / 生成状态机
 * 阶段2底座：生成为本地模拟（成功占位）；阶段3接入
 *   POST /api/generations + GET /api/generations/:id 轮询（间隔 2s、最长 150s）
 */

function loadMotifs() {
  try {
    return require('../../assets/data/motifs.json') || [];
  } catch (e) {
    return [];
  }
}

Page({
  data: {
    prompt: '',
    styles: [
      { label: '街头潮流', value: 'modern_streetwear' },
      { label: '新中式', value: 'neo_chinese' },
      { label: '极简', value: 'minimalist' },
      { label: '科技感', value: 'techwear' }
    ],
    styleValue: 'modern_streetwear',
    palettes: [
      { label: '织锦五彩', value: 'brocade_five' },
      { label: '黑金', value: 'black_gold' },
      { label: '青蓝', value: 'indigo_blue' }
    ],
    paletteValue: 'brocade_five',
    placements: [
      { label: '胸前印花', value: 'chest' },
      { label: '背部大图', value: 'back' },
      { label: '局部装饰', value: 'accent' }
    ],
    placementValue: 'chest',
    referenceMotifs: [],
    referenceMotifId: '',
    referenceMotifName: '',
    // idle | running | succeeded | failed
    genStatus: 'idle',
    genResult: { jobId: '', imageUrl: '' },
    errorMsg: ''
  },

  onLoad() {
    this.setData({ referenceMotifs: loadMotifs() });
  },

  onShow() {
    // 消费素材库「以此为灵感」带入的纹样（switchTab 无法带 URL 参数，经 globalData）
    const g = getApp();
    const pending = g.globalData.pendingMotif;
    if (pending && pending.id) {
      g.globalData.pendingMotif = null;
      this.setData({
        referenceMotifId: pending.id,
        referenceMotifName: pending.name
      });
      wx.showToast({ title: '已带入参考：' + pending.name, icon: 'none' });
    }
  },

  onPromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },
  onStyleChange(e) {
    this.setData({ styleValue: e.detail.value });
  },
  onPaletteChange(e) {
    this.setData({ paletteValue: e.detail.value });
  },
  onPlacementChange(e) {
    this.setData({ placementValue: e.detail.value });
  },
  onRefTap(e) {
    const id = e.currentTarget.dataset.id || '';
    const motif = this.data.referenceMotifs.find(function (m) { return m.id === id; });
    this.setData({
      referenceMotifId: id,
      referenceMotifName: motif ? motif.name : ''
    });
  },

  /**
   * 生成。阶段2为本地模拟成功（占位图）；阶段3 TODO：
   *  1. 组装重构型 Prompt（文化元素+设计方法+风格+配色+部位+用户补充）
   *  2. api.post('/api/generations', { mode:'text_to_image', prompt, style, size:'1024x1024', referenceMotifId })
   *  3. 轮询 api.get('/api/generations/' + jobId)（2s 间隔 / 150s 上限），按状态机更新 genStatus
   */
  onGenerate() {
    if (this.data.genStatus === 'running') return;
    const prompt = (this.data.prompt || '').trim();
    if (!prompt) {
      wx.showToast({ title: '请先输入创意提示词', icon: 'none' });
      return;
    }
    this.setData({ genStatus: 'running', errorMsg: '' });
    const that = this;
    // TODO(阶段3): 替换为真实请求；失败路径将 genStatus 置 'failed' 并填 errorMsg（err.friendlyMessage）
    setTimeout(function () {
      that.setData({
        genStatus: 'succeeded',
        genResult: { jobId: 'demo-job-' + Date.now(), imageUrl: '' }
      });
    }, 2500);
  },

  /** 用此纹样 → 定制页（tab 页，经 globalData 传参） */
  onUsePattern() {
    getApp().globalData.pendingPattern = {
      jobId: this.data.genResult.jobId,
      imageUrl: this.data.genResult.imageUrl,
      prompt: this.data.prompt
    };
    wx.switchTab({ url: '/pages/customization/index' });
  }
});
