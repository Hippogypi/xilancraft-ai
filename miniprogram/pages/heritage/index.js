/**
 * pages/heritage —— 非遗导览（文化首页）
 * 主视觉横幅 / 简介三段 / 符号解构案例 / 织机视频 / 双跳转按钮
 * 标题 LOGO 区绑 tap-secret：2 秒内连点 5 次进入管理端登录页
 */
const { createTapDetector } = require('../../utils/tap-secret.js');

Page({
  data: {
    // TODO(阶段4): 替换为真实织机 MP4（H.264 ≤20MB，本地包内或网络地址）
    videoSrc: '',
    videoPoster: '',
    videoError: false,
    introSections: [
      {
        title: '历史 · 千年织韵',
        text: '西兰卡普是土家族最具代表性的织锦工艺，土家语中意为"花铺盖"。织造技艺世代口传心授，2006 年土家族织锦技艺入选首批国家级非物质文化遗产名录。'
      },
      {
        title: '工艺 · 通经断纬',
        text: '西兰卡普以"通经断纬"技艺织就：经线贯通到底，纬线随纹换色。织者看不见织物正面，全凭记忆在反面挑花，"心中有花、手上有数"，一寸锦要挑上百次。'
      },
      {
        title: '价值 · 无字史书',
        text: '四十八勾、阳雀花、台台花……两百余种纹样记录着土家族的自然崇拜与生活智慧，被誉为"穿在身上的史书"，正通过符号解构与几何重组走进当代设计。'
      }
    ]
  },

  onLoad() {
    // 隐藏管理入口：连点 5 次（2 秒窗口）触发跳转
    this.secretTap = createTapDetector({
      requiredTaps: 5,
      windowMs: 2000,
      onTrigger: () => {
        wx.navigateTo({ url: '/pages/admin/login/index' });
      }
    });
  },

  onLogoTap() {
    this.secretTap.handleTap();
  },

  onVideoError() {
    this.setData({ videoError: true });
  },

  goInspiration() {
    wx.switchTab({ url: '/pages/inspiration/index' });
  },

  goWorkshop() {
    wx.switchTab({ url: '/pages/workshop/index' });
  }
});
