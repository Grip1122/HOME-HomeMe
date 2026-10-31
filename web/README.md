# web

前端由设计 A 在步骤 1.1 用 Vite vanilla 模板初始化。

**当前状态（1.0 整合）**：只有 `package.json` 与 `src/` 下的零依赖纯函数模块，没有 Vite 脚手架、没有 `index.html`。
`npm test` 走 Node 内置测试器（`node --test`），CI 的「前端测试」job 已经能跑起来。

```
web/
├─ package.json              # type: module，零依赖，scripts.test = node --test
├─ public/layouts/           # layout 数据（契约的唯一真值落在 contracts/）
└─ src/
   ├─ robot/                 # 设计 A：kinematics.js 四节杆/差速履带；pose-buffer.js 位姿插值
   ├─ nav/                   # AI-D（步骤 1.3）：grid.js 网格与门洞；astar.js A* + 视线拉直
   └─ scene/                 # 设计 B：scene-transform.js 高斯素材坐标与尺度标定
```

`src/nav/__fixtures__/` 是**自动生成**的参照快照，由 `python scripts/gen_nav_fixture.py` 从
`server/app/layoutlib.py` 产出；`tests/test_nav_fixture.py` 守着它不过期。
不要手改快照，改了要能说清为什么。

接 Vite 时在这个 `package.json` 上加脚本即可，不要推翻现有测试入口：

```jsonc
"scripts": {
  "test": "node --test",
  "dev": "vite",
  "build": "vite build"
}
```
