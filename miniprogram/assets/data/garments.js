/**
 * assets/data/garments.js —— 服装模板数据（printArea为印花区百分比坐标）
 * 由 motifs/garments.json 转换为 JS 模块：部分微信基础库版本 require(*.json) 会异常
 */
module.exports = [
  {
    "id": "garment-001",
    "name": "圆领短袖T恤",
    "image": "/assets/garments/garment-tshirt.png",
    "printArea": {
      "top": 26.5,
      "left": 31.5,
      "width": 37,
      "height": 30
    },
    "category": "上装"
  },
  {
    "id": "garment-002",
    "name": "短袖Polo衫",
    "image": "/assets/garments/garment-polo.png",
    "printArea": {
      "top": 33,
      "left": 32,
      "width": 36,
      "height": 26
    },
    "category": "上装"
  },
  {
    "id": "garment-003",
    "name": "圆领卫衣",
    "image": "/assets/garments/garment-sweatshirt.png",
    "printArea": {
      "top": 28,
      "left": 30,
      "width": 40,
      "height": 30
    },
    "category": "上装"
  },
  {
    "id": "garment-004",
    "name": "连帽卫衣",
    "image": "/assets/garments/garment-hoodie.png",
    "printArea": {
      "top": 39.5,
      "left": 33,
      "width": 34,
      "height": 13
    },
    "category": "上装"
  },
  {
    "id": "garment-005",
    "name": "飞行员夹克",
    "image": "/assets/garments/garment-bomber.png",
    "printArea": {
      "top": 28,
      "left": 32,
      "width": 36,
      "height": 30
    },
    "category": "外套"
  },
  {
    "id": "garment-006",
    "name": "短袖衬衫连衣裙",
    "image": "/assets/garments/garment-dress.png",
    "printArea": {
      "top": 27,
      "left": 36,
      "width": 28,
      "height": 14
    },
    "category": "连衣裙"
  }
];
