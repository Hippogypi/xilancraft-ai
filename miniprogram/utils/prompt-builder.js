/**
 * utils/prompt-builder.js —— 西兰卡普重构型 Prompt 组装（WBS 04.02 / 规格 §7）
 *
 * 模板 v7.1（简化织锦纹样·全正向表述）：
 * 目标修正历程——v6.x 系列"抽象图腾/现代极简"方向导致徽章感/放射/机甲/低多边形偏移；
 * v7.1 回归"保留传统平面构造、简化内部细节"：保留具象几何单元（如鸟形）作构造参照，
 * 全文只保留"要做"（否定词对扩散模型无效且可能反向提词），织锦一词有意回归作风格锚。
 *
 * 结构：
 *   开篇：设计一幅简化的西兰卡普风格平面几何装饰纹样。（任务定义锚，替代任何"图腾"表述）
 *   【设计主题】{用户自由输入，一字不改、不截断；显式要求具象形象时模型自然遵从}
 *   【参考几何结构】{patternCore：几何单元+构成材料+位置关系}（未选参考则整段省略）
 *   【织锦画法】规则线形组织 + 保持平面排列 + 宽完整色带 + 传统织锦图案观感
 *   【配色】以「主色」为主色、「辅色」为点缀色，其余用米白等浅中性色。（单色模式无辅色句）
 *   【输出要求】纯白背景/四周留白/平涂均匀明度一致/织物哑光色感/横平竖直直角收束
 *   （纯白背景为质检门闩与自动抠底的技术锚点，不可删）
 */
'use strict';

/** 任务定义开篇（替代"抽象图腾"类任务锚，防徽章/放射偏移） */
const TASK_OPENER = '设计一幅简化的西兰卡普风格平面几何装饰纹样。';

/** 织锦画法（全局规则，全正向表述） */
const WEAVE_METHOD =
  '使用规则的水平线、垂直线、直角转折和少量斜线组织图形。' +
  '保持原始纹样的平面排列关系，简化内部装饰，使用宽而完整的纯色色带。' +
  '整体类似清晰的传统几何织锦图案，结构规整、色块平整、轮廓明确。';

/** 输出约束（全正向；"纯白背景"为质检门闩与自动抠底的技术锚点，不可删） */
const OUTPUT_CONSTRAINT =
  '纯白背景，图案完整，四周留白。全部色块平涂均匀、明度一致，呈织物印花般的哑光色感；边缘横平竖直，以直角转折收束。';

/** 参考几何结构段：只注入 patternCore（几何单元+构成材料+位置关系），不注入纹样名称 */
function buildMotifSection(motifDesc) {
  const core = (motifDesc || '').trim();
  if (!core) return '';
  return '【参考几何结构】' + core + '。';
}

/**
 * 组装完整提示词
 * @param {Object} opts
 *   motifName {String} 参考纹样名（v7 起不注入提示词，仅保留参数兼容）
 *   motifKeywords {String[]} 兼容保留（不注入）
 *   motifDesc {String} patternCore（几何单元+构成材料+位置关系；可空→省略参考段）
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
    ? '【配色】以「' + mainName + '」为主色、「' + auxName + '」为点缀色，其余用米白等浅中性色。'
    : '【配色】以「' + mainName + '」为主色，其余用米白等浅中性色。';

  const parts = [TASK_OPENER];
  const userPrompt = (opts.userPrompt || '').trim();
  // 仅在缺尾标点时补句号做段间隔（不改写、不截断用户内容）
  if (userPrompt) parts.push('【设计主题】' + userPrompt + (/[。．.!！?？…]$/.test(userPrompt) ? '' : '。'));
  const motifSection = buildMotifSection(opts.motifDesc);
  if (motifSection) parts.push(motifSection);
  parts.push('【织锦画法】' + WEAVE_METHOD);
  parts.push(colorSentence);
  parts.push('【输出要求】' + OUTPUT_CONSTRAINT);
  return parts.join('');
}

module.exports = {
  buildPrompt: buildPrompt,
  buildMotifSection: buildMotifSection,
  TASK_OPENER: TASK_OPENER,
  WEAVE_METHOD: WEAVE_METHOD,
  OUTPUT_CONSTRAINT: OUTPUT_CONSTRAINT
};
