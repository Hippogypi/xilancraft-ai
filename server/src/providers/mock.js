/**
 * mock 适配器（契约§6）：程序化生成"西兰卡普风格"几何图案PNG
 * - 纯 node:zlib 手写PNG编码，无外部依赖；按 prompt 哈希选择配色，立即完成
 * - 供开发联调与E2E测试，不发起任何网络请求
 */
'use strict';

const { encodePng } = require('../utils/png');
const { sha256Hex } = require('../utils/crypto');
const { validateSettingsShape } = require('./settings');

// 西兰卡普织锦典型配色（黑底高饱和对比是传统特征）
const PALETTES = [
  { name: '黑底红黄', bg: '#1b1310', main: '#c8341f', accent: '#e8b73a', light: '#f3e9d2', alt: '#2f5d3a' },
  { name: '靛蓝月白', bg: '#101c2e', main: '#2f6fb0', accent: '#e8b73a', light: '#eef2f7', alt: '#c8341f' },
  { name: '酱紫翠绿', bg: '#231019', main: '#b4264e', accent: '#f0d890', light: '#f7ead9', alt: '#3f7d5a' },
  { name: '玄黑橙金', bg: '#141414', main: '#d97b1f', accent: '#f2e3b6', light: '#ffffff', alt: '#5a3a86' },
  { name: '墨绿赭石', bg: '#12211a', main: '#3f7d5a', accent: '#d9862f', light: '#efe9d8', alt: '#b4264e' },
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

/** 极简像素画布（RGB） */
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  fill(c) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c);
  }
  hline(y, x0, x1, c) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    for (let x = Math.round(x0); x <= Math.round(x1); x++) this.set(x, y, c);
  }
  rect(x0, y0, x1, y1, c, t = 1) {
    for (let i = 0; i < t; i++) {
      this.hline(y0 + i, x0, x1, c);
      this.hline(y1 - i, x0, x1, c);
      for (let y = y0; y <= y1; y++) {
        this.set(x0 + i, y, c);
        this.set(x1 - i, y, c);
      }
    }
  }
  /** 实心菱形（|dx|+|dy|<=r） */
  fillDiamond(cx, cy, r, c) {
    for (let dy = -r; dy <= r; dy++) {
      const s = r - Math.abs(dy);
      this.hline(cy + dy, cx - s, cx + s, c);
    }
  }
  /** 空心菱形环带（厚度t） */
  ringDiamond(cx, cy, r, t, c) {
    for (let dy = -r; dy <= r; dy++) {
      const ay = Math.abs(dy);
      const s = r - ay;
      const si = Math.max(0, r - t - ay);
      this.hline(cy + dy, cx - s, cx - si, c);
      this.hline(cy + dy, cx + si, cx + s, c);
    }
  }
  /** 锯齿（三角波）横带：西兰卡普典型"狗牙齿"骨架 */
  zigzag(yBase, x0, x1, period, amp, c, t = 2) {
    for (let x = x0; x <= x1; x++) {
      const phase = ((x - x0) / period) % 2;
      const tri = Math.abs(phase - 1); // 1→0→1 三角波
      const y = yBase + Math.round(amp * (1 - tri)) - amp;
      for (let i = 0; i < t; i++) this.set(x, y + i, c);
    }
  }
}

/** 解析 "1024x1024" 尺寸并收敛到合理范围 */
function parseSize(sizeStr) {
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(String(sizeStr || ''));
  let w = m ? Number(m[1]) : 1024;
  let h = m ? Number(m[2]) : 1024;
  const clamp = (v) => Math.max(256, Math.min(1024, Math.round(v / 2) * 2));
  return { w: clamp(w), h: clamp(h) };
}

/**
 * 生成西兰卡普风格几何图案PNG：菱形骨架+锯齿带+四角"勾"纹+暗纹网格。
 * @returns {Buffer} PNG字节
 */
function generateMockPng(prompt, sizeStr) {
  const seedHex = sha256Hex(String(prompt || ''));
  let palette = PALETTES[parseInt(seedHex.slice(0, 2), 16) % PALETTES.length];
  const variant = parseInt(seedHex.slice(2, 4), 16) % 2 === 1;
  if (variant) palette = { ...palette, main: palette.alt, alt: palette.main }; // 哈希变体：主辅色互换

  const { w, h } = parseSize(sizeStr);
  const S = Math.min(w, h);
  const cv = new Canvas(w, h);
  const bg = hexToRgb(palette.bg);
  const main = hexToRgb(palette.main);
  const accent = hexToRgb(palette.accent);
  const light = hexToRgb(palette.light);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // 1) 底色 + 暗纹菱形网格（低对比，模拟织锦经纬底纹）
  cv.fill(bg);
  const lattice = mix(bg, light, 0.14);
  const step = Math.max(24, Math.round(S / 9));
  for (let gy = step; gy < h; gy += step) {
    for (let gx = step; gx < w; gx += step) {
      cv.ringDiamond(gx, gy, Math.round(step * 0.3), 1, lattice);
    }
  }

  // 2) 双层边框
  const m1 = Math.round(S * 0.05);
  const t1 = Math.max(2, Math.round(S * 0.008));
  cv.rect(m1, m1, w - 1 - m1, h - 1 - m1, main, t1);
  const m2 = m1 + Math.max(6, Math.round(S * 0.022));
  cv.rect(m2, m2, w - 1 - m2, h - 1 - m2, accent, Math.max(1, Math.round(t1 / 2)));

  // 3) 上下锯齿带（狗牙齿纹）
  const zzAmp = Math.max(6, Math.round(S * 0.028));
  const zzPeriod = Math.max(16, Math.round(S * 0.06));
  const zzT = Math.max(2, Math.round(S * 0.006));
  const bandY = m2 + Math.max(10, Math.round(S * 0.05));
  cv.zigzag(bandY, m2 + 4, w - m2 - 5, zzPeriod, zzAmp, accent, zzT);
  cv.zigzag(h - 1 - bandY, m2 + 4, w - m2 - 5, zzPeriod, zzAmp, accent, zzT);

  // 4) 中央嵌套菱形（阳雀花式主纹）
  const ringT = Math.max(2, Math.round(S * 0.012));
  const radii = [0.34, 0.285, 0.23, 0.175, 0.12];
  const ringColors = [main, light, accent, main, light];
  radii.forEach((r, i) => {
    cv.ringDiamond(cx, cy, Math.round(S * r), ringT, ringColors[i]);
  });

  // 5) 中心实心菱形 + 光点
  cv.fillDiamond(cx, cy, Math.round(S * 0.055), accent);
  cv.fillDiamond(cx, cy, Math.round(S * 0.022), light);

  // 6) 四角"勾"纹簇（四十八勾简化）与四边中点小菱形
  const cornerOff = m2 + Math.max(14, Math.round(S * 0.1));
  const corners = [
    [cornerOff, cornerOff],
    [w - 1 - cornerOff, cornerOff],
    [cornerOff, h - 1 - cornerOff],
    [w - 1 - cornerOff, h - 1 - cornerOff],
  ];
  for (const [x, y] of corners) {
    cv.ringDiamond(x, y, Math.round(S * 0.085), ringT, accent);
    cv.ringDiamond(x, y, Math.round(S * 0.055), ringT, main);
    cv.fillDiamond(x, y, Math.round(S * 0.024), light);
  }
  const midOff = m2 + Math.max(8, Math.round(S * 0.035));
  const edges = [
    [cx, midOff],
    [cx, h - 1 - midOff],
    [midOff, cy],
    [w - 1 - midOff, cy],
  ];
  for (const [x, y] of edges) cv.fillDiamond(x, y, Math.round(S * 0.032), main);

  return encodePng(w, h, cv.px);
}

/** 适配器对象（契约§6接口） */
const mockAdapter = {
  label: '本机Mock（开发联调）',
  async validateConfig(cfg) {
    validateSettingsShape(cfg.settings); // mock 无需 base_url/model/key，仅校验settings形状
  },
  async generate(input) {
    const imageBytes = generateMockPng(input.prompt, input.size);
    return { kind: 'completed', imageBytes, mimeType: 'image/png' };
  },
};

module.exports = { mockAdapter, generateMockPng, PALETTES };
