/**
 * pages/customization —— 服装定制（WBS 05 P0/P1）
 * 预览叠加（衣服轮廓=剪辑蒙版：纹样满画布自由摆放，超出轮廓自动裁剪；printArea 仅作默认落位）/
 * 纹样拖拽（touch 手势，与滑杆双向同步）/ 模板横滑单选 /
 * 四滑杆调节（大小/水平/垂直/透明度，实时生效）/ 尺码数量 / 表单红字校验 /
 * 隐私勾选拦截 / POST /api/orders（契约 §4）/ 成功态大订单号
 */
const api = require('../../services/api.js');
const urlUtil = require('../../utils/url.js');

function loadGarments() {
  try {
    return require('../../assets/data/garments.js') || [];
  } catch (e) {
    return [];
  }
}

Page({
  data: {
    garments: [],
    garmentId: '',
    garment: null,
    // 剪辑蒙版：CSS mask 需要相对路径（webview 下 url() 根路径解析不稳定）
    maskSrc: '',
    // 该款服装印花推荐区中心（舞台百分比）：纹样默认落位，offsetX/Y 相对此点
    dcLeft: 50,
    dcTop: 40,
    // 纹样渲染值（JS层预计算，视图层不做算术——高频setData时降低diff压力，防渲染层崩溃）
    patLeft: 50,
    patTop: 40,
    patW: 40,
    patOp: 1,
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
    this.setData({ garments: garments });
    if (garments.length) this.applyGarment(garments[0]);
  },

  onReady() {
    this._ensureStageRect();
  },

  onUnload() {
    if (this._moveTimer) {
      clearTimeout(this._moveTimer);
      this._moveTimer = null;
    }
  },

  /** 应用选中服装：更新蒙版路径与默认印花中心，重置位置类调节参数 */
  applyGarment(garment) {
    if (!garment) return;
    const pa = garment.printArea || { top: 36, left: 30, width: 40, height: 28 };
    const rel = String(garment.image || '').replace(/^\//, '');
    this.setData({
      garmentId: garment.id,
      garment: garment,
      maskSrc: rel ? '../../' + rel : '',
      dcLeft: +(pa.left + pa.width / 2).toFixed(1),
      dcTop: +(pa.top + pa.height / 2).toFixed(1)
    });
    this.applyAdjust({ offsetX: 0, offsetY: 0, scalePct: 100, opacityPct: 100 });
  },

  /**
   * 统一调节入口：合并参数变更并预计算纹样渲染值（一次setData，视图层零算术）。
   * 高频调用（拖拽/滑杆bindchanging）由调用方节流；值无变化时自动跳过。
   */
  applyAdjust(patch) {
    const d = this.data;
    const next = {
      offsetX: patch.offsetX !== undefined ? patch.offsetX : d.offsetX,
      offsetY: patch.offsetY !== undefined ? patch.offsetY : d.offsetY,
      scalePct: patch.scalePct !== undefined ? patch.scalePct : d.scalePct,
      opacityPct: patch.opacityPct !== undefined ? patch.opacityPct : d.opacityPct
    };
    const render = {
      patLeft: +(d.dcLeft + next.offsetX).toFixed(1),
      patTop: +(d.dcTop + next.offsetY).toFixed(1),
      patW: +(40 * next.scalePct / 100).toFixed(1),
      patOp: +(next.opacityPct / 100).toFixed(2)
    };
    const noChange =
      render.patLeft === d.patLeft && render.patTop === d.patTop &&
      render.patW === d.patW && render.patOp === d.patOp &&
      next.offsetX === d.offsetX && next.offsetY === d.offsetY &&
      next.scalePct === d.scalePct && next.opacityPct === d.opacityPct;
    if (noChange) return;
    this.setData(Object.assign({}, next, render));
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
        opacityPct: 100,
        patLeft: this.data.dcLeft,
        patTop: this.data.dcTop,
        patW: 40,
        patOp: 1
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
    this.applyGarment(garment);
  },

  /* ---------- 纹样拖拽（与滑杆双向同步：拖动实时写回 offsetX/offsetY） ---------- */
  _ensureStageRect() {
    if (this._stageRect) return;
    wx.createSelectorQuery()
      .in(this)
      .select('.preview__stage')
      .boundingClientRect((r) => { if (r) this._stageRect = r; })
      .exec();
  },
  onStageTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    this._ensureStageRect();
    this._drag = { x0: t.clientX, y0: t.clientY, ox: this.data.offsetX, oy: this.data.offsetY };
  },
  onStageTouchMove(e) {
    if (!this._drag || !this._stageRect) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    // 屏幕像素位移 → 舞台百分比，clamp 到滑杆量程保持同步
    const dx = ((t.clientX - this._drag.x0) / this._stageRect.width) * 100;
    const dy = ((t.clientY - this._drag.y0) / this._stageRect.height) * 100;
    const clamp = function (v) { return Math.max(-50, Math.min(50, Math.round(v))); };
    this._lastMove = { offsetX: clamp(this._drag.ox + dx), offsetY: clamp(this._drag.oy + dy) };
    // 节流：≥32ms 才真正 setData（touchmove 每秒可达60+次，高频 setData 会打爆渲染层）
    const now = Date.now();
    if (now - (this._lastMoveApply || 0) >= 32) {
      this._lastMoveApply = now;
      this._flushMove();
    } else if (!this._moveTimer) {
      this._moveTimer = setTimeout(() => {
        this._moveTimer = null;
        this._flushMove();
      }, 32);
    }
  },
  _flushMove() {
    if (!this._lastMove) return;
    this._lastMoveApply = Date.now();
    this.applyAdjust(this._lastMove);
  },
  onStageTouchEnd() {
    if (this._moveTimer) {
      clearTimeout(this._moveTimer);
      this._moveTimer = null;
    }
    this._flushMove();
    this._drag = null;
    this._lastMove = null;
  },
  // bindchanging + bindchange 双绑：统一走 applyAdjust（预计算渲染值）
  onScaleChange(e) {
    this.applyAdjust({ scalePct: e.detail.value });
  },
  onOffsetXChange(e) {
    this.applyAdjust({ offsetX: e.detail.value });
  },
  onOffsetYChange(e) {
    this.applyAdjust({ offsetY: e.detail.value });
  },
  onOpacityChange(e) {
    this.applyAdjust({ opacityPct: e.detail.value });
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
