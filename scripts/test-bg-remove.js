/**
 * 抠底算法离线回归：v1 基线（固定容差+硬Alpha） vs v2（自适应容差+羽化+去污染）
 *
 * 遍历 server/data/generated/*.src.* 历史原图，对每张同时跑两版算法：
 * - 输出对照表（抠除比例 / 是否触发放弃护栏 / 半透明像素占比）
 * - 产物写入 server/.test-tmp/bg-regression/：
 *     <name>.v1.png      v1 结果（硬边）
 *     <name>.v2.png      v2 结果（羽化边）
 *     <name>.v2.dark.png v2 结果 flatten 到深灰底——白边/白霜会直接显形，肉眼验收用
 *
 * 用法：node scripts/test-bg-remove.js （纯本地计算，0 次 API 调用）
 */
'use strict';

const path = require('node:path');
const fs = require('node:fs');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  sharp = require(path.join(__dirname, '../server/node_modules/sharp'));
}
const { removeSolidBackground } = require(path.join(__dirname, '../server/src/utils/bg-remove.js'));

const SRC_DIR = path.join(__dirname, '../server/data/generated');
const OUT_DIR = path.join(__dirname, '../server/.test-tmp/bg-regression');

/**
 * v1 基线复刻（仅供对照，勿在业务代码中引用）：
 * 固定容差 32、泛洪直接写 alpha=0（硬二值）、同款 2%~85% 安全线
 */
async function v1Remove(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const total = width * height;
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
  const TOLERANCE = 32;
  const isBg = (i) =>
    Math.abs(data[i] - bg[0]) <= TOLERANCE &&
    Math.abs(data[i + 1] - bg[1]) <= TOLERANCE &&
    Math.abs(data[i + 2] - bg[2]) <= TOLERANCE;
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
  const ratio = count / total;
  if (ratio < 0.02 || ratio > 0.85) return null;
  const buffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { buffer, ratio };
}

function fmtRatio(r) {
  return r === null ? '放弃' : (r * 100).toFixed(1) + '%';
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('未找到目录：' + SRC_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.includes('.src.')).sort();
  if (!files.length) {
    console.log('server/data/generated 下没有 .src 历史图，无回归对象');
    return;
  }
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let v1Win = 0; // v2 成功且 v1 放弃
  let v2Lose = 0; // v1 成功但 v2 放弃（回归，需人工检查）
  let both = 0;
  let neither = 0;

  console.log('文件 | v1抠除 | v2抠除 | v2羽化带 | 判定');
  console.log('--- | --- | --- | --- | ---');
  for (const f of files) {
    const buf = fs.readFileSync(path.join(SRC_DIR, f));
    const base = f.replace(/\.[^.]+$/, '');
    const r1 = await v1Remove(buf).catch(() => null);
    const r2 = await removeSolidBackground(buf).catch(() => null);
    if (r1) fs.writeFileSync(path.join(OUT_DIR, base + '.v1.png'), r1.buffer);
    if (r2) {
      fs.writeFileSync(path.join(OUT_DIR, base + '.v2.png'), r2.buffer);
      // 深灰底 flatten 预览：透明区变深灰，白边/白霜立即显形
      const dark = await sharp(r2.buffer).flatten({ background: '#333333' }).png().toBuffer();
      fs.writeFileSync(path.join(OUT_DIR, base + '.v2.dark.png'), dark);
    }

    let verdict;
    if (r2 && !r1) {
      verdict = '↑ v2 修复了 v1 的放弃案例';
      v1Win++;
    } else if (!r2 && r1) {
      verdict = '⚠ 回归：v1 成功但 v2 放弃（需人工检查）';
      v2Lose++;
    } else if (r2 && r1) {
      verdict = '· 两版均可抠' + (r2.semiRatio > 0 ? '（v2 含羽化边）' : '');
      both++;
    } else {
      verdict = '· 两版均放弃（背景不纯/主体同色，保原图）';
      neither++;
    }
    const semi = r2 ? (r2.semiRatio * 100).toFixed(2) + '%' : '-';
    console.log(`${f} | ${fmtRatio(r1 && r1.ratio)} | ${fmtRatio(r2 && r2.ratio)} | ${semi} | ${verdict}`);
  }

  console.log('---');
  console.log(`合计 ${files.length} 张：两版均可 ${both}，v2 修复 ${v1Win}，v2 回归 ${v2Lose}，两版均放弃 ${neither}`);
  console.log('产物目录：' + OUT_DIR + '（.v2.dark.png 用于肉眼检查白边）');
  if (v2Lose > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error('回归脚本异常：', e && e.message);
  process.exit(1);
});
