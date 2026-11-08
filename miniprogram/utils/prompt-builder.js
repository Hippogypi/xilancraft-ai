/**
 * utils/prompt-builder.js —— 西兰卡普重构型 Prompt 组装（WBS 04.02 / 规格 §7）
 *
 * 模板 v6.2（视觉结构模板；v6.2 内部复杂度控制——实测 v6.1 输出主体完整但内部密布
 * 小菱形/碎折线/多层线条（民族装饰插画倾向），根因：①"织锦"触发织物纹样联想
 * ②"疏密有序"暗示密集区 ③"装饰纹样"用词；本轮改为直接约束色块与分割线）：
 *   【设计主题】{用户自由输入，一字不改、不截断}
 *   【参考纹样】{名称：patternCore 单元骨架}（未选参考则整段省略）
 *   【西兰卡普几何语言】轮廓（少量菱形/三角/方形/折线、单主体居中）+ 内部约束
 *     （大面积连续均匀纯色块、区域单色、少量粗线分割、减少嵌套/细碎/复杂线条、二维矢量剪纸观感）
 *   【配色】以「主色」为主色、「辅色」为点缀色，其余用黑白中性色。（单色模式无辅色句）
 *   【输出要求】干净的平面图案，纯白背景，适合服装印花。
 *
 * v6 设计原则（相对 v5 分级模板）：
 * - 文化概念 → 视觉结构：删除"现代化转译/传承关系/解构重组素材"等抽象元话语，
 *   通用视觉语言与纹样骨架均落到菱形/三角/阶梯折线/重复排列等可执行图形词汇
 * - 优先级与冲突处理收进组装逻辑（段落顺序即优先级），提示词内不再出现
 *   "以用户为准/仅供参考/冲突让位"类元声明；用户输入不截断、不去尾缀
 * - 具体参考纹样的独有骨架为主要图形参考，通用视觉语言仅作风格锚（防同质化由
 *   patternCore 的形状/排列差异承担）
 * - 输出约束一句话正述（不再堆摄影/场景/人物/文字否定词），保留"纯白背景"锚点
 *   以兼容服务端质检门闩与自动抠底流水线
 *
 * 版本谱系：v2 硬约束 → v3 色名 → v4 patternDesc+面积强制 → v5 分级指令
 *   →（外部实验 v6~v10 留档：弱模型下超长模板稀释主题、过度极简失锚）
 *   → v6 视觉结构模板（现行）
 */
'use strict';

/** 通用西兰卡普几何语言（默认风格锚）：纹样本源=简单几何单元，复杂度来自单元重复，
 *  服装印花取"单个单元的徽章式表达"；v6.2 重点约束主体内部复杂度——
 *  大面积均匀纯色块 + 区域单色 + 少量粗线分割 + 二维矢量剪纸观感。
 *  禁用词自查：不含"织锦/疏密/装饰纹样"等易诱发密集装饰的词（文化锚只保留"西兰卡普风格"） */
const XIANKAPU_VISUAL_LANGUAGE =
  '以西兰卡普风格的几何造型为语言，主体轮廓由少量清晰的菱形、三角形、方形与折线构成，单个主体图案居中。' +
  '主体内部使用大面积、连续、均匀的纯色色块填充，每个几何区域保持单一颜色。' +
  '仅用少量粗直线、折线和简单几何形状分割色块，减少内部嵌套纹样、细碎装饰和复杂线条。' +
  '整体呈现干净、平整的二维矢量剪纸效果。';

/** 输出约束（一句话正述；"纯白背景"为质检门闩与自动抠底的技术锚点，不可删） */
const OUTPUT_CONSTRAINT =
  '干净的平面图案，纯白背景，适合服装印花。';

/** 参考纹样段：名称 + 短骨架（patternCore 优先，patternDesc 兜底）；无参考返回空串 */
function buildMotifSection(motifName, motifDesc) {
  const name = (motifName || '').trim();
  const core = (motifDesc || '').trim();
  if (!core) return '';
  return '【参考纹样】' + (name ? name + '：' : '') + core + '。';
}

/**
 * 组装完整提示词（组装逻辑即优先级：设计主题在最前，视觉语言仅作锚，输出约束收尾）
 * @param {Object} opts
 *   motifName {String} 参考纹样名（可空）
 *   motifKeywords {String[]} 兼容保留（v6 不注入关键词，图形结构由 motifDesc 承担）
 *   motifDesc {String} 纹样短骨架（工坊传 patternCore，兜底 patternDesc；可空→省略参考段）
 *   colors {Object} { mainName, auxName, dual }（取色器状态）
 *   userPrompt {String} 用户提示词（【设计主题】原文注入，不截断）
 * @returns {String} 组装后的完整提示词
 */
function buildPrompt(opts) {
  opts = opts || {};
  const colors = opts.colors || {};
  const mainName = (colors.mainName || '织锦红').trim() || '织锦红';
  const dual = !!colors.dual && !!(colors.auxName || '').trim();
  const auxName = dual ? colors.auxName.trim() : '';

  const colorSentence = dual
    ? '【配色】以「' + mainName + '」为主色、「' + auxName + '」为点缀色，其余用黑白中性色。'
    : '【配色】以「' + mainName + '」为主色，辅色用黑白中性色。';

  const parts = [];
  const userPrompt = (opts.userPrompt || '').trim();
  // 仅在缺尾标点时补句号做段间隔（不改写、不截断用户内容）
  if (userPrompt) parts.push('【设计主题】' + userPrompt + (/[。．.!！?？…]$/.test(userPrompt) ? '' : '。'));
  const motifSection = buildMotifSection(opts.motifName, opts.motifDesc);
  if (motifSection) parts.push(motifSection);
  parts.push('【西兰卡普几何语言】' + XIANKAPU_VISUAL_LANGUAGE);
  parts.push(colorSentence);
  parts.push('【输出要求】' + OUTPUT_CONSTRAINT);
  return parts.join('');
}

module.exports = {
  buildPrompt: buildPrompt,
  buildMotifSection: buildMotifSection,
  XIANKAPU_VISUAL_LANGUAGE: XIANKAPU_VISUAL_LANGUAGE,
  OUTPUT_CONSTRAINT: OUTPUT_CONSTRAINT
};
