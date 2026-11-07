/**
 * SQLite 初始化与迁移（WBS 10.02：node:sqlite、建表安全可重复执行）
 * 表结构严格对应契约§5：providers / generation_jobs / orders / admin_users
 * 另含内部辅助表 daily_usage（每日调用计数，契约允许的实现细节）。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config/env');
const { newId, hashPassword } = require('../utils/crypto');
const { log } = require('../utils/logger');

let db = null;

/** 建表迁移：全部 IF NOT EXISTS，重复执行安全 */
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  base_url TEXT,
  model_id TEXT,
  encrypted_api_key TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  last_test_status TEXT NOT NULL DEFAULT 'untested',
  last_test_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  provider_id TEXT,
  model_id TEXT,
  prompt TEXT NOT NULL,
  reference_image_path TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  remote_job_id TEXT,
  output_image_path TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  garment_template_id TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  generation_job_id TEXT NOT NULL,
  pattern_image_path TEXT,
  preview_image_path TEXT,
  placement_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  privacy_accepted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_usage (
  provider_id TEXT NOT NULL,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, day)
);

CREATE INDEX IF NOT EXISTS idx_jobs_started ON generation_jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`;

/** 初始化数据库 + 迁移 + 管理员种子；幂等可重复调用 */
function initDb() {
  if (db) return db;
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  fs.mkdirSync(config.GENERATED_DIR, { recursive: true });
  fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });

  db = new DatabaseSync(config.DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(MIGRATION_SQL);
  seedAdmin();
  log('info', '数据库就绪', { dbPath: config.DB_PATH });
  return db;
}

/** 首启种子：库内无管理员时用 .env 的账号创建（之后 .env 不再参与校验） */
function seedAdmin() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get();
  if (row.c > 0) return;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO admin_users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    newId('adm'),
    config.ADMIN_USERNAME,
    hashPassword(config.ADMIN_PASSWORD),
    now
  );
  log('info', '已从环境变量种子创建管理员账号', { username: config.ADMIN_USERNAME });
}

function getDb() {
  if (!db) throw new Error('数据库尚未初始化');
  return db;
}

function closeDb() {
  if (db) {
    try {
      db.close();
    } finally {
      db = null;
    }
  }
}

module.exports = { initDb, getDb, closeDb };
