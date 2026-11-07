/**
 * pages/inspiration —— 灵感素材库（WBS 03）
 * ① 分类 chips（全部/传统纹样/现代转译）② 2 列卡片网格（图片空/加载失败→几何占位+「纹样示意」角标）
 * ③ 详情半屏弹层（大图/寓意/关键词/来源；referenceAllowed → 「以此为灵感」跳工坊）
 * ④ 传统 vs 现代 对比卡 ⑤ 素材读取失败 → xl-empty
 * 素材为本地 JSON（assets/data/motifs.json，另一任务负责重写与真实图片，本页只按 schema 容错读取）
 */

/** 读取本地素材 JSON；失败返回 null（页面据此显示加载失败空态） */
function loadMotifs() {
  try {
    const data = require('../../assets/data/motifs.json');
    return Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
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
    motifs: [],       // 全量素材（master）
    list: [],         // 当前分类过滤结果
    loadError: false, // motifs.json 读取失败（区别于分类下无数据）
    // 详情弹层
    showDetail: false,
    detail: null,
    detailImgError: false,
    // 对比卡精选图（第一条 traditional / modern 的 image，空/失败回退装饰）
    vsTradImg: '',
    vsModernImg: '',
    vsTradImgError: false,
    vsModernImgError: false
  },

  onLoad() {
    const motifs = loadMotifs();
    if (motifs === null) {
      this.setData({ motifs: [], list: [], loadError: true });
      return;
    }
    // 对比卡静态精选：优先取素材库图，取不到则由 wxss 几何装饰兜底
    const trad = motifs.find(function (m) { return m.category === 'traditional' && m.image; });
    const modern = motifs.find(function (m) { return m.category === 'modern' && m.image; });
    this.setData({
      motifs: motifs,
      list: motifs,
      vsTradImg: trad ? trad.image : '',
      vsModernImg: modern ? modern.image : ''
    });
  },

  /* ---------- ① 分类切换 ---------- */
  onCategoryChange(e) {
    const category = e.detail.value;
    const list = category === 'all'
      ? this.data.motifs
      : this.data.motifs.filter(function (m) { return m.category === category; });
    this.setData({ category: category, list: list });
  },

  /* ---------- ② 网格图容错：加载失败回退几何占位（标记在 item 上，切分类后仍保留） ---------- */
  onImgError(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.list.findIndex(function (m) { return m.id === id; });
    if (idx < 0 || this.data.list[idx]._imgError) return;
    this.setData({ ['list[' + idx + ']._imgError']: true });
  },

  /* ---------- ③ 详情弹层 ---------- */
  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    const detail = this.data.motifs.find(function (m) { return m.id === id; });
    if (!detail) return;
    this.setData({ detail: detail, showDetail: true, detailImgError: false });
  },
  onDetailClose() {
    this.setData({ showDetail: false });
  },
  onDetailImgError() {
    if (!this.data.detailImgError) this.setData({ detailImgError: true });
  },

  /* ---------- 对比卡图容错 ---------- */
  onVsTradImgError() {
    if (!this.data.vsTradImgError) this.setData({ vsTradImgError: true });
  },
  onVsModernImgError() {
    if (!this.data.vsModernImgError) this.setData({ vsModernImgError: true });
  },

  /**
   * 「以此为灵感」→ 工坊（WBS 03.05，tab 页 switchTab 无法带 URL 参数，
   * 经 app.globalData.pendingMotif 传递 { id, name, keywords }，workshop onShow 消费）
   */
  onUseAsInspiration() {
    const detail = this.data.detail;
    if (!detail) return;
    if (detail.referenceAllowed === false) {
      wx.showToast({ title: '该素材暂未开放作为 AI 参考', icon: 'none' });
      return;
    }
    getApp().globalData.pendingMotif = {
      id: detail.id,
      name: detail.name,
      keywords: detail.keywords || []
    };
    this.setData({ showDetail: false });
    wx.switchTab({ url: '/pages/workshop/index' });
  }
});
