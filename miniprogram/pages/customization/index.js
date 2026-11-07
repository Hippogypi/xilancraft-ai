/**
 * pages/customization —— 服装定制
 * 预览叠加（printArea 百分比坐标）/ 模板选择 / 四滑杆调节 / 尺码数量 / 表单 / 隐私勾选 / 提交成功态
 * 阶段2底座：订单为本地模拟；阶段3接入 POST /api/orders（api-contract.md §4）
 */

function loadGarments() {
  try {
    return require('../../assets/data/garments.json') || [];
  } catch (e) {
    return [];
  }
}

Page({
  data: {
    garments: [],
    garmentId: '',
    garment: null,
    // placement 参数（提交时随订单快照，对应契约 placement 字段）
    scale: 1,        // 0.5 ~ 2.0
    offsetX: 0,      // -50 ~ 50（%，相对印花区）
    offsetY: 0,      // -50 ~ 50
    opacity: 1,      // 0.1 ~ 1.0
    sizes: [
      { label: 'S', value: 'S' },
      { label: 'M', value: 'M' },
      { label: 'L', value: 'L' },
      { label: 'XL', value: 'XL' }
    ],
    sizeValue: 'L',
    quantity: 1,
    // 联系人（演示虚构预填数据）
    name: '演示用户',
    phone: '13800000000',
    privacyAccepted: false,
    privacyError: false,
    submitting: false,
    submitted: false,
    orderNo: '',
    // 来自工坊页的纹样（经 globalData.pendingPattern）
    pattern: null
  },

  onLoad() {
    const garments = loadGarments();
    this.setData({
      garments: garments,
      garmentId: garments.length ? garments[0].id : '',
      garment: garments.length ? garments[0] : null
    });
  },

  onShow() {
    // 消费工坊「用此纹样」带入的生成结果
    const g = getApp();
    const pending = g.globalData.pendingPattern;
    if (pending && pending.jobId) {
      g.globalData.pendingPattern = null;
      this.setData({ pattern: pending });
      wx.showToast({ title: '已带入生成纹样', icon: 'none' });
    }
  },

  /* ---------- 模板 / 滑杆 / 尺码 / 数量 ---------- */
  onGarmentTap(e) {
    const id = e.currentTarget.dataset.id;
    const garment = this.data.garments.find(function (x) { return x.id === id; });
    if (!garment) return;
    this.setData({ garmentId: id, garment: garment });
  },
  onScaleChange(e) {
    this.setData({ scale: e.detail.value / 100 });
  },
  onOffsetXChange(e) {
    this.setData({ offsetX: e.detail.value });
  },
  onOffsetYChange(e) {
    this.setData({ offsetY: e.detail.value });
  },
  onOpacityChange(e) {
    this.setData({ opacity: e.detail.value / 100 });
  },
  onSizeChange(e) {
    this.setData({ sizeValue: e.detail.value });
  },
  onMinus() {
    if (this.data.quantity <= 1) return;
    this.setData({ quantity: this.data.quantity - 1 });
  },
  onPlus() {
    if (this.data.quantity >= 9) return;
    this.setData({ quantity: this.data.quantity + 1 });
  },

  /* ---------- 表单 ---------- */
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },
  onPrivacyToggle() {
    this.setData({ privacyAccepted: !this.data.privacyAccepted, privacyError: false });
  },

  /* ---------- 提交 ---------- */
  onSubmit() {
    if (this.data.submitting) return;
    const name = (this.data.name || '').trim();
    const phone = (this.data.phone || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!phone) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '联系电话格式有误', icon: 'none' });
      return;
    }
    if (!this.data.privacyAccepted) {
      this.setData({ privacyError: true });
      wx.showToast({ title: '请先勾选演示用途说明', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    const that = this;

    // TODO(阶段3): 改为调用 api.post('/api/orders', {
    //   customerName, contact, garmentTemplateId, size, quantity,
    //   generationJobId: this.data.pattern ? this.data.pattern.jobId : '',
    //   placement: { scale, offsetX, offsetY, opacity },
    //   privacyAccepted: true
    // })，以服务端返回的 orderNo（XLKP-日期-XXXX）渲染成功态
    setTimeout(function () {
      const demoNo = 'XLKP-DEMO-' + String(Date.now()).slice(-6);
      that.setData({ submitting: false, submitted: true, orderNo: demoNo });
    }, 800);
  },

  goHome() {
    wx.switchTab({ url: '/pages/heritage/index' });
  },
  resetForm() {
    this.setData({
      submitted: false,
      orderNo: '',
      privacyAccepted: false,
      privacyError: false,
      quantity: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      opacity: 1
    });
  }
});
