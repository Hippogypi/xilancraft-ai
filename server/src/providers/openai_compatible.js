/**
 * openai_compatible 适配器 —— 智谱 CogView 生图协议（契约§6）
 *
 * 协议已核实（官方文档 https://docs.bigmodel.cn/api-reference/模型-api/图像生成）：
 * - 端点：POST {base_url}/images/generations，默认 base_url = https://open.bigmodel.cn/api/paas/v4
 * - 鉴权：Authorization: Bearer <API Key>
 * - 请求体：{ model(必填: cogview-3-flash/cogview-4/cogview-4-250304/glm-image...), prompt(必填),
 *            size(可选, cogview系默认1024x1024, 枚举 768x1344/864x1152/1344x768/1152x864/1440x720/720x1440) }
 * - 响应：同步 { created, data:[{url}] }，data 仅一张图，url 为30天有效临时链接 → 需下载落盘
 * - 错误：{ error: { code, message } }
 * - cogview-3-flash 免费；cogview-4 付费（管理端慎用）
 */
'use strict';

const { ApiError } = require('../utils/respond');
const { assertPublicHttpUrl } = require('../utils/ssrf');
const { sanitizeMessage } = require('../utils/logger');
const { validateSettingsShape } = require('./settings');

const DEFAULT_TIMEOUT_MS = 120 * 1000;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

/** 下载结果魔数识别（上游可能返回PNG/JPEG/WebP/GIF） */
function sniffBytes(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return null;
}

/** 带超时的 fetch 封装；超时抛 GENERATION_TIMEOUT（504），网络错误抛 PROVIDER_UNREACHABLE（502） */
async function fetchWithTimeout(url, options, timeoutMs, unreachableMsg) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (timedOut) throw new ApiError(504, 'GENERATION_TIMEOUT', '上游生成超时，请稍后重试或切换模型');
    throw new ApiError(502, 'PROVIDER_UNREACHABLE', unreachableMsg + '：' + sanitizeMessage(e.message || e, 120));
  } finally {
    clearTimeout(timer);
  }
}

const openaiCompatibleAdapter = {
  label: '智谱CogView（openai_compatible）',

  /** 配置校验：URL协议/私网拦截(SSRF)/模型与密钥必填（契约§6） */
  async validateConfig(cfg) {
    if (!cfg.baseUrl || typeof cfg.baseUrl !== 'string') {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', '缺少 Base URL（如 https://open.bigmodel.cn/api/paas/v4）');
    }
    await assertPublicHttpUrl(cfg.baseUrl, 'Base URL');
    if (!cfg.modelId || typeof cfg.modelId !== 'string') {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', '缺少模型ID（如 cogview-3-flash）');
    }
    if (!cfg.apiKey || typeof cfg.apiKey !== 'string') {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', '缺少API Key（智谱开放平台密钥，仅加密存储于服务端）');
    }
    validateSettingsShape(cfg.settings);
  },

  /**
   * 同步生图协议：直接返回 {kind:'completed'}，无 poll。
   * @param {{prompt:string,size?:string}} input
   * @param {{baseUrl:string,modelId:string,apiKey:string,settings:object,timeoutMs:number}} cfg
   */
  async generate(input, cfg) {
    // 请求前再次SSRF校验（防保存后DNS被改指向内网）
    await assertPublicHttpUrl(cfg.baseUrl, 'Base URL');
    const url = String(cfg.baseUrl).replace(/\/+$/, '') + '/images/generations';
    const timeoutMs = cfg.timeoutMs || DEFAULT_TIMEOUT_MS;

    const body = { model: cfg.modelId, prompt: input.prompt };
    if (input.size && /^\d{2,5}x\d{2,5}$/.test(String(input.size))) body.size = String(input.size);

    const resp = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          // 安全红线：密钥只出现在此请求头，绝不入日志/错误信息
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
      '无法连接生图服务'
    );

    if (!resp.ok) {
      // 上游错误：解析 {error:{code,message}}，按语义映射契约错误码（消息脱敏）
      let upstreamMsg = '';
      try {
        const j = await resp.json();
        upstreamMsg = sanitizeMessage(j && j.error && (j.error.message || j.error.code) ? j.error.message || j.error.code : '', 160);
      } catch (e) {
        /* 忽略解析失败 */
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new ApiError(502, 'GENERATION_FAILED', '上游鉴权失败，请检查API Key是否正确');
      }
      if (resp.status === 429) {
        throw new ApiError(429, 'DAILY_QUOTA_EXCEEDED', '上游返回429：额度或频率受限' + (upstreamMsg ? `（${upstreamMsg}）` : ''));
      }
      throw new ApiError(502, 'GENERATION_FAILED', `上游返回 ${resp.status}${upstreamMsg ? `：${upstreamMsg}` : ''}`);
    }

    let json;
    try {
      json = await resp.json();
    } catch (e) {
      throw new ApiError(502, 'GENERATION_FAILED', '上游响应不是合法JSON');
    }
    const imgUrl = json && json.data && json.data[0] && json.data[0].url;
    if (!imgUrl) {
      throw new ApiError(502, 'GENERATION_FAILED', '上游未返回图片（可能触发内容审核，请调整提示词后重试）');
    }

    // 下载图片落盘前的SSRF校验（返回的URL同样不允许指向内网）
    await assertPublicHttpUrl(imgUrl, '上游图片URL');
    const imgResp = await fetchWithTimeout(imgUrl, { method: 'GET' }, Math.min(timeoutMs, 60 * 1000), '下载生成图片失败');
    if (!imgResp.ok) {
      throw new ApiError(502, 'GENERATION_FAILED', `下载生成图片失败（HTTP ${imgResp.status}）`);
    }
    const buf = Buffer.from(await imgResp.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) {
      throw new ApiError(502, 'GENERATION_FAILED', '上游图片超出大小限制');
    }
    const sniffed = sniffBytes(buf);
    if (!sniffed) {
      throw new ApiError(502, 'GENERATION_FAILED', '上游返回了非图片内容');
    }
    return { kind: 'completed', imageBytes: buf, mimeType: sniffed };
  },
  // 同步协议无需 poll
};

module.exports = { openaiCompatibleAdapter };
