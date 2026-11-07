/**
 * pages/admin/generations —— 生成记录列表（阶段3：真实接口）
 * - 筛选：xl-chips 全部(all)/succeeded/failed → GET /api/admin/generations?status=
 * - 分页：page/pageSize=20，"加载更多"按钮追加（total 判断是否还有）
 * - 详情：点击展开半屏弹层，调 GET /api/admin/generations/:id
 *   （提示词全文 / 错误信息 / provider 名 / 结果大图）
 * - 下拉刷新重置第一页
 */
const api = require('../../../services/api.js');
const common = require('../common.js');
const assetUrl = require('../../../utils/url.js').absoluteUrl;

const PAGE_SIZE = 20;

Page({
  data: {
    filters: [
      { label: '全部', value: 'all' },
      { label: '成功', value: 'succeeded' },
      { label: '失败', value: 'failed' }
    ],
    filter: 'all',
    list: [], // [{ id,timeText,modelId,status,imageUrlFull,errorCode,prompt }]
    page: 1,
    total: 0,
    loading: false,
    loadingMore: false,
    showDetail: false,
    detailLoading: false,
    detail: null
  },

  onLoad() {
    if (!common.requireLogin()) return;
  },

  onShow() {
    if (!common.requireLogin()) return;
    this.fetchList();
  },

  onPullDownRefresh() {
    this.fetchList();
  },

  /** 重置到第一页拉取（onShow / 筛选切换 / 下拉刷新共用） */
  fetchList() {
    const that = this;
    const status = this.data.filter === 'all' ? '' : this.data.filter;
    this.setData({ loading: true, page: 1 });
    api
      .get('/api/admin/generations?status=' + status + '&page=1&pageSize=' + PAGE_SIZE)
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

  /** 追加下一页 */
  onLoadMore() {
    if (this.data.loadingMore || this.data.loading) return;
    if (this.data.list.length >= this.data.total) return;
    const that = this;
    const nextPage = this.data.page + 1;
    const status = this.data.filter === 'all' ? '' : this.data.filter;
    this.setData({ loadingMore: true });
    api
      .get('/api/admin/generations?status=' + status + '&page=' + nextPage + '&pageSize=' + PAGE_SIZE)
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

  /** 列表项补充展示字段：缩略图完整地址 + 本地时间 + 状态文案 */
  decorate(list) {
    return list.map(function (item) {
      return Object.assign({}, item, {
        imageUrlFull: assetUrl(item.imageUrl),
        timeText: common.formatTime(item.startedAt),
        statusText: common.genStatusText(item.status)
      });
    });
  },

  onFilterChange(e) {
    this.setData({ filter: e.detail.value });
    this.fetchList();
  },

  /** 点击展开详情：GET /api/admin/generations/:id（提示词全文/错误信息/provider名） */
  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    this.setData({ showDetail: true, detailLoading: true, detail: null });
    api
      .get('/api/admin/generations/' + id)
      .then(function (res) {
        that.setData({
          detailLoading: false,
          detail: Object.assign({}, res, {
            imageUrlFull: assetUrl(res.imageUrl),
            timeText: common.formatTime(res.startedAt),
            statusText: common.genStatusText(res.status)
          })
        });
      })
      .catch(function (err) {
        that.setData({ showDetail: false, detailLoading: false });
        common.onApiError(err);
      });
  },

  onDetailClose() {
    this.setData({ showDetail: false });
  }
});
