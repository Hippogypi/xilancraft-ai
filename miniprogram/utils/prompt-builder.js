/**
 * utils/prompt-builder.js —— 西兰卡普重构型 Prompt 组装（WBS 04.02 / 规格 §7）
 *
 * 模板 v5（用户要求与系统原料显式分级，用户 prompt 为最高优先级）：
 *   服装印花图案设计稿。
 *   【重构原料（仅供参考，非强制样式）】以「{名称}」为原型——{patternDesc 图案结构描述}。
 *     该纹样结构仅作为解构与现代化重构的素材基础，需能看出骨架传承；
 *     具体风格、构图与细节一律以下方用户要求为准。
 *   【用户要求（最高优先级，一切以用户描述为准）】{userPrompt}
 *   【补充约束（若与用户要求冲突，以用户要求为准）】
 *     配色：{主色/双色占比限定}
 *     画面：扁平图案设计稿、主体居中、纯白背景（服务端自动抠底）等硬性技术要求
 *
 * v5 变更（相对 v4）：
 * - 移除构图/手法随机变体池——款式雷同属模型能力局限，不应以随机组合干扰用户意图
 * - 用户/系统指令显式分级：用户 prompt 最高优先，系统段仅提供重构原料与 Technical 约束
 */
'use strict';

const DEFAULT_REFERENCE_NAME = '经典几何纹样';

/** 参考纹样名 + 关键词 → 名称片段 */
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

/** 重构原料段：有结构描述时注入 patternDesc（仅作素材，不约束样式）；无参考时给默认几何语言 */
function buildMaterialSection(motifName, motifKeywords, motifDesc) {
  const name = (motifName || '').trim() || buildReferenceName(motifName, motifKeywords);
  const desc = (motifDesc || '').trim();
  if (desc) {
    return '【重构原料（仅供参考，非强制样式）】以「' + name + '」为原型——' + desc +
      '。该纹样结构仅作为解构与现代化重构的素材基础，成品需能看出与原纹样的骨架传承关系；' +
      '具体风格、构图与细节一律以下方【用户要求】为准，不要复刻原图。';
  }
  return '【重构原料（仅供参考，非强制样式）】西兰卡普经典几何语言：' + buildReferenceName(motifName, motifKeywords) +
    '，菱形骨架、勾连折线、通经断纬的色块交织。仅作为创作素材，具体表现以下方【用户要求】为准。';
}

/**
 * 组装完整提示词
 * @param {Object} opts
 *   motifName {String} 参考纹样名（可空）
 *   motifKeywords {String[]} 参考纹样关键词
 *   motifDesc {String} 参考纹样图案结构描述（素材 patternDesc，可空）
 *   colors {Object} { mainName, auxName, dual }（取色器状态）
 *   userPrompt {String} 用户提示词（最高优先级：风格/构图/部位/创意自由描述）
 * @returns {String} 组装后的完整提示词
 */
function buildPrompt(opts) {
  opts = opts || {};
  const colors = opts.colors || {};
  const mainName = (colors.mainName || '织锦红').trim() || '织锦红';
  const dual = !!colors.dual && !!(colors.auxName || '').trim();
  const auxName = dual ? colors.auxName.trim() : '';

  const colorSentence = dual
    ? '配色：以「' + mainName + '」为主色（约60%面积）、「' + auxName + '」为点缀色（约30%），其余可用黑白中性色，避免出现其他色相。'
    : '配色：以「' + mainName + '」为主色（约60%面积），辅色仅用黑白中性色，避免出现其他色相。';

  const material = buildMaterialSection(opts.motifName, opts.motifKeywords, opts.motifDesc);
  const userPrompt = (opts.userPrompt || '').trim();

  return '服装印花图案设计稿。' +
    material +
    '【用户要求（最高优先级，一切以用户描述为准）】' + userPrompt + '。' +
    '【补充约束（若与上述用户要求冲突，以用户要求为准）】' +
    colorSentence +
    '画面：扁平插画风格图案，主体居中醒目、纹样边界清晰；' +
    '纯白色背景（服务端将自动抠除背景形成透明底）；禁止照片写实、禁止风景天空草地、禁止人物、禁止任何文字。';
}

module.exports = {
  buildPrompt: buildPrompt,
  buildReferenceName: buildReferenceName,
  DEFAULT_REFERENCE_NAME: DEFAULT_REFERENCE_NAME
};
