/**
 * pages/heritage —— 非遗导览（文化首页，WBS 02）
 * ① 主视觉横幅（css 渐变织锦）② 简介三段 ③ 符号解构·几何重组案例卡
 * ④ 织机视频卡（server /api/assets/loom.mp4，失败占位）
 * ⑤ 底部双按钮跳素材库/工坊
 * 标题 LOGO 区绑 tap-secret：2 秒内连点 5 次进入管理端登录页（勿删）
 */
const { createTapDetector } = require('../../utils/tap-secret.js');
const { absoluteUrl } = require('../../utils/url.js');

/** 读取本地素材 JSON（另一任务会重写并填充真实图片；此处只按 schema 容错读取） */
function loadMotifs() {
  try {
    return require('../../assets/data/motifs.js') || [];
  } catch (e) {
    return [];
  }
}

Page({
  data: {
    // ② 简介三段：历史 / 工艺 / 价值
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
    ],

    // ③ 符号解构案例图：包内本地路径（/assets/motifs/**），不用 absoluteUrl；
    //    素材 JSON 未就位时为空串 → wxss 几何装饰块；加载失败 binderror → 同样回退装饰块
    dcdTradImg: '',
    dcdModernImg: '',
    dcdTradImgError: false,
    dcdModernImgError: false,

    // ④ 织机视频：server 静态资源路由 GET /api/assets/loom.mp4（约 7.3MB）
    videoSrc: absoluteUrl('/api/assets/loom.mp4'),
    videoPoster: '',
    videoError: false
  },

  onLoad() {
    // 隐藏管理入口：连点 5 次（2 秒窗口）触发跳转（勿删）
    this.secretTap = createTapDetector({
      requiredTaps: 5,
      windowMs: 2000,
      onTrigger: () => {
        wx.navigateTo({ url: '/pages/admin/login/index' });
      }
    });

    // 解构案例图与视频封面：取素材库第一条 traditional / modern 的 image（可能为空串）
    const motifs = loadMotifs();
    const trad = motifs.find(function (m) { return m.category === 'traditional' && m.image; });
    const modern = motifs.find(function (m) { return m.category === 'modern' && m.image; });
    this.setData({
      dcdTradImg: trad ? trad.image : '',
      dcdModernImg: modern ? modern.image : '',
      videoPoster: trad ? trad.image : ''
    });
  },

  onLogoTap() {
    this.secretTap.handleTap();
  },

  /* ---------- ③ 解构案例图容错：加载失败回退装饰块 ---------- */
  onDcdTradImgError() {
    if (!this.data.dcdTradImgError) this.setData({ dcdTradImgError: true });
  },
  onDcdModernImgError() {
    if (!this.data.dcdModernImgError) this.setData({ dcdModernImgError: true });
  },

  /* ---------- ④ 织机视频：加载失败占位 + 重试 ---------- */
  onVideoError() {
    this.setData({ videoError: true });
  },
  onVideoRetry() {
    // wx:if 切换会卸载/重建 video 组件，触发重新请求（需先置 error=false 恢复渲染）
    this.setData({ videoError: false });
  },

  /* ---------- ⑤ 底部双按钮 ---------- */
  goInspiration() {
    wx.switchTab({ url: '/pages/inspiration/index' });
  },
  goWorkshop() {
    wx.switchTab({ url: '/pages/workshop/index' });
  }
});
