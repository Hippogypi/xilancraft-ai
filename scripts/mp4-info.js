#!/usr/bin/env node
/**
 * 读取 MP4 关键元信息（无需 ffmpeg）：时长/分辨率/编码/帧率
 * 用法：node scripts/mp4-info.js <file.mp4>
 * 实现：遍历顶层 atom 找 moov → 解析 mvhd(时长) / trak→tkhd(宽高) / stsd(编码)
 */
'use strict';

const fs = require('node:fs');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('用法: node scripts/mp4-info.js <file.mp4>');
  process.exit(1);
}

const fd = fs.openSync(file, 'r');
const size = fs.fstatSync(fd).size;

function readAtoms(start, end, depth, out) {
  const buf = Buffer.alloc(16);
  let pos = start;
  while (pos + 8 <= end) {
    fs.readSync(fd, buf, 0, 16, pos);
    let atomSize = buf.readUInt32BE(0);
    const type = buf.toString('latin1', 4, 8);
    let headerLen = 8;
    if (atomSize === 1) {
      atomSize = Number(buf.readBigUInt64BE(8));
      headerLen = 16;
    } else if (atomSize === 0) {
      atomSize = end - pos;
    }
    if (atomSize < headerLen || pos + atomSize > end) break;

    if (type === 'mvhd') {
      const b = Buffer.alloc(atomSize);
      fs.readSync(fd, b, 0, atomSize, pos);
      const version = b[headerLen];
      let timescale, duration;
      if (version === 1) {
        timescale = b.readUInt32BE(headerLen + 20);
        duration = Number(b.readBigUInt64BE(headerLen + 24));
      } else {
        timescale = b.readUInt32BE(headerLen + 12);
        duration = b.readUInt32BE(headerLen + 16);
      }
      if (timescale > 0) out.durationSec = duration / timescale;
    } else if (type === 'tkhd') {
      const b = Buffer.alloc(atomSize);
      fs.readSync(fd, b, 0, atomSize, pos);
      const version = b[headerLen];
      // v0 载荷84字节：宽高在 headerLen+76；v1 创建/修改时间各8字节：+84
      const wOff = version === 1 ? headerLen + 84 : headerLen + 76;
      const w = b.readUInt32BE(wOff) / 65536;
      const h = b.readUInt32BE(wOff + 4) / 65536;
      // 记录首个视频轨（宽高都非零）
      if (w > 0 && h > 0 && !out.width) {
        out.width = Math.round(w);
        out.height = Math.round(h);
      }
    } else if (type === 'stsd') {
      const b = Buffer.alloc(Math.min(atomSize, 64));
      fs.readSync(fd, b, 0, b.length, pos);
      const codec = b.toString('latin1', headerLen + 12, headerLen + 16);
      if (codec === 'avc1' || codec === 'hvc1' || codec === 'hev1' || codec === 'mp4v' || codec === 'av01') {
        out.videoCodec = codec === 'avc1' ? 'H.264' : codec;
      } else if (codec === 'mp4a') {
        out.audioCodec = 'AAC';
      }
    } else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
      readAtoms(pos + headerLen, pos + atomSize, depth + 1, out);
    }
    pos += atomSize;
  }
}

const out = { sizeBytes: size };
readAtoms(0, size, 0, out);
fs.closeSync(fd);

const mb = (size / 1024 / 1024).toFixed(1);
const dur = out.durationSec ? `${Math.floor(out.durationSec / 60)}分${Math.round(out.durationSec % 60)}秒（${out.durationSec.toFixed(1)}s）` : '未知';
console.log(`文件: ${file}`);
console.log(`大小: ${size} 字节（${mb} MB）`);
console.log(`时长: ${dur}`);
console.log(`分辨率: ${out.width || '?'}×${out.height || '?'}`);
console.log(`视频编码: ${out.videoCodec || '?'}`);
console.log(`音频: ${out.audioCodec || '无/未知'}`);
