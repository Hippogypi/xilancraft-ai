/**
 * 加密工具（契约§3/§7安全红线）
 * - 管理员密码：SHA-256 加盐哈希（契约§3明确要求SHA-256加盐，入库格式 salt$hash）
 * - Provider API Key：AES-256-GCM 加密存储，格式 v1.iv.tag.ciphertext（hex）
 * - 会话token：32 hex随机字符（契约§3）
 */
'use strict';

const crypto = require('node:crypto');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function randomHex(nBytes) {
  return crypto.randomBytes(nBytes).toString('hex');
}

/** 生成带前缀的ID，如 job-xxxx / prov-xxxx */
function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** 管理员密码哈希：salt(16B hex) + sha256(salt+password) */
function hashPassword(password) {
  const salt = randomHex(16);
  return `${salt}$${sha256Hex(salt + password)}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const calc = sha256Hex(salt + password);
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** AES-256-GCM 加密（key须为32字节Buffer） */
function encryptSecret(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join('.');
}

/** 解密；失败（密钥变更/数据损坏）抛业务错误，由上层给出友好提示 */
function decryptSecret(blob, key) {
  if (!blob) return '';
  const parts = String(blob).split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('密文格式不合法');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'hex')), decipher.final()]).toString('utf8');
  } catch (e) {
    throw new Error('无法解密已保存的密钥（SECRET_KEY可能已变更），请重新录入');
  }
}

module.exports = {
  sha256Hex,
  randomHex,
  newId,
  hashPassword,
  verifyPassword,
  encryptSecret,
  decryptSecret,
};
