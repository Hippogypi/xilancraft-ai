/**
 * xl-chips —— 单选 chip 组
 * properties: options: [{ label, value }]，value: 当前选中值
 * 选中项金色描边；点击 triggerEvent('change', { value })
 */
Component({
  properties: {
    options: { type: Array, value: [] },
    value: { type: null, value: '' }
  },
  methods: {
    onChipTap(e) {
      const value = e.currentTarget.dataset.value;
      if (value === this.data.value) return;
      this.triggerEvent('change', { value: value });
    }
  }
});
