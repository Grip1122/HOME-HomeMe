// 样本场景独立于 HOME 后端 layout A；换场景时必须换 sceneId，禁止混写旧坐标。
export const config = Object.freeze({
  sceneId: 'robot-find-apartment-v1',
  mode: 'local-demo',
  assetStatus: 'placeholder',
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
