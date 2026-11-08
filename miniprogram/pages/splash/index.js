/**
 * pages/splash —— 开屏品牌动画（纯 CSS 编排，总时长约 3 秒，零图片素材/零依赖）
 * 阶段：纹样错落浮现(0-0.7s) → 几何聚合(0.7-1.4s) → 品牌标题模糊转清晰(1.4-2.2s) → 入口按钮(2.2-3s)
 * 会话级防重播：globalData.splashShown（冷启动重置=每次使用播放一次）
 * 跳过/点击「开启共创」→ 300ms 淡出 → 非遗导览首页（保留全部 Tab 结构与业务）
 */
Page({
  data: {
    leaving: false
  },

  onLoad() {
    // 同一次使用过程中避免重复播放：已看过则静默直达首页
    if (getApp().globalData.splashShown) {
      wx.switchTab({ url: '/pages/heritage/index' });
    }
  },

  /** 跳过动画 与 点击入口按钮共用：淡出后进入非遗导览 */
  finish() {
    if (this.data.leaving) return;
    getApp().globalData.splashShown = true;
    this.setData({ leaving: true });
    setTimeout(function () {
      wx.switchTab({ url: '/pages/heritage/index' });
    }, 300);
  }
});
