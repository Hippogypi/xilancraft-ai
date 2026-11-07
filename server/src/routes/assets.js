/**
 * 静态演示资源：GET /api/assets/:file（织机MP4、导览配图等）
 * 来源 server/public/assets/；白名单扩展名 + 防路径穿越；sendFile 原生支持 Range（视频拖动）
 */
'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { ApiError } = require('../utils/respond');

const router = express.Router();
const ASSETS_DIR = path.resolve(__dirname, '../../public/assets');
const ALLOWED_EXT = new Set(['.mp4', '.png', '.jpg', '.jpeg', '.webp', '.gif']);

router.get('/:file', (req, res, next) => {
  // basename 防穿越；白名单防任意类型读取
  const name = path.basename(String(req.params.file || ''));
  const ext = path.extname(name).toLowerCase();
  if (!name || !ALLOWED_EXT.has(ext)) {
    return next(new ApiError(404, 'NOT_FOUND', '资源不存在'));
  }
  const abs = path.join(ASSETS_DIR, name);
  if (!fs.existsSync(abs)) {
    return next(new ApiError(404, 'NOT_FOUND', '资源不存在'));
  }
  res.sendFile(abs);
});

module.exports = router;
