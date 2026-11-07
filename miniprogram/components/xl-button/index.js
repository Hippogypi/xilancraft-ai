/**
 * xl-button —— 通用按钮
 * type: primary（织锦红实底+金描边）/ ghost（透明+金描边）/ mini（小尺寸金描边）
 * loading / disabled 内置；点击通过 catchtap 拦截后 triggerEvent('tap') 抛出
 */
Component({
  properties: {
    type: { type: String, value: 'primary' },
    text: { type: String, value: '' },
    loading: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      if (this.data.loading || this.data.disabled) return;
      this.triggerEvent('tap');
    }
  }
});
