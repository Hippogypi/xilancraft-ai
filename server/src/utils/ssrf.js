/**
 * SSRF 地址校验（契约§6/§7安全红线）
 * - 仅允许 http/https
 * - 解析DNS后拒绝私网/环回/链路本地段：0/8、10/8、127/8、169.254/16、172.16/12、192.168/16、100.64/10、::1、fc00::/7、fe80::/10 及 IPv4-mapped IPv6
 */
'use strict';

const net = require('node:net');
const dns = require('node:dns').promises;
const { ApiError } = require('./respond');

/** IPv4 是否落在禁用网段（cidr 表示 a.b.c.d/len） */
function ipv4InCidr(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const toInt = (s) => s.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

const IPV4_BLOCKLIST = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
];

/** 判断IP（v4或v6）是否为禁止访问的地址 */
function isForbiddenIp(ipRaw) {
  let ip = String(ipRaw).trim();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  // IPv4-mapped IPv6（::ffff:a.b.c.d）还原为IPv4判断
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) ip = mapped[1];

  const version = net.isIP(ip);
  if (version === 4) {
    return IPV4_BLOCKLIST.some((cidr) => ipv4InCidr(ip, cidr));
  }
  if (version === 6) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true; // 环回/未指定
    if (low.startsWith('fe8') || low.startsWith('fe9') || low.startsWith('fea') || low.startsWith('feb')) return true; // fe80::/10 链路本地
    const first = low.split(':')[0];
    if (/^f[cd]/.test(first || '')) return true; // fc00::/7 唯一本地
    return false;
  }
  return true; // 不是合法IP也视为禁止
}

/**
 * 校验外部URL：协议http/https + 解析后全部地址为公网。
 * 不合法时抛 400 PROVIDER_CONFIG_INVALID（带友好中文说明）。
 */
async function assertPublicHttpUrl(urlStr, label = 'Base URL') {
  let u;
  try {
    u = new URL(String(urlStr));
  } catch (e) {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `${label} 不是合法的URL`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `${label} 仅支持 http/https 协议`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isForbiddenIp(host)) {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `${label} 指向内网/环回/链路本地地址，已被安全策略拦截`);
    }
    return;
  }
  // 域名：DNS解析后所有地址都必须是公网
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true, verbatim: true });
  } catch (e) {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `${label} 域名无法解析：${host}`);
  }
  if (!addrs.length) {
    throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `${label} 域名未解析到任何地址`);
  }
  for (const a of addrs) {
    if (isForbiddenIp(a.address)) {
      throw new ApiError(400, 'PROVIDER_CONFIG_INVALID', `${label} 解析到内网/环回/链路本地地址，已被安全策略拦截`);
    }
  }
}

module.exports = { assertPublicHttpUrl, isForbiddenIp };
