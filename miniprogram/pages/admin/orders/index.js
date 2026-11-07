/**
 * pages/admin/orders —— 订单列表（阶段3：真实接口）
 * - 筛选 chips：全部/pending/confirming/completed + 关键词搜索（匹配订单号/姓名）
 * - GET /api/admin/orders?status=&keyword=&page=&pageSize=20，"加载更多"分页
 * - 点击进 order-detail（query id）；下拉刷新；从详情页返回 onShow 自动刷新
 */
const api = require('../../../services/api.js');
const common = require('../common.js');

const PAGE_SIZE = 20;

Page({
  data: {
    filters: [
      { label: '全部', value: 'all' },
      { label: '待处理', value: 'pending' },
      { label: '设计确认', value: 'confirming' },
      { label: '已完成', value: 'completed' }
    ],
    filter: 'all',
    keyword: '',
    list: [], // [{ id,orderNo,customerName,contact,garmentTemplateId,garmentName,size,quantity,status,timeText }]
    page: 1,
    total: 0,
    loading: false,
    loadingMore: false,
    statusText: common.ORDER_STATUS_TEXT,
    statusTagClass: common.ORDER_STATUS_TAG
  },

  onLoad() {
    if (!common.requireLogin()) return;
  },

  onShow() {
    // 初次进入与从详情页返回（状态可能已流转）均刷新
    if (!common.requireLogin()) return;
    this.fetchList();
  },

  onPullDownRefresh() {
    this.fetchList();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  /** 触发搜索（按钮 / 键盘 confirm） */
  onSearch() {
    this.fetchList();
  },

  /** 重置第一页拉取（keyword 匹配订单号/姓名，服务端 LIKE 查询） */
  fetchList() {
    const that = this;
    const status = this.data.filter === 'all' ? '' : this.data.filter;
    const keyword = (this.data.keyword || '').trim();
    this.setData({ loading: true, page: 1 });
    api
      .get(
        '/api/admin/orders?status=' + status +
        '&keyword=' + encodeURIComponent(keyword) +
        '&page=1&pageSize=' + PAGE_SIZE
      )
      .then(function (res) {
        that.setData({
          list: that.decorate((res && res.list) || []),
          total: (res && res.total) || 0,
          loading: false
        });
        wx.stopPullDownRefresh();
      })
      .catch(function (err) {
        that.setData({ loading: false });
        wx.stopPullDownRefresh();
        common.onApiError(err);
      });
  },

  onLoadMore() {
    if (this.data.loadingMore || this.data.loading) return;
    if (this.data.list.length >= this.data.total) return;
    const that = this;
    const nextPage = this.data.page + 1;
    const status = this.data.filter === 'all' ? '' : this.data.filter;
    const keyword = (this.data.keyword || '').trim();
    this.setData({ loadingMore: true });
    api
      .get(
        '/api/admin/orders?status=' + status +
        '&keyword=' + encodeURIComponent(keyword) +
        '&page=' + nextPage + '&pageSize=' + PAGE_SIZE
      )
      .then(function (res) {
        that.setData({
          list: that.data.list.concat(that.decorate((res && res.list) || [])),
          page: nextPage,
          total: (res && res.total) || 0,
          loadingMore: false
        });
      })
      .catch(function (err) {
        that.setData({ loadingMore: false });
        common.onApiError(err);
      });
  },

  /** 补充展示字段：款式名（本地 JSON 映射）+ 本地时间 */
  decorate(list) {
    return list.map(function (item) {
      return Object.assign({}, item, {
        garmentName: common.garmentName(item.garmentTemplateId),
        timeText: common.formatTime(item.createdAt)
      });
    });
  },

  onFilterChange(e) {
    this.setData({ filter: e.detail.value });
    this.fetchList();
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/order-detail/index?id=' + id });
  }
});
