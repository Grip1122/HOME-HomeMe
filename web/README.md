# web

前端由设计 A 在步骤 1.1 用 Vite vanilla 模板初始化（PR #6），测试跑 vitest。

## 2026-10-31 前端母版：robot-find

按 Jesu 指定，以 robot-find 的完整界面、功能和交互为整体前端样本，首页不再显示旋转立方体。原有 core/robot/nav/scene/ui、server 与 contracts 保持不动。

- `index.html`：原样本 DOM；`src/main.js`：按顺序装配本地依赖与样本模块。
- `src/robot-find/`：隔离移植的样本代码与回归测试；保留原有深色界面、自由旋转、三区扫描、属性找物、记忆过期复扫、纠正、三视图及加密包。
- `src/robot-find/config.js`：场景版本、模型 URL 与变换。当前 `mode=local-demo`，**未接 HOME 后端**，不得把中文房间/演示坐标写进后端 layout A。
- `RF.createWorld(canvas)` / `RF.createRobot({THREE,world})` 为正式素材适配入口。机器人须提供 group、setState、update、headYawTarget；场景须保留 World 的语义物体/导航/扫描/渲染接口。只改实景查看器 URL 不等于替换找物场景；正式资产需要坐标、碰撞和语义标定。
- 场景和机器人目前为**待替换示范素材**。餐厅入口保留，模型放 `public/robot-find/models/restaurant.splat`（31,358,432 bytes）；模型已忽略，不进入 Git。缺文件时餐厅页显示错误并允许返回，示范公寓不受影响。
- 采用样本随附 Three r160 与 Gaussian Splats 3D 0.4.7（MIT），仅此页面使用；不降级/混用项目 npm Three r187。许可证与来源见 `public/robot-find/vendor/`。
- 本地包按 sceneId 隔离；SD 卡实际由浏览器 localStorage 模拟，密钥也在同一 origin，不代表硬件安全。配额失败显示仅会话存储，导出不回退明文。XOR 回退仅用于演示。
- 修正样本的不可达直线穿墙、先去真实新位置再报旧位置扑空、失败复核被抹绿、SD 假保存；动作计数来自实际执行（go/scan/verify/found），不再写死 3/6 步。调试入口新增 `window.__demo.getActions()`。
- 本轮为桌面样本迁移；原样本 ≤1080px 隐藏侧栏的行为保留，不能宣称移动端完整适配。
- 餐厅素材随包声明仅项目内部使用；正式素材另行确认授权，未公开发布/上传模型。

原有开发命令保持不变：

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
