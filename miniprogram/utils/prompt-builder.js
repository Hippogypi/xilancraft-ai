/**
 * utils/prompt-builder.js —— 西兰卡普重构型 Prompt 组装（WBS 04.02 / 规格 §7）
 *
 * 模板 v6.3（抽象图腾化——实测 v6.2 仍输出"具象动物+低多边形羽毛"插画：
 * 具象名称诱发写实形象、"几何化"被理解为立体多面切割。转向：直接以几何形状构成抽象图腾）：
 *   【设计主题】{用户自由输入，一字不改、不截断；显式要求具象形象时模型自然遵从}
 *   【参考几何结构】{patternCore 纯抽象结构描述，不含纹样名称}（未选参考则整段省略）
 *   【西兰卡普几何语言】抽象图腾构成方式：少量大纯色块拼合 + 连接/嵌套/对称/组合关系
 *     + 纯平涂二维色块（无渐变/无明暗/无立体切割）+ 不默认写实动物细节
 *   【配色】以「主色」为主色、「辅色」为点缀色，其余用黑白中性色。（单色模式无辅色句）
 *   【输出要求】抽象平面图腾，纯白背景，适合服装印花。
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

/** 通用西兰卡普几何语言（v6.3 抽象图腾化）：直接以几何形状构成抽象图腾，
 *  而非"具象形象 + 几何装饰"；强调形状间的连接/嵌套/对称/组合关系；
 *  纯平涂二维色块（防低多边形立体插画），不默认添加写实动物细节。
 *  禁用词自查：不含"织锦/疏密/装饰纹样/渐变"等易诱发密集装饰或立体感的词 */
const XIANKAPU_VISUAL_LANGUAGE =
  '直接以几何形状构成抽象图腾，而非具象形象的几何装饰。' +
  '主体由少量完整的大纯色色块拼合而成，形状之间以连接、嵌套、对称、组合关系组织成对称构图。' +
  '全部色块纯平涂，无渐变、无明暗、无立体多面切割，不默认添加写实动物头部、眼睛、羽毛等细节。';

/** 输出约束（一句话正述；"纯白背景"为质检门闩与自动抠底的技术锚点，不可删） */
const OUTPUT_CONSTRAINT =
  '抽象平面图腾，纯白背景，适合服装印花。';

/** 参考几何结构段：v6.3 起只注入抽象结构描述（patternCore），不注入纹样名称——
 *  具象名称（如"阳雀花"）会在模型侧触发写实动物联想；无参考返回空串 */
function buildMotifSection(motifDesc) {
  const core = (motifDesc || '').trim();
  if (!core) return '';
  return '【参考几何结构】' + core + '。';
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
  const motifSection = buildMotifSection(opts.motifDesc);
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
