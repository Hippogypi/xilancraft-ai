/**
 * 服务入口：初始化数据库 → 清扫中断任务 → 监听端口
 */
'use strict';

const config = require('./config/env');
const { initDb, closeDb } = require('./db');
const { sweepInterruptedJobs } = require('./services/generation');
const { log } = require('./utils/logger');

initDb();
sweepInterruptedJobs();

const app = require('./app');
const server = app.listen(config.PORT, config.HOST, () => {
  log('info', '西兰卡普AI工坊API服务已启动', {
    host: config.HOST,
    port: config.PORT,
    dataDir: config.DATA_DIR,
    healthUrl: `http://127.0.0.1:${config.PORT}/api/health`,
  });
});

server.on('error', (err) => {
  log('error', 'HTTP服务启动失败', { err: err.code === 'EADDRINUSE' ? `端口 ${config.PORT} 已被占用` : String(err.message) });
  closeDb();
  process.exit(1);
});

// 优雅退出（Windows下taskkill不触发，作尽力而为）
function shutdown(signal) {
  log('info', '收到退出信号，正在关闭服务', { signal });
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
