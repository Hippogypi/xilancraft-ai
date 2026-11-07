/**
 * pages/workshop —— AI 定制工坊（WBS 04 P0）
 * 表单：提示词 / 风格 / 配色（含自定义）/ 应用部位 / 参考纹样（素材库带入可移除）
 * 生成链路：utils/prompt-builder.js 按冻结模板组装完整提示词
 *   → POST /api/generations { mode:'text_to_image', prompt, style, size:'1024x1024', referenceMotifId? }
 *   → setTimeout 链轮询 GET /api/generations/:id（间隔 2s、最长 150s）
 * 状态：idle / running / succeeded / failed（前端超时、额度不足等与失败同态，
 *   文案直接用 services/api.js 的契约错误码中文映射 friendlyMessage）
 */
const api = require('../../services/api.js');
const promptBuilder = require('../../utils/prompt-builder.js');
const urlUtil = require('../../utils/url.js');

const POLL_INTERVAL_MS = 2000;   // 契约：轮询间隔 2s
const POLL_MAX_MS = 150000;      // 契约：前端轮询最长 150s（后端默认 120s 超时）
const POLL_MAX_CONSECUTIVE_ERRORS = 2; // 轮询网络抖动容忍（超过按失败处理）

function loadMotifs() {
  try {
    return require('../../assets/data/motifs.json') || [];
  } catch (e) {
    return [];
  }
}

/** 解析素材库跳转 query 中的 keywords（兼容逗号/顿号/空格分隔，需 decodeURIComponent） */
function parseKeywords(raw) {
  if (!raw) return [];
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch (e) {
    // 已是明文，直接使用
  }
  return text.split(/[,，、\s]+/).filter(function (k) { return k; });
}

Page({
  data: {
    prompt: '',
    styles: [
      { label: '街头潮流', value: 'streetwear' },
      { label: '新中式', value: 'new_chinese' },
      { label: '极简', value: 'minimal' },
      { label: '科技感', value: 'tech' }
    ],
    styleValue: 'streetwear',
    palettes: [
      { label: '织锦五彩', value: 'brocade_five' },
      { label: '黑金', value: 'black_gold' },
      { label: '青蓝', value: 'indigo_blue' },
      { label: '自定义', value: 'custom' }
    ],
    paletteValue: 'brocade_five',
    customPalette: '',
    placements: [
      { label: '胸前印花', value: 'chest' },
      { label: '背部大图', value: 'back' },
      { label: '局部装饰', value: 'partial' }
    ],
    placementValue: 'chest',
    // 参考纹样（素材库「以此为灵感」带入或本页选择，可移除）
    referenceMotifs: [],
    referenceMotifId: '',
    referenceMotifName: '',
    referenceKeywords: [],
    // idle | running | succeeded | failed
    genStatus: 'idle',
    genResult: { jobId: '', imageUrl: '' },
    lastPrompt: '',
    errorMsg: ''
  },

  onLoad(options) {
    options = options || {};
    this.setData({ referenceMotifs: loadMotifs() });
    // 素材库「以此为灵感」以页面参数带入（编译模式/直达链接场景）
    if (options.motifId) {
      const motif = this.data.referenceMotifs.find(function (m) {
        return m.id === options.motifId;
      });
      if (motif) {
        const keywords = parseKeywords(options.keywords);
        this.setData({
          referenceMotifId: motif.id,
          referenceMotifName: motif.name,
          referenceKeywords: keywords.length ? keywords : (motif.keywords || [])
        });
        wx.showToast({ title: '已带入参考：' + motif.name, icon: 'none' });
      }
    }
  },

  onShow() {
    // 消费素材库「以此为灵感」经 globalData 带入的纹样（switchTab 无法带 URL 参数）
    const g = getApp();
    const pending = g.globalData.pendingMotif;
    if (pending && pending.id) {
      g.globalData.pendingMotif = null;
      this.setData({
        referenceMotifId: pending.id,
        referenceMotifName: pending.name || '',
        referenceKeywords: pending.keywords || []
      });
      wx.showToast({ title: '已带入参考：' + (pending.name || '纹样'), icon: 'none' });
    }
  },

  onUnload() {
    // 轮询代际 +1 使在途回调全部失效，并清理定时器
    this._genSeq = (this._genSeq || 0) + 1;
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
  },

  /* ---------- 表单 ---------- */
  onPromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },
  onStyleChange(e) {
    this.setData({ styleValue: e.detail.value });
  },
  onPaletteChange(e) {
    this.setData({ paletteValue: e.detail.value });
  },
  onCustomPaletteInput(e) {
    this.setData({ customPalette: e.detail.value });
  },
  onPlacementChange(e) {
    this.setData({ placementValue: e.detail.value });
  },

  /* ---------- 参考纹样 ---------- */
  onRefTap(e) {
    const id = e.currentTarget.dataset.id || '';
    if (!id) {
      this.onRemoveReference();
      return;
    }
    const motif = this.data.referenceMotifs.find(function (m) { return m.id === id; });
    if (!motif) return;
    this.setData({
      referenceMotifId: motif.id,
      referenceMotifName: motif.name,
      referenceKeywords: motif.keywords || []
    });
  },

  /** 移除「参考纹样：xxx」标签 */
  onRemoveReference() {
    this.setData({
      referenceMotifId: '',
      referenceMotifName: '',
      referenceKeywords: []
    });
  },

  /** 查看本轮提交的完整提示词（验收 04.02 用） */
  onViewPrompt() {
    if (!this.data.lastPrompt) return;
    wx.showModal({
      title: '提交的完整提示词',
      content: this.data.lastPrompt,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /* ---------- 生成 ---------- */
  onGenerate() {
    if (this.data.genStatus === 'running') return; // 防重复提交
    const userPrompt = (this.data.prompt || '').trim();
    if (!userPrompt) {
      wx.showToast({ title: '请先输入创意提示词', icon: 'none' });
      return;
    }

    const fullPrompt = promptBuilder.buildPrompt({
      motifName: this.data.referenceMotifName,
      motifKeywords: this.data.referenceKeywords,
      style: this.data.styleValue,
      palette: this.data.paletteValue,
      customPalette: this.data.customPalette,
      placement: this.data.placementValue,
      userPrompt: userPrompt
    });

    // 作废上一轮轮询，开启新代际
    this._genSeq = (this._genSeq || 0) + 1;
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }

    this.setData({
      genStatus: 'running',
      errorMsg: '',
      lastPrompt: fullPrompt,
      genResult: { jobId: '', imageUrl: '' }
    });

    const body = {
      mode: 'text_to_image',
      prompt: fullPrompt,
      style: this.data.styleValue,
      size: '1024x1024'
    };
    // 近似图生图（P1）：带参考纹样 ID，后端把该纹样关键词注入提示词
    if (this.data.referenceMotifId) {
      body.referenceMotifId = this.data.referenceMotifId;
    }

    const seq = this._genSeq;
    const that = this;
    api.post('/api/generations', body)
      .then(function (res) {
        if (seq !== that._genSeq) return;
        that._startPolling(res.jobId, seq);
      })
      .catch(function (err) {
        if (seq !== that._genSeq) return;
        that._fail(err && (err.friendlyMessage || err.message));
      });
  },

  /** setTimeout 链轮询：queued/running 继续，succeeded/failed/超时 终结 */
  _startPolling(jobId, seq) {
    const that = this;
    this._pollStartAt = Date.now();
    this._pollErrorCount = 0;

    const tick = function () {
      if (seq !== that._genSeq) return;
      if (Date.now() - that._pollStartAt >= POLL_MAX_MS) {
        // 前端轮询超时：与失败同态，文案用 GENERATION_TIMEOUT 错误码映射
        that._fail(api.ERROR_MESSAGES.GENERATION_TIMEOUT);
        return;
      }
      api.get('/api/generations/' + jobId)
        .then(function (job) {
          if (seq !== that._genSeq) return;
          that._pollErrorCount = 0;
          const status = job && job.status;
          if (status === 'succeeded') {
            if (!job.imageUrl) {
              that._fail(api.ERROR_MESSAGES.GENERATION_FAILED);
              return;
            }
            that.setData({
              genStatus: 'succeeded',
              genResult: {
                jobId: job.jobId || jobId,
                imageUrl: urlUtil.absoluteUrl(job.imageUrl) // 相对路径拼 BASE_URL
              }
            });
            return;
          }
          if (status === 'failed') {
            that._fail(api.friendly(job && job.error));
            return;
          }
          // queued / running → 2s 后继续
          that._pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
        })
        .catch(function (err) {
          if (seq !== that._genSeq) return;
          that._pollErrorCount += 1;
          if (that._pollErrorCount > POLL_MAX_CONSECUTIVE_ERRORS) {
            that._fail(err && err.friendlyMessage);
            return;
          }
          // 网络抖动容忍：跳过本次，2s 后重试
          that._pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
        });
    };

    this._pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
  },

  _fail(msg) {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    this.setData({
      genStatus: 'failed',
      errorMsg: msg || api.ERROR_MESSAGES.INTERNAL_ERROR
    });
  },

  /** 用此纹样 → 定制页（tab 页不能带参，经 globalData 传递） */
  onUsePattern() {
    if (!this.data.genResult.jobId) return;
    getApp().globalData.pendingPattern = {
      jobId: this.data.genResult.jobId,
      imageUrl: this.data.genResult.imageUrl
    };
    wx.switchTab({ url: '/pages/customization/index' });
  }
});
