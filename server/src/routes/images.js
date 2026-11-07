/**
 * 契约端点（用户端）：
 * - GET /api/images/generated/:file  生成结果图
 * - GET /api/images/uploads/:file    参考图
 * 防路径穿越：文件名白名单字符校验 + resolve后前缀双校验（契约§7）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const config = require('../config/env');
const { ApiError } = require('../utils/respond');

const router = express.Router();

// 文件名仅允许字母数字与 ._-，且不以点开头；扩展名白名单
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const EXT_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

function sendFromDir(dir) {
  return async (req, res, next) => {
    try {
      const file = String(req.params.file || '');
      if (!SAFE_NAME_RE.test(file) || file.includes('..')) throw new ApiError(404, 'NOT_FOUND', '图片不存在');
      const ext = path.extname(file).toLowerCase().replace('.', '');
      const ctype = EXT_TYPES[ext];
      if (!ctype) throw new ApiError(404, 'NOT_FOUND', '图片不存在');
      const root = path.resolve(dir);
      const full = path.resolve(dir, file);
      if (!full.startsWith(root + path.sep)) throw new ApiError(404, 'NOT_FOUND', '图片不存在'); // 双保险
      const buf = await fs.promises.readFile(full);
      res.setHeader('Content-Type', ctype);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).send(buf);
    } catch (e) {
      if (e && e.code === 'ENOENT') return next(new ApiError(404, 'NOT_FOUND', '图片不存在'));
      next(e);
    }
  };
}

router.get('/generated/:file', sendFromDir(config.GENERATED_DIR));
router.get('/uploads/:file', sendFromDir(config.UPLOADS_DIR));

module.exports = router;
