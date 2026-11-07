/**
 * 生成任务编排（契约§4用户端端点 + §6状态机 + 规格§8.2）
 * 状态机：queued → running → succeeded | failed
 * - 提交即返回jobId，异步执行；图片落盘 data/generated；默认120s超时
 * - 单任务不自动重试（规格§8.1）；Provider快照存于任务行
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config/env');
const { getDb } = require('../db');
const { ApiError } = require('../utils/respond');
const { newId } = require('../utils/crypto');
const { sanitizeMessage, log } = require('../utils/logger');
const { getAdapter } = require('../providers');
const quota = require('./quota');
const { getActiveProviderRow, getProviderRow, buildProviderConfig, parseSettings } = require('./providerService');

const SIZE_RE = /^\d{2,5}x\d{2,5}$/;
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/** 固定测试提示词（契约§4：test端点用1条固定测试提示词真实生成） */
const TEST_PROMPT =
  '西兰卡普织锦风格测试图：黑底红黄配色，菱形几何骨架与锯齿纹组合，扁平服装印花图案，主体完整，背景简洁';

function imageUrlFor(filename) {
  return filename ? `/api/images/generated/${path.basename(filename)}` : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 提交生成任务：校验 → 限频/配额 → 建任务行 → 异步执行 → 返回 {jobId,status}
 */
async function submitGeneration(body) {
  const b = body || {};

  // ---- 参数校验（契约§4 请求体）----
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : '';
  if (!prompt) throw new ApiError(400, 'VALIDATION_ERROR', 'prompt 不能为空');
  if (prompt.length > 2000) throw new ApiError(400, 'VALIDATION_ERROR', 'prompt 过长（最多2000字符）');

  const mode = b.mode === undefined ? 'text_to_image' : b.mode;
  if (mode !== 'text_to_image' && mode !== 'image_to_image') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'mode 仅支持 text_to_image / image_to_image');
  }

  const size = b.size === undefined || b.size === null || b.size === '' ? '1024x1024' : String(b.size);
  if (!SIZE_RE.test(size)) throw new ApiError(400, 'VALIDATION_ERROR', 'size 格式必须为 宽x高，如 1024x1024');
  const [sw, sh] = size.split('x').map(Number);
  if (sw < 256 || sw > 2048 || sh < 256 || sh > 2048) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'size 长宽须在 256~2048 像素之间');
  }

  if (b.style !== undefined && b.style !== null && (typeof b.style !== 'string' || b.style.length > 64)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'style 必须为不超过64字符的字符串');
  }

  let motifId = '';
  if (b.referenceMotifId !== undefined && b.referenceMotifId !== null) {
    if (typeof b.referenceMotifId !== 'string' || b.referenceMotifId.length > 64) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'referenceMotifId 必须为不超过64字符的字符串');
    }
    motifId = b.referenceMotifId.trim();
  }

  // ---- 激活Provider（无则409 PROVIDER_NOT_ACTIVE）----
  const provider = getActiveProviderRow();
  if (!provider) throw new ApiError(409, 'PROVIDER_NOT_ACTIVE', '暂无激活的AI服务，请管理员在管理端配置并激活');

  // ---- 成本护栏：全局冷却 + 每日上限 ----
  quota.assertCooldown();
  quota.assertDailyQuota(provider);

  // ---- 近似图生图：参考纹样关键词注入提示词（决策基线）----
  let finalPrompt = prompt;
  if (motifId) finalPrompt = `${finalPrompt}，融合参考纹样「${motifId}」的典型视觉元素`;

  // ---- 可选参考图（来自 /api/uploads/reference）----
  let referenceImagePath = null;
  if (b.referenceImageId !== undefined && b.referenceImageId !== null && b.referenceImageId !== '') {
    if (typeof b.referenceImageId !== 'string' || !/^[A-Za-z0-9-]+$/.test(b.referenceImageId)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'referenceImageId 不合法');
    }
    const found = ['png', 'jpg'].map((e) => `${b.referenceImageId}.${e}`).find((f) => fs.existsSync(path.join(config.UPLOADS_DIR, f)));
    if (!found) throw new ApiError(400, 'VALIDATION_ERROR', '参考图不存在，请重新上传');
    referenceImagePath = found;
  }

  // ---- 建任务（Provider快照：provider_id/model_id）----
  const id = newId('job');
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO generation_jobs (id, provider_id, model_id, prompt, reference_image_path, status, started_at)
       VALUES (?, ?, ?, ?, ?, 'queued', ?)`
    )
    .run(id, provider.id, provider.model_id || '', finalPrompt, referenceImagePath, now);

  quota.recordUsage(provider.id); // 计入每日调用
  quota.markSubmitted(); // 触发冷却计时

  // 异步执行，不阻塞响应（前端轮询获取结果）
  setImmediate(() => {
    processJob(id, { size }).catch((e) => log('error', '任务执行异常', { jobId: id, err: sanitizeMessage(e && e.message) }));
  });

  log('info', '生成任务已提交', { jobId: id, providerId: provider.id, mode });
  return { jobId: id, status: 'queued' };
}

/** 内部：落盘结果图并更新任务为succeeded */
function completeJob(jobId, imageBytes, mimeType) {
  const ext = MIME_EXT[mimeType] || 'png';
  const filename = `${jobId}.${ext}`;
  fs.writeFileSync(path.join(config.GENERATED_DIR, filename), imageBytes);
  getDb()
    .prepare(`UPDATE generation_jobs SET status='succeeded', output_image_path=?, finished_at=? WHERE id=?`)
    .run(filename, new Date().toISOString(), jobId);
  return filename;
}

/** 内部：任务置为failed（消息脱敏） */
function failJob(jobId, code, message) {
  getDb()
    .prepare(`UPDATE generation_jobs SET status='failed', error_code=?, error_message=?, finished_at=? WHERE id=?`)
    .run(code, sanitizeMessage(message, 300), new Date().toISOString(), jobId);
}

/**
 * 执行任务：running → 调适配器（含pending轮询）→ succeeded/failed。
 * 超时控制：deadline = 开始 + settings.timeout（默认120s）。
 */
async function processJob(jobId, input) {
  const db = getDb();
  const job = db.prepare('SELECT * FROM generation_jobs WHERE id=?').get(jobId);
  if (!job || job.status !== 'queued') return;
  const provider = getProviderRow(job.provider_id);
  db.prepare(`UPDATE generation_jobs SET status='running' WHERE id=?`).run(jobId);
  const t0 = Date.now();

  try {
    if (!provider) throw new ApiError(502, 'GENERATION_FAILED', '关联的服务配置已被移除');
    const cfg = buildProviderConfig(provider); // 解密失败会抛400
    const settings = parseSettings(provider.settings_json);
    const deadline = Date.now() + (settings.timeout ? settings.timeout * 1000 : config.GENERATION_TIMEOUT_MS);
    const adapter = getAdapter(provider.adapter_type);

    let result = await adapter.generate({ prompt: job.prompt, size: (input && input.size) || settings.size || '1024x1024' }, cfg);

    // 异步协议：pending → 记录remote_job_id并轮询（同步协议不会走到这里）
    while (result.kind === 'pending') {
      if (!adapter.poll) throw new ApiError(502, 'GENERATION_FAILED', '该适配器不支持异步任务轮询');
      if (Date.now() >= deadline) throw new ApiError(504, 'GENERATION_TIMEOUT', '生成超时（超过上游时限）');
      db.prepare('UPDATE generation_jobs SET remote_job_id=? WHERE id=?').run(result.remoteJobId, jobId);
      await sleep(2000);
      result = await adapter.poll(result.remoteJobId, cfg);
    }

    if (result.kind === 'completed') {
      completeJob(jobId, result.imageBytes, result.mimeType);
      log('info', '生成任务成功', { jobId, providerId: provider.id, durationMs: Date.now() - t0 });
    } else {
      throw new ApiError(502, result.code || 'GENERATION_FAILED', result.message || '上游生成失败');
    }
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError(502, 'GENERATION_FAILED', sanitizeMessage(e && e.message, 200));
    failJob(jobId, err.code, err.message);
    log('warn', '生成任务失败', { jobId, code: err.code, durationMs: Date.now() - t0 });
  }
}

/** 用户端轮询视图（契约§4字段，严格最小集） */
function getJobForUser(id) {
  const row = getDb().prepare('SELECT * FROM generation_jobs WHERE id=?').get(id);
  if (!row) return null;
  const data = { jobId: row.id, status: row.status, modelId: row.model_id };
  if (row.status === 'succeeded' && row.output_image_path) data.imageUrl = imageUrlFor(row.output_image_path);
  if (row.status === 'failed') data.error = { code: row.error_code || 'GENERATION_FAILED', message: row.error_message || '生成失败' };
  return data;
}

/** 管理端序列化（契约§4：提示词/模型/状态/结果图/错误码） */
function serializeJobAdmin(row, providerName) {
  return {
    id: row.id,
    jobId: row.id,
    providerId: row.provider_id,
    providerName: providerName || null,
    adapterType: row.adapter_type || null,
    modelId: row.model_id,
    prompt: row.prompt,
    status: row.status,
    imageUrl: row.status === 'succeeded' ? imageUrlFor(row.output_image_path) : null,
    referenceImagePath: row.reference_image_path || null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

/** 管理端分页列表 */
function listJobs({ status, page, pageSize }) {
  const db = getDb();
  const conds = [];
  const params = [];
  if (status) {
    conds.push('g.status = ?');
    params.push(status);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM generation_jobs g ${where}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT g.*, p.name AS provider_name, p.adapter_type FROM generation_jobs g
       LEFT JOIN providers p ON p.id = g.provider_id
       ${where} ORDER BY g.started_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return { list: rows.map((r) => serializeJobAdmin(r, r.provider_name)), page, pageSize, total };
}

/** 管理端Provider测试生成（契约§4 test端点）：真实调用一次并落盘 */
async function runProviderTest(providerRow) {
  const adapter = getAdapter(providerRow.adapter_type);
  const cfg = buildProviderConfig(providerRow); // 配置不全/解密失败 → 400
  await adapter.validateConfig(cfg); // 未发起调用前的配置问题不计配额

  const settings = parseSettings(providerRow.settings_json);
  const t0 = Date.now();
  try {
    quota.assertDailyQuota(providerRow); // 测试也计入每日配额（规格§8.1）
    const result = await adapter.generate({ prompt: TEST_PROMPT, size: settings.size || '1024x1024' }, cfg);
    if (result.kind !== 'completed') throw new ApiError(502, 'GENERATION_FAILED', '异步任务测试暂不支持');
    quota.recordUsage(providerRow.id);
    const ext = MIME_EXT[result.mimeType] || 'png';
    const filename = `test-${providerRow.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(config.GENERATED_DIR, filename), result.imageBytes);
    getDb()
      .prepare('UPDATE providers SET last_test_status=?, last_test_at=?, updated_at=? WHERE id=?')
      .run('success', new Date().toISOString(), new Date().toISOString(), providerRow.id);
    log('info', 'Provider测试生成成功', { providerId: providerRow.id, durationMs: Date.now() - t0 });
    return { status: 'success', durationMs: Date.now() - t0, imageUrl: imageUrlFor(filename) };
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 'GENERATION_FAILED';
    const message = sanitizeMessage(e instanceof ApiError ? e.message : e && e.message ? e.message : '测试生成失败', 300);
    getDb()
      .prepare('UPDATE providers SET last_test_status=?, last_test_at=?, updated_at=? WHERE id=?')
      .run('failed', new Date().toISOString(), new Date().toISOString(), providerRow.id);
    log('warn', 'Provider测试生成失败', { providerId: providerRow.id, code, durationMs: Date.now() - t0 });
    return { status: 'failed', durationMs: Date.now() - t0, error: { code, message } };
  }
}

/** 服务启动时清扫：上次运行遗留的 queued/running 任务统一置failed（WBS 08.03持久化一致性） */
function sweepInterruptedJobs() {
  const r = getDb()
    .prepare(
      `UPDATE generation_jobs SET status='failed', error_code='GENERATION_FAILED',
       error_message='服务重启导致任务中断，请重新生成', finished_at=? WHERE status IN ('queued','running')`
    )
    .run(new Date().toISOString());
  if (r.changes > 0) log('warn', '已将中断任务标记为失败', { count: r.changes });
}

module.exports = { submitGeneration, getJobForUser, listJobs, serializeJobAdmin, runProviderTest, sweepInterruptedJobs, TEST_PROMPT };
