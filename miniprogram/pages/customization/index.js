/**
 * pages/customization —— 服装定制（WBS 05 P0/P1）
 * 预览叠加（printArea 百分比坐标 + 纹样 image 绝对定位）/ 模板横滑单选 /
 * 四滑杆调节（大小/水平/垂直/透明度，实时生效）/ 尺码数量 / 表单红字校验 /
 * 隐私勾选拦截 / POST /api/orders（契约 §4）/ 成功态大订单号
 */
const api = require('../../services/api.js');
const urlUtil = require('../../utils/url.js');

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
    // 来自工坊「用此纹样」的生成结果（onShow 经 globalData.pendingPattern 消费）
    // { jobId, imageUrl(已拼 BASE_URL 的绝对地址) }
    pattern: null,
    // 调节参数（WBS 05.03）：滑杆存整型百分比，提交时换算为契约 placement 数值
    scalePct: 100,      // 50 ~ 200 → scale 0.5 ~ 2.0
    offsetX: 0,         // -50 ~ 50（%，相对印花区）
    offsetY: 0,         // -50 ~ 50
    opacityPct: 100,    // 30 ~ 100 → opacity 0.3 ~ 1.0
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
    nameError: '',
    phoneError: '',
    privacyAccepted: false,
    privacyError: false,
    submitting: false,
    submitted: false,
    orderNo: '',
    submitError: ''
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
    // 消费工坊「用此纹样」带入的生成结果（tab 页不能带参，经 globalData 传递）
    const g = getApp();
    const pending = g.globalData.pendingPattern;
    if (pending && pending.jobId) {
      g.globalData.pendingPattern = null;
      this.setData({
        pattern: {
          jobId: pending.jobId,
          imageUrl: urlUtil.absoluteUrl(pending.imageUrl) // 相对路径拼 BASE_URL
        },
        // 新纹样 → 重置调节参数与订单态，进入新一轮定制
        submitted: false,
        orderNo: '',
        submitError: '',
        privacyAccepted: false,
        privacyError: false,
        scalePct: 100,
        offsetX: 0,
        offsetY: 0,
        opacityPct: 100
      });
      wx.showToast({ title: '已带入生成纹样', icon: 'none' });
    }
  },

  goWorkshop() {
    wx.switchTab({ url: '/pages/workshop/index' });
  },

  /* ---------- 模板 / 滑杆 / 尺码 / 数量 ---------- */
  onGarmentTap(e) {
    const id = e.currentTarget.dataset.id;
    const garment = this.data.garments.find(function (x) { return x.id === id; });
    if (!garment) return;
    this.setData({ garmentId: id, garment: garment });
  },
  // bindchanging + bindchange 双绑：拖动实时生效
  onScaleChange(e) {
    this.setData({ scalePct: e.detail.value });
  },
  onOffsetXChange(e) {
    this.setData({ offsetX: e.detail.value });
  },
  onOffsetYChange(e) {
    this.setData({ offsetY: e.detail.value });
  },
  onOpacityChange(e) {
    this.setData({ opacityPct: e.detail.value });
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

  /* ---------- 表单（红字校验） ---------- */
  onNameInput(e) {
    this.setData({ name: e.detail.value, nameError: '' });
  },
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value, phoneError: '' });
  },
  onPrivacyToggle() {
    this.setData({ privacyAccepted: !this.data.privacyAccepted, privacyError: false });
  },

  /* ---------- 提交 ---------- */
  onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.pattern || !this.data.pattern.jobId) {
      wx.showToast({ title: '请先去 AI 工坊生成纹样', icon: 'none' });
      return;
    }

    const name = (this.data.name || '').trim();
    const phone = (this.data.phone || '').trim();
    const patch = {};
    let valid = true;
    if (!name) {
      patch.nameError = '请输入联系人姓名';
      valid = false;
    }
    if (!phone) {
      patch.phoneError = '请输入联系电话';
      valid = false;
    } else if (!/^1\d{10}$/.test(phone)) {
      patch.phoneError = '手机号格式有误，应为 1 开头的 11 位数字';
      valid = false;
    }
    if (!valid) {
      this.setData(patch);
      wx.showToast({ title: '请完善联系信息', icon: 'none' });
      return;
    }
    if (!this.data.privacyAccepted) {
      // 隐私未勾选：拦截提交
      this.setData({ privacyError: true });
      wx.showToast({ title: '请先阅读并勾选演示说明', icon: 'none' });
      return;
    }

    this.setData({ submitting: true, submitError: '' });
    const that = this;
    api.post('/api/orders', {
      customerName: name,
      contact: phone,
      garmentTemplateId: this.data.garmentId,
      size: this.data.sizeValue,
      quantity: this.data.quantity,
      generationJobId: this.data.pattern.jobId,
      placement: {
        scale: this.data.scalePct / 100,
        offsetX: this.data.offsetX,
        offsetY: this.data.offsetY,
        opacity: this.data.opacityPct / 100
      },
      privacyAccepted: true
    })
      .then(function (res) {
        that.setData({
          submitting: false,
          submitted: true,
          orderNo: (res && res.orderNo) || ''
        });
      })
      .catch(function (err) {
        const msg = (err && err.friendlyMessage) || '提交失败，请稍后重试';
        that.setData({ submitting: false, submitError: msg });
        wx.showToast({ title: msg, icon: 'none' });
      });
  },

  goHome() {
    wx.switchTab({ url: '/pages/heritage/index' });
  }
});
