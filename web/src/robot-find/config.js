// 小觅HOME 的演示前端与产品后端隔离；餐厅实景资产使用独立场景标识，避免混写旧坐标。
export const config = Object.freeze({
  sceneId: 'xiaomi-home-restaurant-v1',
  mode: 'demo',
  assetStatus: 'restaurant-splat-ready',
  backendConnected: false,
  realtwin: {
    model: `${import.meta.env.BASE_URL}robot-find/models/restaurant.splat`,
    modelLabel: 'restaurant.splat · 31.4 MB',
    splatCountFallback: 976476,
    camera: { position: [0, 2.2, 9], lookAt: [0, 1.3, -2] },
    rotation: [-0.70710678, 0, 0, 0.70710678],
    position: [0.074, 0.08, 1.972],
    alphaThreshold: 5,
  },
});
