/**
 * xl-half-screen —— 底部半屏弹层容器（遮罩 + 底部滑出面板）
 * properties: show(Boolean) 控制显隐；title(String) 标题
 * 关闭（点遮罩/✕）triggerEvent('close')，由页面决定是否置 show=false
 */
Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' }
  },
  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    noop() {}
  }
});
