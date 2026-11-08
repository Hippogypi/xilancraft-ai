/**
 * utils/prompt-builder.js —— 西兰卡普重构型 Prompt 组装（WBS 04.02 / 规格 §7）
 *
 * 模板（v3：服装风格/应用部位交由用户提示词自由描述；配色来自工坊可视化取色器）：
 *   服装印花图案设计稿：解构西兰卡普传统纹样（{参考纹样名}），符号解构、几何重组、节奏与对称。
 *   配色：{单色：以{主色}为主色，可用黑白等中性色辅助构图
 *         双色：以{主色}为主、{辅色}点缀，突出双色搭配关系}。
 *   {用户提示词}。
 *   画面硬性要求：扁平插画风格的纹样图案，主体图案居中醒目、构图饱满、纹样边界清晰；
 *   纯白色背景（服务端将自动抠除背景形成透明底）；禁止照片写实、禁止风景天空草地、禁止人物、禁止任何文字。
 *
 * - 参考纹样名：纹样名称；素材库跳转带关键词时为「名称，关键词：k1、k2」；
 *   未选参考纹样时回退为「经典几何纹样」。
 */
'use strict';

const DEFAULT_REFERENCE_NAME = '经典几何纹样';

/** 参考纹样名 + 关键词 → 模板括号内片段 */
function buildReferenceName(motifName, motifKeywords) {
  const name = (motifName || '').trim();
  const kws = Array.isArray(motifKeywords)
    ? motifKeywords
        .map(function (k) { return String(k || '').trim(); })
        .filter(function (k) { return k; })
    : [];
  if (!name && !kws.length) return DEFAULT_REFERENCE_NAME;
  if (!name) return kws.join('、');
  if (!kws.length) return name;
  return name + '，关键词：' + kws.join('、');
}

/**
 * 组装完整提示词
 * @param {Object} opts
 *   motifName {String} 参考纹样名（可空）
 *   motifKeywords {String[]} 参考纹样关键词（素材库「以此为灵感」带入）
 *   colors {Object} 取色器状态：{ mainName, auxName, dual }
 *     - mainName {String} 主色中文名（必有）
 *     - auxName {String} 辅助色中文名（dual=true 时使用）
 *     - dual {Boolean} 双色模式；false 时单色模式（允许黑白中性色辅助构图）
 *   userPrompt {String} 用户提示词（≤200 字，可自由描述风格/部位/创意）
 * @returns {String} 组装后的完整提示词
 */
function buildPrompt(opts) {
  opts = opts || {};
  const colors = opts.colors || {};
  const mainName = (colors.mainName || '织锦红').trim() || '织锦红';
  const dual = !!colors.dual && !!(colors.auxName || '').trim();
  const auxName = dual ? colors.auxName.trim() : '';

  const colorSentence = dual
    ? '配色：以' + mainName + '为主、' + auxName + '点缀，突出双色搭配关系。'
    : '配色：以' + mainName + '为主色，可用黑白等中性色辅助构图。';

  const refName = buildReferenceName(opts.motifName, opts.motifKeywords);
  const userPrompt = (opts.userPrompt || '').trim();

  return '服装印花图案设计稿：解构西兰卡普传统纹样（' + refName + '），符号解构、几何重组、节奏与对称。' +
    colorSentence +
    userPrompt + '。' +
    '画面硬性要求：扁平插画风格的纹样图案，主体图案居中醒目、构图饱满、纹样边界清晰；' +
    '纯白色背景（服务端将自动抠除背景形成透明底）；禁止照片写实、禁止风景天空草地、禁止人物、禁止任何文字。';
}

module.exports = {
  buildPrompt: buildPrompt,
  buildReferenceName: buildReferenceName,
  DEFAULT_REFERENCE_NAME: DEFAULT_REFERENCE_NAME
};
