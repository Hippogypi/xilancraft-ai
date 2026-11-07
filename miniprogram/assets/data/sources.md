# 素材来源登记（miniprogram/assets）

> 用途声明：以下图像均为**比赛演示（Demo）用途**，仅在小程序本地展示，不作商业分发。公开新闻配图与博物馆藏品照片的著作权归原作者/机构所有；正式商用前需另行取得授权或替换为自拍/自绘素材。

## 一、传统纹样真实图像（miniprogram/assets/motifs/）

| 文件名 | 大小 | 纹样 | 原始 URL | 来源说明 | 授权评估（比赛演示用途） |
|---|---|---|---|---|---|
| motif-48gou.jpg | 34.6KB | 四十八勾 | https://wximg1.artimg.net/news/201407/2014072620210662196.jpg | 红网报道《龙山县土家织锦艺术展惊艳上海》（雅昌艺术网转载，2014-07-26），图注"黎成凤的土家织锦作品《四十八勾》" | 新闻报道配图，已视觉复核（多层菱形勾状放射结构，雅昌水印）。比赛演示属于合理引用范畴；商用需联系雅昌/红网或拍摄新图 |
| motif-yangquehua.jpg | 297.4KB | 阳雀花 | https://x0.ifengimg.com/ucms/2026_35/3E55E46C9CB65FCD490F717A7556095E68BB230F_size305_w1099_h1368.jpg | 凤凰网湖南《非遗数字确权"首单"花落叶水云大师〈阳雀花〉》（2026-08-23），图注"西兰卡普《阳雀花》作品图"，国家级非遗传承人叶水云作品 | 新闻报道配图，已视觉复核（深蓝底 8 只对称阳雀鸟纹，与文中"深蓝真丝为底"描述吻合）。演示用途可接受；商用需授权 |
| motif-taitaihua.jpg | 65.0KB | 台台花 | https://inews.gtimg.com/om_bt/O7cyOsjk64US50NB8aHFAh0bzD8lpQtv1uQe34TCsj8GgAA/641 | 中新社"东西问"《田明：土家织锦如何织就民族"无字史书"？》（腾讯新闻转载，2026-01-21），图注"土家族民众在生活中使用西兰卡普台台花盖裙。受访者供图" | 已视觉复核（老人抱婴儿、织锦盖裙覆于竹摇窝，中新网水印）。场景真实、来源权威；演示用途可接受 |
| motif-mabi.jpg | 158.6KB | 马毕/四十八勾/岩墙花/阳雀花（四纹样拼图） | https://inews.gtimg.com/om_bt/OAVYtXQAYuvlDuvSeE1YAkbN16PLg9kOcV_HhauwN2rKUAA/641 | 同上"东西问"文章，图注"西兰卡普纹样拼图。左上为马毕纹样、右上为四十八勾纹样、左下为岩墙花纹样、右下为阳雀花纹样。均为受访者供图" | 已视觉复核四象限内容与图注一一对应（马形/勾纹放射/垒石条垒/鸟纹）。此图同时作为 motifs.json 中"马毕"与"岩墙花"两条目的配图（岩墙花无独立可信图源） |
| motif-fengmudan.jpg | 240.6KB | 凤穿牡丹 | https://sghimages.shobserver.com/img/catch/2020/08/08/13a47320-03eb-4aed-ac3f-c11d32a5d150.jpg | 上观新闻《征集故事｜土家织锦壁挂：千年技艺，织造民族记忆的纹路》（2020-08-08），图注"土家族凤穿牡丹纹锦 | 图源：民族服饰博物馆" | 博物馆藏品照片经新闻媒体刊发，来源链清晰（北京服装学院民族服饰博物馆）。演示用途可接受；视觉复核因分析服务超时未完成，以图注为准 |

- 合计 796KB（≤1.2MB 预算），单张均 ≤300KB，全部为合法 JPEG（魔数 FF D8 FF）。
- 备选已验证但未入库：黎承菊"双阳雀花"壁挂正反面（上观新闻，266KB，世界技能博物馆收藏，已视觉复核）——如需第 7 条传统纹样可直接启用。

## 二、服装模板（miniprogram/assets/garments/）

| 文件名 | 原始素材 |
|---|---|
| garment-tshirt.png | assets_raw/白色服装透明底单件素材_15件/01_圆领短袖T恤.png（自有素材包，512×512 透明底） |
| garment-polo.png | 同上/03_短袖Polo衫.png |
| garment-sweatshirt.png | 同上/06_圆领卫衣.png |
| garment-hoodie.png | 同上/07_连帽卫衣.png |
| garment-bomber.png | 同上/09_飞行员夹克.png |
| garment-dress.png | 同上/14_短袖衬衫连衣裙.png |

## 三、TabBar 图标（miniprogram/assets/tabbar/）

- 8 张 81×81 PNG（heritage/inspiration/workshop/customization × normal/active）由本仓库脚本 `gen-icons.js` 用纯 Node（node:zlib）程序化生成，菱形几何造型为原创设计，无第三方版权问题。
- normal 色 rgba(185,172,151,0.65)，active 色 #C9A063，透明背景。

## 四、遗留问题

1. **蛇花（窝毕）**：多轮检索未找到可直接下载的可信图像（实物图例主要收录于《湖湘织锦》纸质书），故未设 traditional 条目，已在 modern 条目"蛇花·回旋单线"中以转译形式保留该文化符号。
2. **岩墙花**无独立图源，与马毕共用"东西问"纹样拼图（岩墙花位于拼图左下），来源字段已注明。
3. 4 条 modern 条目 image 为空串，示例图待阶段 5 由 AI 生图补充。
