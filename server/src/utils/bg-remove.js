/**
 * 边缘泛洪抠底 v2.1：纯色背景的图案稿 → 透明 PNG
 *
 * 背景：文生图模型无法输出透明通道；Prompt 模板已强制纯白背景，
 * 此处在图片落盘前把连通到边缘的背景色区域抠成透明（泛洪填充），
 * 被主体包住的同色区域不会被误抠（泛洪只从边缘进入）。
 *
 * v2 增强：
 * - 自适应容差：按背景采样的离散度 σ 动态取 18~64（v1 固定 32）——
 *   均匀背景更收紧（保护白色主体不被误抠），噪点/轻微渐变背景更宽松
 * - Alpha 边缘羽化（只向内软化）：前景掩膜经两轮 3×3 盒滤波，
 *   边缘 1~2px 渐变透明，消除贴深色服装时硬边发白的问题
 * - 边缘颜色去污染：半透明像素按背景混合模型反解主体色 c'=(c-(1-α)bg)/α
 * - 质量统计：返回半透明像素占比 semiRatio 供日志与回归观测
 *
 * v2.1 增强：
 * - 水印碎片清理：上游返回图常带"AI生成"水印（灰色文字，紧贴边框），
 *   抠底后会变成漂浮的灰色碎片。对"不与中央区域相交 + 面积≤2% +
 *   低饱和(灰色)占比≥70%"的前景连通域判为水印残片并入背景——
 *   居中主体与彩色纹样（含四角装饰、贴边锯齿带）不受影响
 * - 新增 evaluateEdgeBackground()：边缘采样评估"白底/纯色均匀底"，
 *   供生成链路做质检门闩（风景/照片类偏离输出如实判失败）
 *
 * 安全策略：抠除面积比例 <2%（背景不纯）或 >85%（主体同色）时放弃，
 * 保留原图——宁可白底贴片，不可掏空主体。
 */
'use strict';

const sharp = require('sharp');

const MIN_RATIO = 0.02;
const MAX_RATIO = 0.85;
const BASE_TOL = 18; // 均匀背景下的基准容差（每通道）
const TOL_K = 2.5; // 采样离散度 → 容差 的放大系数
const MAX_TOL = 64;

/** 质检门闩阈值：边缘亮度中位 ≥205（白底）或 采样极差 ≤25（任意纯色均匀底） */
const GATE_MIN_LUM = 205;
const GATE_MAX_SPREAD = 25;

/** 边缘 8 采样点（四角+四边中点），bg-remove 与门闩共用同一采样口径 */
function edgeSamplePoints(width, height) {
  const mid = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  return [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [mid, 0], [mid, height - 1], [0, midY], [width - 1, midY],
  ];
}

/**
 * 质检门闩：边缘采样评估是否"白底或纯色均匀底"的图案稿。
 * 风景/照片类偏离输出（边缘明暗不均且偏暗）会判 false，调用方应如实置任务失败。
 * @returns {Promise<{patternLike:boolean, medianLum:number, spread:number}|null>} 解析失败返回 null（跳过门闩）
 */
async function evaluateEdgeBackground(input) {
  try {
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const lum = edgeSamplePoints(info.width, info.height).map(([x, y]) => {
      const i = (y * info.width + x) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    });
    lum.sort((a, b) => a - b);
    const medianLum = lum[Math.floor(lum.length / 2)];
    const spread = lum[lum.length - 1] - lum[0];
    return { patternLike: medianLum >= GATE_MIN_LUM || spread <= GATE_MAX_SPREAD, medianLum, spread };
  } catch (e) {
    return null;
  }
}

/**
 * 水印碎片清理（v2.1）：把"贴边框带 + 小面积 + 灰色为主"的前景连通域并入背景。
 * 判定条件（三者同时满足，保守起见）：
 *  - 连通域包围盒不与中央矩形（内缩 18%宽/12%高）相交 → 整体贴边
 *  - 面积 ≤ 全图 2%
 *  - 低饱和（max-min 通道差 <40）像素占比 ≥70% → 灰色文字特征，彩色纹样不受影响
 */
function removeBorderWatermarkArtifacts(bgMask, data, width, height) {
  const total = width * height;
  const cx0 = Math.round(width * 0.18);
  const cy0 = Math.round(height * 0.12);
  const cx1 = width - cx0;
  const cy1 = height - cy0;
  const maxArea = Math.floor(total * 0.02);
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  const members = new Int32Array(maxArea + 1); // 面积≤maxArea 才可能被清理，收集到此上限即可
  for (let start = 0; start < total; start++) {
    if (visited[start] || bgMask[start]) continue; // 只考察前景连通域
    let sp = 0;
    let count = 0;
    let gray = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    visited[start] = 1;
    stack[sp++] = start;
    while (sp > 0) {
      const idx = stack[--sp];
      if (count <= maxArea) members[count] = idx; // 超限后停止覆盖（该域不可能命中清理）
      count++;
      const x = idx % width;
      const y = (idx - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const p = idx * 4;
      const mx = Math.max(data[p], data[p + 1], data[p + 2]);
      const mn = Math.min(data[p], data[p + 1], data[p + 2]);
      if (mx - mn < 40) gray++;
      if (x > 0 && !visited[idx - 1] && !bgMask[idx - 1]) { visited[idx - 1] = 1; stack[sp++] = idx - 1; }
      if (x < width - 1 && !visited[idx + 1] && !bgMask[idx + 1]) { visited[idx + 1] = 1; stack[sp++] = idx + 1; }
      if (idx >= width && !visited[idx - width] && !bgMask[idx - width]) { visited[idx - width] = 1; stack[sp++] = idx - width; }
      if (idx < total - width && !visited[idx + width] && !bgMask[idx + width]) { visited[idx + width] = 1; stack[sp++] = idx + width; }
    }
    if (count > maxArea) continue; // 大面积连通域必是主体/纹样
    const intersectsCenter = maxX >= cx0 && minX <= cx1 && maxY >= cy0 && minY <= cy1;
    if (intersectsCenter || gray < count * 0.7) continue;
    for (let i = 0; i < count; i++) bgMask[members[i]] = 1; // 命中水印残片 → 并入背景
  }
}

/** 一维水平 3 抽头盒滤波（边界像素取自身，src/dst 等长） */
function boxBlurH(src, dst, width, height) {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const l = x > 0 ? src[i - 1] : src[i];
      const r = x < width - 1 ? src[i + 1] : src[i];
      dst[i] = (l + src[i] + r) / 3;
    }
  }
}

/** 一维垂直 3 抽头盒滤波（H+V 各一次等价 3×3 盒滤波） */
function boxBlurV(src, dst, width, height) {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const up = y > 0 ? row - width : row;
    const dn = y < height - 1 ? row + width : row;
    for (let x = 0; x < width; x++) {
      dst[row + x] = (src[up + x] + src[row + x] + src[dn + x]) / 3;
    }
  }
}

/**
 * @param {Buffer} input 任意 jpg/png/webp 图像
 * @returns {Promise<{buffer:Buffer, ratio:number, semiRatio:number}|null>}
 *   成功返回带渐变 Alpha 的透明 PNG；不适合抠底返回 null
 */
async function removeSolidBackground(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const total = width * height;

  // 1) 背景色 = 四角+四边中点共8个采样点的逐通道中位数（抗局部杂物）；
  //    同时按采样离散度 σ 自适应容差：tol = clamp(18 + 2.5σ, 18, 64)
  const mid = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const samplePts = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [mid, 0], [mid, height - 1], [0, midY], [width - 1, midY],
  ];
  const samples = samplePts.map(([x, y]) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  });
  const bg = [0, 1, 2].map((c) => {
    const arr = samples.map((s) => s[c]).sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)];
  });
  let maxSigma = 0;
  for (let c = 0; c < 3; c++) {
    const mean = samples.reduce((s, v) => s + v[c], 0) / samples.length;
    const variance = samples.reduce((s, v) => s + (v[c] - mean) * (v[c] - mean), 0) / samples.length;
    const sigma = Math.sqrt(variance);
    if (sigma > maxSigma) maxSigma = sigma;
  }
  const tol = Math.min(MAX_TOL, BASE_TOL + TOL_K * maxSigma);

  const isBg = (i) =>
    Math.abs(data[i] - bg[0]) <= tol &&
    Math.abs(data[i + 1] - bg[1]) <= tol &&
    Math.abs(data[i + 2] - bg[2]) <= tol;

  // 2) 从边缘所有背景色像素开始 BFS 泛洪（显式栈防爆递归），
  //    bgMask[idx]=1 表示"连通到边缘的背景"（主体内部同色不标记）
  const bgMask = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;
  let count = 0;
  const seed = (idx) => {
    if (!visited[idx] && isBg(idx * 4)) {
      visited[idx] = 1;
      bgMask[idx] = 1;
      stack[sp++] = idx;
      count++;
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % width;
    if (x > 0) seed(idx - 1);
    if (x < width - 1) seed(idx + 1);
    if (idx >= width) seed(idx - width);
    if (idx < total - width) seed(idx + width);
  }

  // 3) 安全阈值：抠除太少=背景不纯；太多=主体同色风险 → 放弃保原图
  const ratio = count / total;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) return null;

  // 3.5) 水印碎片清理：贴边小面积灰色连通域（"AI生成"水印残片）并入背景
  removeBorderWatermarkArtifacts(bgMask, data, width, height);

  // 4) 前景 Alpha 羽化（只向内软化）：fg 掩膜（=1-bgMask）经两轮 3×3 盒滤波
  //    得到软过渡后，再与原掩膜取 min——背景侧像素 Alpha 恒为 0，
  //    避免"半透明白色像素"外扩成白霜；主体边界向内 1~2px 渐变（H+V 分离实现）
  const alpha = new Float32Array(total);
  const tmp = new Float32Array(total);
  for (let i = 0; i < total; i++) alpha[i] = bgMask[i] ? 0 : 1;
  boxBlurH(alpha, tmp, width, height);
  boxBlurV(tmp, alpha, width, height);
  boxBlurH(alpha, tmp, width, height);
  boxBlurV(tmp, alpha, width, height);
  for (let i = 0; i < total; i++) {
    if (bgMask[i]) alpha[i] = 0; // 背景像素不因模糊获得 Alpha（防白霜外扩）
  }

  // 5) 写回像素：Alpha + 半透明像素去污染（按 bg 混合模型反解主体色）
  let semi = 0;
  for (let i = 0; i < total; i++) {
    const a = Math.min(1, Math.max(0, alpha[i]));
    const ai = Math.round(a * 255);
    const p = i * 4;
    data[p + 3] = ai;
    if (ai === 0 || ai === 255) continue;
    semi++;
    for (let c = 0; c < 3; c++) {
      const v = (data[p + c] - (1 - a) * bg[c]) / a;
      data[p + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }
  }

  // 6) 重编码透明 PNG
  const buffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { buffer, ratio, semiRatio: semi / total };
}

module.exports = { removeSolidBackground, evaluateEdgeBackground };
