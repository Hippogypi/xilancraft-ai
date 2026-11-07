/**
 * 契约端点（用户端）：POST /api/uploads/reference
 * multipart 字段 file（JPG/PNG ≤5MB）→ {imageId, url}
 * 魔数校验 + 大小限制（契约§7安全红线）；落盘 data/uploads
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const config = require('../config/env');
const { ok, ApiError } = require('../utils/respond');
const { randomHex } = require('../utils/crypto');
const { parseMultipartFormData, sniffImageMime } = require('../utils/multipart');

const router = express.Router();

router.post(
  '/reference',
  express.raw({ type: 'multipart/form-data', limit: config.UPLOAD_BODY_LIMIT_BYTES }),
  (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', '缺少 multipart/form-data 请求体');
      }
      const parts = parseMultipartFormData(req.body, req.headers['content-type']);
      const filePart = parts.find((p) => p.name === 'file' && p.filename); // filename为空的纯字段跳过
      if (!filePart) throw new ApiError(400, 'VALIDATION_ERROR', '缺少名为 file 的图片文件字段');

      if (filePart.data.length === 0) throw new ApiError(400, 'UPLOAD_REJECTED', '上传文件为空');
      if (filePart.data.length > config.UPLOAD_MAX_BYTES) {
        throw new ApiError(400, 'UPLOAD_REJECTED', '图片大小不能超过5MB');
      }
      const mime = sniffImageMime(filePart.data);
      if (!mime) throw new ApiError(400, 'UPLOAD_REJECTED', '仅支持 JPG / PNG 格式图片');

      const imageId = 'img-' + randomHex(8);
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      const filename = `${imageId}.${ext}`;
      fs.writeFileSync(path.join(config.UPLOADS_DIR, filename), filePart.data);
      ok(req, res, { imageId, url: `/api/images/uploads/${filename}` });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
