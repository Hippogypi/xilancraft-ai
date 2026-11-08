/**
 * 纹样图生图底图制备（幂等，可重复运行）
 *
 * 读取小程序纹样素材（miniprogram/assets/motifs/ + assets/data/motifs.js 元数据），
 * 为每条"有图"纹样生成规范化图生图底图：
 *   1) flatten 到白底（去源图可能的 Alpha）
 *   2) 3×3 中值滤波（抑制织物照片的经纬噪点，让图生图更关注结构而非纹理）
 *   3) contain 缩放到 1024×1024 白底 letterbox（对齐生图模型输入尺寸）
 * 产物：server/public/assets/motif-bases/<motifId>.png + manifest.json
 *   manifest 供服务端 generation.js 查询 motifId → 底图文件（无图纹样不进清单 → 自动文生图）
 *
 * 用法：tools/node/node.exe scripts/prepare-motif-bases.js （纯本地计算，0 次 API 调用）
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

const REPO_ROOT = path.resolve(__dirname, '..');
const MOTIFS_DATA = path.join(REPO_ROOT, 'miniprogram/assets/data/motifs.js');
const MOTIFS_IMG_DIR = path.join(REPO_ROOT, 'miniprogram/assets/motifs');
const OUT_DIR = path.join(REPO_ROOT, 'server/public/assets/motif-bases');

async function main() {
  const motifs = require(MOTIFS_DATA);
  if (!Array.isArray(motifs) || !motifs.length) throw new Error('纹样数据为空：' + MOTIFS_DATA);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = { generatedAt: new Date().toISOString(), motifs: {} };
  const skipped = [];

  for (const m of motifs) {
    const imgRel = (m.image || '').trim();
    if (!imgRel) {
      skipped.push(`${m.id}（无素材图，现代转译类）`);
      continue;
    }
    const src = path.join(REPO_ROOT, 'miniprogram', imgRel.replace(/^\//, ''));
    if (!fs.existsSync(src)) {
      skipped.push(`${m.id}（素材图缺失：${imgRel}）`);
      continue;
    }
    const outFile = `${m.id}.png`;
    await sharp(src)
      .flatten({ background: '#ffffff' })
      .median(3)
      .resize(1024, 1024, { fit: 'contain', background: '#ffffff' })
      .png()
      .toFile(path.join(OUT_DIR, outFile));
    manifest.motifs[m.id] = { file: outFile, name: m.name || m.id };
    console.log(`✓ ${m.id} ${m.name} ← ${path.basename(src)}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('---');
  console.log(`底图 ${Object.keys(manifest.motifs).length} 张 → ${OUT_DIR}`);
  if (skipped.length) console.log(`跳过 ${skipped.length} 条（将走纯文生图）：\n  ${skipped.join('\n  ')}`);
}

main().catch((e) => {
  console.error('底图制备失败：', e && e.message);
  process.exit(1);
});
