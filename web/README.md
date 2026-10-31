# web

前端由设计 A 在步骤 1.0 用 Vite vanilla 模板初始化。

## 运行环境（唯一支持组合）

| 项 | 版本 | 声明位置 |
|---|---|---|
| Node.js | **24.x**（不支持 20 / 22 / 23 / 25） | `package.json` 的 `engines.node: ^24.0.0`、`.nvmrc` |
| npm | 11.x 及以上（Node 24 自带） | `engines.npm` |
| Vite | 8.3.5 | `package-lock.json` |
| Vitest | 5.0.5 | `package-lock.json` |
| Three.js | 0.187.0 | `package-lock.json` |
| @tweenjs/tween.js / lil-gui / pathfinding | 25.0.0 / 0.21.0 / 0.4.18 | `package-lock.json` |

为什么锁 24：Vitest 5 声明的 Node 范围是 `^22.12.0 || ^24.0.0 || >=26.0.0`，Vite 8 是 `^20.19.0 || >=22.12.0`。
两者交集不含 20，也不含奇数版 23、25。团队统一用 24 一个主版本，CI 读同一个 `.nvmrc`。
`.npmrc` 打开了 `engine-strict=true`：在不受支持的 Node 上 `npm ci` 会直接报错退出。

## 常用命令

```bash
cd web
npm ci          # 按 lock 文件安装，不改版本
npm test        # Vitest 单元测试
npm run build   # 生产构建到 dist/
npm run dev     # 本地开发 http://127.0.0.1:5173，/api 代理到 8000
```

## 已知提示（不阻断）

- **`THREE.Clock` 弃用**：three r183 起 `Clock` 会在控制台提示 `Please use THREE.Timer instead`，功能不受影响。
  目前只有 `src/main.js` 的旋转立方体在用。后续接入机器人主循环时改用 `THREE.Timer`（每帧 `timer.update()` 后取 `timer.getDelta()`）。
- **构建包体约 527 kB** 的 chunk 告警：three 整包打入，阶段 1 不处理。
