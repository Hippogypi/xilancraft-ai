/**
 * 结构化JSON日志（契约§7安全红线：日志绝不包含API Key/完整鉴权头/联系方式明文）
 */
'use strict';

/** 脱敏消息：去控制字符并截断，防止异常文本带出敏感内容 */
function sanitizeMessage(msg, maxLen = 300) {
  const s = String(msg == null ? '' : msg);
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maxLen);
}

function emit(level, msg, fields) {
  const entry = { ts: new Date().toISOString(), level, msg: sanitizeMessage(msg, 500) };
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      // 红线：任何疑似密钥/鉴权字段直接丢弃
      if (/api_?key|authorization|secret/i.test(k)) continue;
      entry[k] = typeof v === 'string' ? sanitizeMessage(v, 500) : v;
    }
  }
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  sanitizeMessage,
  log: (level, msg, fields) => emit(level, msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
};
