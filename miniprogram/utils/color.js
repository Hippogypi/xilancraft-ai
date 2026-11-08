/**
 * utils/color.js —— HSL→HEX 与中文色名推导
 * 供工坊可视化取色器：滑块调出的 HSL 实时转 HEX 渲染，并推导中文色名注入生图提示词
 * （界面不显示色号，色号仅用于渲染；提示词用「深靛蓝」「浅翠绿」等自然语言）
 */
'use strict';

/** HSL(h 0-360, s 0-100, l 0-100) → HEX（小写 #rrggbb） */
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = s / 100;
  l = l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = function (v) {
    let n = Math.round((v + m) * 255);
    if (n < 0) n = 0;
    if (n > 255) n = 255;
    const s2 = n.toString(16);
    return s2.length === 1 ? '0' + s2 : s2;
  };
  return '#' + to(r) + to(g) + to(b);
}

/** 色相区间 → 基础色名（西兰卡普织锦常用色系语义） */
const HUE_FAMILIES = [
  [0, 14, '红'], [15, 40, '橙'], [41, 69, '金黄'], [70, 100, '黄绿'],
  [101, 160, '翠绿'], [161, 190, '青碧'], [191, 220, '湖蓝'], [221, 255, '靛蓝'],
  [256, 290, '紫'], [291, 345, '洋红'], [346, 360, '红']
];

/** HSL → 中文色名：低饱和按明度归「月白/暖灰/墨黑」，否则按区间加 深/浅/艳 修饰 */
function colorNameFromHsl(h, s, l) {
  if (s < 12) {
    if (l >= 70) return '月白';
    if (l >= 45) return '暖灰';
    return '墨黑';
  }
  let base = '红';
  for (let i = 0; i < HUE_FAMILIES.length; i++) {
    if (h >= HUE_FAMILIES[i][0] && h <= HUE_FAMILIES[i][1]) {
      base = HUE_FAMILIES[i][2];
      break;
    }
  }
  if (l < 28) return '深' + base;
  if (l > 78) return '浅' + base;
  if (s >= 75) return '艳' + base;
  return base;
}

module.exports = { hslToHex, colorNameFromHsl };
