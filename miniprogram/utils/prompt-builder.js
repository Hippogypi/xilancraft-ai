/**
 * utils/prompt-builder.js —— 西兰卡普重构型 Prompt 组装（WBS 04.02 / 规格 §7，冻结模板）
 *
 * 模板：
 *   解构西兰卡普传统纹样（{参考纹样名}），符号解构、几何重组、节奏与对称。
 *   {风格词}服装印花设计，配色：{配色词}，应用于{部位词}。
 *   画面要求：主体完整、纹样边界清晰、背景简洁、避免复杂文字。{用户提示词}
 *
 * - 参考纹样名：纹样名称；素材库跳转带关键词时为「名称，关键词：k1、k2」；
 *   未选参考纹样时回退为「经典几何纹样」。
 * - 配色为「自定义」时使用 customPalette 输入词，留空回退「自由配色」。
 */

var STYLE_WORDS = {
  streetwear: '街头潮流',
  new_chinese: '新中式',
  minimal: '极简',
  tech: '科技感'
};

var PALETTE_WORDS = {
  brocade_five: '织锦五彩',
  black_gold: '黑金',
  indigo_blue: '青蓝',
  custom: '自由配色'
};

var PLACEMENT_WORDS = {
  chest: '胸前印花',
  back: '背部大图',
  partial: '局部装饰'
};

var DEFAULT_REFERENCE_NAME = '经典几何纹样';

function pickWord(map, key, fallbackKey) {
  if (key && map[key]) return map[key];
  return map[fallbackKey];
}

/** 参考纹样名 + 关键词 → 模板括号内片段 */
function buildReferenceName(motifName, motifKeywords) {
  var name = (motifName || '').trim();
  var kws = Array.isArray(motifKeywords)
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
 *   style {String} streetwear | new_chinese | minimal | tech
 *   palette {String} brocade_five | black_gold | indigo_blue | custom
 *   customPalette {String} 自定义配色词（palette=custom 时使用）
 *   placement {String} chest | back | partial
 *   userPrompt {String} 用户提示词（≤200 字）
 * @returns {String} 组装后的完整提示词
 */
function buildPrompt(opts) {
  opts = opts || {};
  var styleWord = pickWord(STYLE_WORDS, opts.style, 'streetwear');
  var paletteWord = opts.palette === 'custom'
    ? ((opts.customPalette || '').trim() || PALETTE_WORDS.custom)
    : pickWord(PALETTE_WORDS, opts.palette, 'brocade_five');
  var placementWord = pickWord(PLACEMENT_WORDS, opts.placement, 'chest');
  var refName = buildReferenceName(opts.motifName, opts.motifKeywords);
  var userPrompt = (opts.userPrompt || '').trim();

  return '解构西兰卡普传统纹样（' + refName + '），符号解构、几何重组、节奏与对称。' +
    styleWord + '服装印花设计，配色：' + paletteWord + '，应用于' + placementWord + '。' +
    '画面要求：主体完整、纹样边界清晰、背景简洁、避免复杂文字。' +
    userPrompt;
}

module.exports = {
  buildPrompt: buildPrompt,
  buildReferenceName: buildReferenceName,
  STYLE_WORDS: STYLE_WORDS,
  PALETTE_WORDS: PALETTE_WORDS,
  PLACEMENT_WORDS: PLACEMENT_WORDS,
  DEFAULT_REFERENCE_NAME: DEFAULT_REFERENCE_NAME
};
