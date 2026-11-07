/**
 * pages/inspiration —— 灵感素材库
 * 分类筛选 / 2 列网格 / 详情半屏弹层 / 「以此为灵感」→ 工坊（经 globalData 传参）
 * 素材为本地 JSON（assets/data/motifs.json），不走后端（api-contract.md §4）
 */

// require JSON 失败时兜底为空数组，页面呈现空态
function loadMotifs() {
  try {
    return require('../../assets/data/motifs.json') || [];
  } catch (e) {
    return [];
  }
}

Page({
  data: {
    categories: [
      { label: '全部', value: 'all' },
      { label: '传统纹样', value: 'traditional' },
      { label: '现代转译', value: 'modern' }
    ],
    category: 'all',
    motifs: [],
    list: [],
    showDetail: false,
    detail: null
  },

  onLoad() {
    const motifs = loadMotifs();
    this.setData({ motifs: motifs, list: motifs });
  },

  onCategoryChange(e) {
    const category = e.detail.value;
    const list = category === 'all'
      ? this.data.motifs
      : this.data.motifs.filter(function (m) { return m.category === category; });
    this.setData({ category: category, list: list });
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    const detail = this.data.motifs.find(function (m) { return m.id === id; });
    if (!detail) return;
    this.setData({ detail: detail, showDetail: true });
  },

  onDetailClose() {
    this.setData({ showDetail: false });
  },

  /**
   * 「以此为灵感」→ 工坊（tab 页，switchTab 无法带 URL 参数，
   * motifId 与 keywords 经 app.globalData.pendingMotif 传递，workshop onShow 消费）
   */
  onUseAsInspiration() {
    const detail = this.data.detail;
    if (!detail) return;
    getApp().globalData.pendingMotif = {
      id: detail.id,
      name: detail.name,
      keywords: detail.keywords || []
    };
    this.setData({ showDetail: false });
    wx.switchTab({ url: '/pages/workshop/index' });
  }
});
