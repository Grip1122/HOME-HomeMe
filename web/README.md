# web

前端由设计 A 在步骤 1.0 用 Vite vanilla 模板初始化（PR #6），测试跑 vitest。

```bash
npm ci
npm run dev      # http://127.0.0.1:5173，/api 代理到 8000
npm test         # vitest run
npm run build    # 产物在 dist/，已被 .gitignore 排除
```

```
web/
├─ index.html · vite.config.js · .env.example
├─ package.json                 # three / tween.js / lil-gui / pathfinding；vite / vitest
├─ public/layouts/              # layout 数据（契约的真值在 contracts/）
└─ src/
   ├─ main.js · core/           # 设计 A：脚手架、旋转立方体与 4 条测试
   ├─ robot/                    # 设计 A：kinematics.js 四节杆/差速履带；pose-buffer.js 位姿插值
   ├─ nav/                      # AI-D（步骤 1.3）：grid.js 网格与门洞；astar.js A* + 视线拉直
   └─ scene/                    # 设计 B：scene-transform.js 高斯素材坐标与尺度标定
```

**测试约定**：所有 `src/**/*.test.js` 由 vitest 收集（`vite.config.js` 的 `test.include`）。
新模块直接用 `import { test } from 'vitest'`，断言可以继续用 `node:assert/strict`——
现有 48 条测试就是这么写的，不需要为了断言再引一个 expect 生态。

`src/nav/__fixtures__/` 是**自动生成**的参照快照，由 `python scripts/gen_nav_fixture.py`
从 `server/app/layoutlib.py` 产出；`tests/test_nav_fixture.py` 守着它不过期。
不要手改快照，改了要能说清为什么。

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

## 已知提示（不阻断）

- **`THREE.Clock` 弃用**：three r183 起 `Clock` 会在控制台提示 `Please use THREE.Timer instead`，功能不受影响。
  目前只有 `src/main.js` 的旋转立方体在用。后续接入机器人主循环时改用 `THREE.Timer`（每帧 `timer.update()` 后取 `timer.getDelta()`）。
- **构建包体约 527 kB** 的 chunk 告警：three 整包打入，阶段 1 不处理。
