/**
 * 极简 multipart/form-data 解析器（运行时依赖仅express，不引 multer）
 * 仅服务于单文件上传（字段名 file），按 boundary 切分后解析各 part 头。
 */
'use strict';

const { ApiError } = require('./respond');

/**
 * @param {Buffer} body 原始请求体
 * @param {string} contentType 请求头 Content-Type
 * @returns {Array<{name:string, filename:string, contentType:string, data:Buffer}>}
 */
function parseMultipartFormData(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ''));
  if (!m) throw new ApiError(400, 'VALIDATION_ERROR', '请求必须为 multipart/form-data 且带 boundary');
  const boundary = '--' + (m[1] || m[2]).trim();
  const bBuf = Buffer.from(boundary);
  const parts = [];

  let idx = body.indexOf(bBuf);
  while (idx !== -1) {
    const next = body.indexOf(bBuf, idx + bBuf.length);
    if (next === -1) break; // 结束边界（--suffix）之后无内容
    // part 内容：boundary 后跳过CRLF，尾部去掉紧邻下一boundary的CRLF
    let start = idx + bBuf.length;
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
    let end = next - 2;
    if (end < start) end = start;
    const segment = body.subarray(start, end);

    // 头部与内容以 CRLFCRLF 分隔
    let name = '';
    let filename = '';
    let partType = '';
    let data = segment;
    const headerEnd = segment.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const head = segment.subarray(0, headerEnd).toString('utf8');
      data = segment.subarray(headerEnd + 4);
      for (const line of head.split('\r\n')) {
        const c = line.indexOf(':');
        if (c <= 0) continue;
        const key = line.slice(0, c).trim().toLowerCase();
        const val = line.slice(c + 1).trim();
        if (key === 'content-disposition') {
          const nm = /name="([^"]*)"/i.exec(val);
          const fn = /filename="([^"]*)"/i.exec(val);
          if (nm) name = nm[1];
          if (fn) filename = fn[1];
        } else if (key === 'content-type') {
          partType = val;
        }
      }
    }
    parts.push({ name, filename, contentType: partType, data });
    idx = next;
  }
  return parts;
}

/** 校验上传文件魔数：PNG / JPG（契约§7：只允许这两类） */
function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return 'image/png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

module.exports = { parseMultipartFormData, sniffImageMime };
