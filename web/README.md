# web

Node.js 22.12+（CI 使用最新 22.x；锁定的 Vitest 5 不支持 Node 20）。

前端由设计 A 在步骤 1.1 用 Vite vanilla 模板初始化（PR #6），测试跑 vitest。

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
├─ public/layouts/              # 运行布局真值（contracts/ 定义结构并提供示例，示例不与运行布局逐字节绑定）
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
