/**
 * utils/prompt-builder.js —— 西兰卡普重构型 Prompt 组装（WBS 04.02 / 规格 §7）
 *
 * 模板 v4（针对免费模型"构图固定/颜色不遵循/参考纹样无感"三项强化）：
 *   服装印花图案设计稿。
 *   参考纹样重构：以「{名称}」为原型——{patternDesc 图案结构描述}。
 *     在保留其骨架逻辑的前提下解构重组为现代图案，需能看出与原纹样的传承关系。
 *   （无参考时：基于西兰卡普经典几何语言创作全新纹样——菱形骨架、勾连折线、通经断纬色块交织。）
 *   构图：{随机布局变体}。表现手法：{随机手法变体}。
 *   {用户提示词}。
 *   配色严格限定：{单色：仅{主色}为主（占60%以上面积）+黑白中性色 | 双色：{主色}60%以上+{辅色}约30%+黑白}，禁止出现其他色相。
 *   画面硬性要求：扁平图案设计稿，主体居中醒目占画面中心区域；纯白色背景（服务端自动抠底）；
 *     禁止照片写实、禁止风景天空草地、禁止人物、禁止任何文字。
 *
 * - 构图/手法变体池：每次生成随机抽取，打破"每次款式雷同"；「重新生成」自然得到不同变体
 * - 颜色以中文色名注入并两处强调（取色器 utils/color.js 推导）
 */
'use strict';

const DEFAULT_REFERENCE_NAME = '经典几何纹样';

/** 构图变体池（打破构图固定） */
const LAYOUT_VARIANTS = [
  '菱形网格满铺、单元等距排布',
  '中心放射对称、层层向外扩展',
  '斜向条带二方连续、往复循环',
  '大小散点错落、疏密对比排布',
  '单个超大主体居中、气势饱满',
  '回旋环抱式构图、线条环绕中心',
  '上下分区条带、粗细节奏交替'
];

/** 表现手法变体池 */
const STYLE_VARIANTS = [
  '扁平几何色块、边界利落',
  '极简单线描、线宽均匀',
  '剪纸风格、正负形对比',
  '像素方块阵列、网格感',
  '色块渐变拼接、柔和过渡',
  '粗描边海报风、块面对比强烈'
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

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

/** 参考重构段：有结构描述时注入 patternDesc，否则退回名称+关键词 */
function buildReferenceSection(motifName, motifKeywords, motifDesc) {
  const name = (motifName || '').trim() || buildReferenceName(motifName, motifKeywords);
  const desc = (motifDesc || '').trim();
  if (desc) {
    return '参考纹样重构：以「' + name + '」为原型——' + desc +
      '。在保留其骨架逻辑与单元特征的前提下进行解构与现代化重组，可改变单元形状、比例与疏密，但需能看出与原纹样的传承关系。';
  }
  return '解构西兰卡普传统纹样（' + buildReferenceName(motifName, motifKeywords) +
    '），符号解构、几何重组、节奏与对称，重组为现代图案。';
}

/**
 * 组装完整提示词
 * @param {Object} opts
 *   motifName {String} 参考纹样名（可空）
 *   motifKeywords {String[]} 参考纹样关键词
 *   motifDesc {String} 参考纹样图案结构描述（素材 patternDesc，可空——有则触发重构段）
 *   colors {Object} { mainName, auxName, dual }（取色器状态）
 *   userPrompt {String} 用户提示词（自由描述风格/部位/创意）
 * @returns {String} 组装后的完整提示词
 */
function buildPrompt(opts) {
  opts = opts || {};
  const colors = opts.colors || {};
  const mainName = (colors.mainName || '织锦红').trim() || '织锦红';
  const dual = !!colors.dual && !!(colors.auxName || '').trim();
  const auxName = dual ? colors.auxName.trim() : '';

  // 配色强制：色名 + 面积占比 + 禁止其他色相（两处强调）
  const colorSentence = dual
    ? '配色严格限定：整幅图案仅使用「' + mainName + '」为主色（覆盖60%以上面积）与「' + auxName +
      '」为点缀色（约30%），其余仅允许黑白中性色，禁止出现任何其他色相。'
    : '配色严格限定：整幅图案以「' + mainName +
      '」为唯一主色（覆盖60%以上面积），辅色仅允许黑白中性色，禁止出现任何其他色相。';

  const refSection = buildReferenceSection(opts.motifName, opts.motifKeywords, opts.motifDesc);
  const userPrompt = (opts.userPrompt || '').trim();

  return '服装印花图案设计稿。' +
    refSection +
    '构图：' + pick(LAYOUT_VARIANTS) + '。表现手法：' + pick(STYLE_VARIANTS) + '。' +
    userPrompt + '。' +
    colorSentence +
    '画面硬性要求：扁平插画风格的纹样图案，主体居中醒目、构图饱满、纹样边界清晰；' +
    '纯白色背景（服务端将自动抠除背景形成透明底）；禁止照片写实、禁止风景天空草地、禁止人物、禁止任何文字。';
}

module.exports = {
  buildPrompt: buildPrompt,
  buildReferenceName: buildReferenceName,
  DEFAULT_REFERENCE_NAME: DEFAULT_REFERENCE_NAME,
  LAYOUT_VARIANTS: LAYOUT_VARIANTS,
  STYLE_VARIANTS: STYLE_VARIANTS
};
