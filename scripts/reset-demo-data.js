/**
 * 演示数据清理工具（WBS 09.05）——清空订单/生成记录/Provider 配置，保留管理员账号
 *
 * 用法（先停服务，避免写冲突；清完重启服务）：
 *   netstat -ano | findstr :3000 → taskkill /PID <pid> /F
 *   node scripts/reset-demo-data.js
 *   cd server && node src/index.js
 *
 * 说明：管理员账号在 admin_users 表，不受影响；生成图片/上传文件请另行删除
 *       server/data/generated/*、server/data/uploads/*
 */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(__dirname, '../server/data/xilankapu.db');
if (!fs.existsSync(dbPath)) {
  console.error('未找到数据库文件：' + dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const before = {
  orders: db.prepare('SELECT COUNT(*) AS c FROM orders').get().c,
  generation_jobs: db.prepare('SELECT COUNT(*) AS c FROM generation_jobs').get().c,
  providers: db.prepare('SELECT COUNT(*) AS c FROM providers').get().c,
};
db.exec('DELETE FROM orders; DELETE FROM generation_jobs; DELETE FROM providers;');

// 顺带清理运行期图片文件
const dataDir = path.resolve(__dirname, '../server/data');
for (const sub of ['generated', 'uploads']) {
  const dir = path.join(dataDir, sub);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  }
}

console.log('已清空演示数据（保留管理员账号）：', JSON.stringify(before));
db.close();
