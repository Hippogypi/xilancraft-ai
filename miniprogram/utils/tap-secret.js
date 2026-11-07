/**
 * utils/tap-secret.js —— 隐藏管理入口检测器
 *
 * 在 windowMs 毫秒窗口内连续点满 requiredTaps 次（默认 2 秒 5 次）触发 onTrigger。
 * 用法（页面）：
 *   const { createTapDetector } = require('../../utils/tap-secret.js');
 *   onLoad() {
 *     this.secretTap = createTapDetector({ onTrigger: () => wx.navigateTo({ url: '/pages/admin/login/index' }) });
 *   },
 *   onLogoTap() { this.secretTap.handleTap(); }   // bindtap
 */
function createTapDetector(options) {
  const opts = options || {};
  const requiredTaps = opts.requiredTaps || 5;
  const windowMs = opts.windowMs || 2000;
  let taps = []; // bindtap 时间戳数组

  return {
    /** 每次 bindtap 调用 */
    handleTap() {
      const now = Date.now();
      taps.push(now);
      // 只保留窗口内的时间戳
      taps = taps.filter(function (t) { return now - t <= windowMs; });
      if (taps.length >= requiredTaps) {
        taps = [];
        if (typeof opts.onTrigger === 'function') opts.onTrigger();
      }
    },
    reset() {
      taps = [];
    }
  };
}

module.exports = { createTapDetector: createTapDetector };
