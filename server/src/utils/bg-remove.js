/**
 * 边缘泛洪抠底：纯色背景的图案稿 → 透明 PNG
 *
 * 背景：文生图模型无法输出透明通道；Prompt 模板已强制纯白背景，
 * 此处在图片落盘前把连通到边缘的背景色区域抠成透明（泛洪填充），
 * 被主体包住的同色区域不会被误抠（泛洪只从边缘进入）。
 *
 * 安全策略：抠除面积比例 <2%（背景不纯）或 >85%（主体同色）时放弃，
 * 保留原图——宁可白底贴片，不可掏空主体。
 */
'use strict';

const sharp = require('sharp');

const TOLERANCE = 32; // 每通道容差（吸收 JPEG 压缩噪点）
const MIN_RATIO = 0.02;
const MAX_RATIO = 0.85;

/**
 * @param {Buffer} input 任意 jpg/png/webp 图像
 * @returns {Promise<{buffer:Buffer, ratio:number}|null>} 成功返回透明PNG；不适合抠底返回 null
 */
async function removeSolidBackground(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;

  // 1) 背景色 = 四角+四边中点共8个采样点的逐通道中位数（抗局部杂物）
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

  const isBg = (i) =>
    Math.abs(data[i] - bg[0]) <= TOLERANCE &&
    Math.abs(data[i + 1] - bg[1]) <= TOLERANCE &&
    Math.abs(data[i + 2] - bg[2]) <= TOLERANCE;

  // 2) 从边缘所有背景色像素开始 BFS 泛洪（显式栈防爆递归）；
  //    入栈即置透明并用 count 计数（栈弹出后 sp 归零，不能再用 sp 统计）
  const total = width * height;
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;
  let count = 0;
  const seed = (idx) => {
    if (!visited[idx] && isBg(idx * 4)) {
      visited[idx] = 1;
      stack[sp++] = idx;
      count++;
      data[idx * 4 + 3] = 0;
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

  // 4) 重编码透明 PNG
  const buffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { buffer, ratio };
}

module.exports = { removeSolidBackground };
