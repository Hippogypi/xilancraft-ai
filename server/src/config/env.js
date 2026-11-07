/**
 * 环境配置加载（契约§1/§6/§8）
 * - .env 用极简手写解析器（fs读取+按行split），不引入 dotenv
 * - 已存在于 process.env 的变量优先，.env 不覆盖
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { log } = require('../utils/logger');

const SERVER_ROOT = path.resolve(__dirname, '..', '..'); // server/

/** 极简 .env 解析：KEY=VALUE，支持 # 注释与首尾引号 trimming */
function loadDotEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 去掉成对的单/双引号
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value; // 不覆盖已有环境变量
  }
}

function toInt(v, fallback) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function build() {
  loadDotEnvFile(path.join(SERVER_ROOT, '.env'));

  const dataDir = path.resolve(SERVER_ROOT, process.env.DATA_DIR || './data');

  // SECRET_KEY：32字节hex（64字符）。缺失→临时随机（重启后已存密钥将无法解密，需警告）；
  // 存在但格式非法→直接抛错，避免静默使用错误密钥。
  let secretKeyHex = (process.env.SECRET_KEY || '').trim();
  let dataKey = null;
  let secretKeyEphemeral = false;
  if (!secretKeyHex) {
    dataKey = crypto.randomBytes(32);
    secretKeyEphemeral = true;
  } else if (!/^[0-9a-fA-F]{64}$/.test(secretKeyHex)) {
    throw new Error('配置错误：SECRET_KEY 必须为64个hex字符（32字节），请参考 server/.env.example 生成');
  } else {
    dataKey = Buffer.from(secretKeyHex, 'hex');
  }

  return {
    SERVER_ROOT,
    PORT: toInt(process.env.PORT, 3000),
    HOST: process.env.HOST || '0.0.0.0',

    // 管理员首启种子（契约§3：.env 只作首启种子）
    ADMIN_USERNAME: (process.env.ADMIN_USERNAME || 'admin').trim(),
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin',

    // 密钥加密
    dataKey,
    secretKeyEphemeral,

    // 目录
    DATA_DIR: dataDir,
    GENERATED_DIR: path.join(dataDir, 'generated'),
    UPLOADS_DIR: path.join(dataDir, 'uploads'),
    DB_PATH: path.join(dataDir, 'xilankapu.db'),

    // 生成/限频常量（规格§8：超时120s、冷却3s、默认每日上限50）
    GENERATION_TIMEOUT_MS: toInt(process.env.GENERATION_TIMEOUT_MS, 120 * 1000),
    GLOBAL_COOLDOWN_MS: toInt(process.env.GLOBAL_COOLDOWN_MS, 3 * 1000),
    DEFAULT_DAILY_LIMIT: toInt(process.env.DEFAULT_DAILY_LIMIT, 50),

    // 会话：内存存储、24h 过期；登录失败5次锁10分钟（契约§3）
    SESSION_TTL_MS: 24 * 60 * 60 * 1000,
    LOGIN_MAX_FAILS: 5,
    LOGIN_LOCK_MS: 10 * 60 * 1000,

    // 上传：JPG/PNG ≤ 5MB（契约§4）
    UPLOAD_MAX_BYTES: 5 * 1024 * 1024,
    UPLOAD_BODY_LIMIT_BYTES: 12 * 1024 * 1024, // multipart 解析缓冲上限（含边界开销）

    // 下载上游图片的大小上限
    MAX_IMAGE_DOWNLOAD_BYTES: 20 * 1024 * 1024,
  };
}

const config = build();

if (config.secretKeyEphemeral) {
  log('warn', 'SECRET_KEY 未配置，已生成临时密钥：重启后已保存的Provider API Key将无法解密，请尽快在 server/.env 中配置固定 SECRET_KEY');
}

module.exports = config;
