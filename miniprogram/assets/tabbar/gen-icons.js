/**
 * TabBar 图标生成器（81×81 PNG × 8）
 * 纯 Node（node:zlib）实现 PNG 编码，无外部依赖；不改动 server/ 代码。
 * 造型：西兰卡普菱形意象 —— 导览=实心菱形+横线 / 素材=四宫格菱形 /
 *       工坊=菱形环+中心点 / 定制=菱形+下摆三角
 * 配色：normal rgba(185,172,151,0.65)；active #C9A063；透明背景。
 * 运行：node gen-icons.js（在本目录下生成 8 个 PNG）
 */
'use strict';

const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

// ---------- 极简 PNG 编码器（color type 6 / RGBA / 8bit / 非隔行） ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rs = y * (1 + width * 4);
    raw[rs] = 0; // filter none
    rgba.subarray(y * width * 4, (y + 1) * width * 4).forEach((v, i) => {
      raw[rs + 1 + i] = v;
    });
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 图形定义（coverage: 0~1 覆盖率，用于抗锯齿） ----------
const S = 81;
const C = (S - 1) / 2; // 40

// 菱形：|(x-cx)/rx + |y-cy|/ry <= 1
function diamond(x, y, cx, cy, rx, ry) {
  return Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
}
// 实心度（用于抗锯齿的软边：菱形内部为 1，边缘渐变）
function diamondCov(x, y, cx, cy, rx, ry) {
  const d = Math.abs(x - cx) / rx + Math.abs(y - cy) / ry;
  return d <= 1 ? 1 : 0;
}
// 矩形
function rect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}
// 下指三角形（顶点在下方 apexY，底边在上方 baseY，apexY > baseY）
function triDown(x, y, apexX, apexY, baseY, halfBase) {
  if (y < baseY || y > apexY) return false;
  const t = (apexY - y) / (apexY - baseY); // 0 at apex, 1 at base
  return Math.abs(x - apexX) <= halfBase * t;
}

/**
 * 每个图标的形状函数：返回该点覆盖率（0~1）。
 * 坐标基于 81×81，中心 C=40。
 */
const SHAPES = {
  // 导览：实心大菱形 + 底部横线（织锦纬线意象）
  heritage(x, y) {
    if (diamondCov(x, y, C, 32, 24, 24)) return 1;
    if (rect(x, y, C - 15, 64, C + 15, 68)) return 1;
    return 0;
  },
  // 素材：四宫格菱形（纹样矩阵）
  inspiration(x, y) {
    const off = 14;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (diamondCov(x, y, C + sx * off, C + sy * off, 10.5, 10.5)) return 1;
    }
    return 0;
  },
  // 工坊：菱形描边环 + 中心实心点（织机挑花意象）
  workshop(x, y) {
    const d = Math.abs(x - C) / 26 + Math.abs(y - C) / 26;
    if (d <= 1 && d >= 0.74) return 1; // 菱形环（厚度约 6.8px）
    if (diamondCov(x, y, C, C, 6.5, 6.5)) return 1; // 中心点
    return 0;
  },
  // 定制：上方菱形（领口）+ 下方下摆三角（裙摆）—— 服装意象
  customization(x, y) {
    if (diamondCov(x, y, C, 27, 15, 15)) return 1;
    if (triDown(x, y, C, 64, 45, 14)) return 1;
    return 0;
  },
};

// ---------- 渲染（2×2 超采样抗锯齿） ----------
const COLORS = {
  normal: { r: 185, g: 172, b: 151, a: Math.round(0.65 * 255) }, // rgba(185,172,151,0.65)
  active: { r: 201, g: 160, b: 99, a: 255 }, // #C9A063
};

function render(shapeFn, color) {
  const rgba = Buffer.alloc(S * S * 4);
  const SUB = 2; // 每像素 2×2 子采样
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let cov = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          cov += shapeFn(px + (sx + 0.5) / SUB, py + (sy + 0.5) / SUB);
        }
      }
      cov /= SUB * SUB;
      const i = (py * S + px) * 4;
      rgba[i] = color.r;
      rgba[i + 1] = color.g;
      rgba[i + 2] = color.b;
      rgba[i + 3] = Math.round(cov * color.a);
    }
  }
  return rgba;
}

// ---------- 主流程 ----------
const OUT_DIR = __dirname;
const files = [];
for (const [name, shapeFn] of Object.entries(SHAPES)) {
  for (const [state, color] of Object.entries(COLORS)) {
    const file = state === 'normal' ? `${name}.png` : `${name}-active.png`;
    const png = encodePng(S, S, render(shapeFn, color));
    fs.writeFileSync(path.join(OUT_DIR, file), png);
    files.push({ file, bytes: png.length });
  }
}
console.log('generated', files.length, 'icons in', OUT_DIR);
for (const f of files) console.log(' -', f.file, f.bytes, 'bytes');
