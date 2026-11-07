/**
 * xl-status-dot —— 状态点
 * type: success(绿) / failed(红) / pending(灰) / running(金·脉动)
 * label: 可选状态文字
 */
Component({
  properties: {
    type: { type: String, value: 'pending' },
    label: { type: String, value: '' }
  }
});
