# UI 规格（提炼自 docs/西兰卡普AI定制服装工坊界面全景.png）

> 所有小程序 subagent 的视觉实现依据；原全景图可直接 Read 参考（1546×1024 PNG）。
> 风格基调：**深色织锦质感**——墨黑底 + 织锦红 + 暖金描边 + 米白文字，呼应西兰卡普"黑底彩纹"。

## 1. 设计 Token（写入 app.wxss CSS 变量）

```css
page {
  /* 背景/表面 */
  --xl-bg-page: #16120E;        /* 墨黑棕，页面底 */
  --xl-bg-card: #241D15;        /* 卡片底 */
  --xl-bg-card-2: #2E251B;      /* 卡片内嵌块/输入底 */
  /* 品牌色 */
  --xl-primary: #A62B2B;        /* 织锦红：主按钮/强调 */
  --xl-primary-deep: #7E1F1F;   /* 按下态 */
  --xl-gold: #C9A063;           /* 暖金：描边/标题点缀/选中 */
  --xl-gold-40: rgba(201,160,99,.4);
  /* 文字 */
  --xl-text: #F5EDDE;           /* 米白主文字 */
  --xl-text-sub: #B9AC97;       /* 次级文字 */
  --xl-text-faint: #7E7362;     /* 占位/说明 */
  /* 织线五色（分类 tag/状态点缀，取自西兰卡普经典彩线） */
  --xl-thread-red: #C0392B; --xl-thread-orange: #E67E22;
  --xl-thread-yellow: #E9B94C; --xl-thread-green: #3E8E5A; --xl-thread-blue: #3A6EA5;
  /* 状态 */
  --xl-success: #3E8E5A; --xl-danger: #C0392B; --xl-warning: #E67E22;
}
```

- 字号：页标题 36rpx/700；卡片标题 30rpx/600；正文 28rpx/400；辅助 24rpx。
- 圆角：卡片 16rpx、按钮/输入 12rpx、tag 全圆。
- 卡片通用：`background: var(--xl-bg-card); border: 1rpx solid var(--xl-gold-40); border-radius: 16rpx; padding: 24rpx;`
- 间距：页左右边距 24rpx；列表项间距 24rpx；卡片内元素 16-20rpx。
- 主按钮：织锦红底 + 米白字 + 金色 1rpx 描边；禁用态 40% 透明。
- 空态/加载态：金线菱形几何小图标 + --xl-text-sub 文案。

## 2. 页面结构与路由

### TabBar（app.json，4 个 tab，纯文字，图标 P1 再补）

| 路由 | 标签 | 页面 |
|---|---|---|
| pages/heritage/index | 非遗导览 | 文化首页 |
| pages/inspiration/index | 灵感素材 | 素材库 |
| pages/workshop/index | 定制工坊 | AI 生图 |
| pages/customization/index | 服装定制 | 预览+订单 |

tabBar 样式：黑底金字，selectedColor `--xl-gold`，color `--xl-text-sub`，backgroundColor `#1B1610`。

### 非 tab 页面

- pages/admin/login（管理员登录）
- pages/admin/home（管理首页：API 配置/生成记录/订单管理三入口 + P2 统计卡）
- pages/admin/providers（列表）/ pages/admin/providers-edit（新增/编辑，query 带 id）
- pages/admin/generations（记录列表，status 筛选）
- pages/admin/orders（列表）/ pages/admin/order-detail（详情+状态流转，query 带 id）
- 管理端页面顶部统一标注「管理端」徽标，与用户端区分。

## 3. 各页布局要点

**heritage 非遗导览**：① 顶部主视觉横幅（织锦纹样图 + 标题「西兰卡普」副题「土家族织锦·非遗新生」）；② 简介文字卡（历史/工艺/价值，每段小标题）；③ 「符号解构 · 几何重组」案例卡（左传统图 → 箭头 → 右重构图 + 一句说明）；④ 织机视频卡（video 组件，poster 封面，播放/暂停，资源缺失显示占位提示）；⑤ 底部双按钮「逛逛灵感素材 / 开始 AI 定制」；⑥ 页面标题旁的 logo 文字区 = **隐藏管理入口（连点 5 次跳 admin/login）**。

**inspiration 灵感素材**：① 分类 chips（全部/传统纹样/现代转译）；② 2 列瀑布卡片（纹样图 + 名称 + 寓意一句话 + 分类 tag）；③ 详情弹层（大图、文化解释、关键词 tag、来源说明、「以此为灵感」金色按钮 → 带 motifId+关键词跳工坊）；④ 「传统 vs 现代」对比卡（上下两图 + 设计思路）。

**workshop 定制工坊**：① 提示词 textarea（占位示例 + 字数 200 上限）；② 风格 chips（街头潮流/新中式/极简/科技感）；③ 配色 chips（织锦五彩/黑金/青蓝/自定义留空）；④ 应用部位 chips（胸前印花/背部大图/局部装饰）；⑤ 参考纹样选择横滑条（来自素材库跳转带入或本页选，P1）；⑥ 大号生成按钮；⑦ 状态区：生成中（loading+可取消等待提示）/ 成功（结果图 + 「重新生成」「用此纹样」）/ 失败（错误文案 + 重试 + 提示可联系管理员切换 API）；⑧ 免费额度/限频提示文案位。

**customization 服装定制**：① 顶部正方形预览舞台：服装底图 + 纹样层以服装 PNG 为**剪辑蒙版**（`-webkit-mask`，纹样满画布自由摆放，超出衣服轮廓自动裁剪；默认落位为该款 `printArea` 中心，支持**拖拽**移动且与滑杆双向同步）；② 模板横滑单选（图+名，切换重置位置参数）；③ 调节滑杆：大小/水平/垂直/透明度；④ 尺码 chips（S/M/L/XL）+ 数量 stepper；⑤ 联系人表单（姓名+电话，预填演示虚构数据，必填校验）；⑥ 隐私说明 checkbox（「本单为比赛演示模拟订单，不产生真实交易；同意仅为演示用途」未勾选拦截提交）；⑦ 提交按钮 → 成功态（大号订单号 + 「管理端可见」说明 + 返回首页）。

**admin/login**：居中窄卡（用户名/密码/登录），错误红字提示。
**admin/home**：三张入口卡（图标占位 + 名称 + 说明）；P2：顶部统计卡三格。
**admin/providers**：列表卡（名称/adapter 类型/model_id/激活徽标(金)/最近测试状态(绿√红×灰未测)），底部「新增配置」；点击进编辑页。
**admin/providers-edit**：表单（名称/类型选择器 openai_compatible|mock/Base URL/模型 ID/密钥 password 输入「留空=不修改」/超时秒/每日上限）；操作按钮组：保存 / 测试生成（显示耗时与结果缩略图）/ 激活。
**admin/generations**：状态筛选 chips（全部/成功/失败）+ 列表（时间、模型、状态点、结果缩略图 88rpx）；点击看详情（提示词全文/错误码）。
**admin/orders**：列表（订单号/款式/尺码/状态 tag）；详情页含纹样快照图、客户信息、状态流转按钮（待处理→设计确认→已完成）。

## 4. 通用组件（components/）

- `xl-button`（primary/ghost/mini 三态，loading 内置）
- `xl-card`（金色描边卡，可选标题）
- `xl-chips`（单选 chip 组，options/value，选中金色描边）
- `xl-empty`（空态）`xl-loading`（加载态）`xl-status-dot`（状态点）
- `xl-half-screen`（半屏弹层容器，素材详情用）

## 5. 文案基调

- 文化词 + 设计词混排：「四十八勾」「阳雀花」「几何重组」「新中式」。
- 所有订单/生成相关页面明示「比赛演示 · 模拟数据」。
- 错误文案给用户动作指引（如「AI 服务暂时不可用，可稍后重试或联系工作人员切换服务」）。
