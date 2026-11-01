# 小觅HOME

> **面向家庭空间的虚拟孪生找物与机器人任务演示**

小觅HOME 是一个可在本机直接运行的交互原型。用户用自然语言向机器人“小觅”下达任务；系统根据餐厅布局规划动作、在虚拟场景中执行，并记录任务日志。程序同时提供空间记忆体验与餐厅高斯溅射实景浏览。

- **产品名称**：小觅HOME
- **机器人名称**：小觅
- **默认入口**：餐厅任务程序（规划 → 执行 → 日志）
- **运行方式**：本地浏览器，无需云端密钥

## 直接使用

Windows 下在仓库根目录运行：

```powershell
py -3.11 scripts/start_xiaomi_home.py
```

首次启动会在项目内创建 `.venv`、安装缺失依赖、构建前端，然后自动打开 `http://127.0.0.1:8000`。后续启动仍使用同一条命令。

打开后可以直接输入：

```text
帮我把红色水杯放到3号桌上
```

首页直接加载真实 `restaurant.splat` 餐厅，并使用交付的 `robot.fbx` 转换出的轻量 `robot.glb` 模型。原始 FBX 随仓库保留。页面会展示规划后的动作、机器人执行状态和日志保存结果；右上角“空间记忆体验”可进入母版交互界面。

## VR 公网体验

可直接在浏览器打开餐厅 VR 展示：

- **体验链接**：https://time-continued-replacement-trigger.trycloudflare.com/vr
- **访问密码**：`CF4qyMOxTVRlLTRzuf4fYplZPhXVHNxKqMsp1XDZNWM`

该链接通过临时公网隧道提供，地址或访问状态可能随本地服务和隧道重启而变化；用于演示体验，不替代仓库内的本地一键启动方式。

## 当前能力

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 餐厅自然语言任务 | ✅ | 本地 `/plan → 执行 → /log` 闭环，失败与取消均有状态反馈 |
| 机器人执行与任务日志 | ✅ | 使用餐厅布局和语义数据，任务结果写入本地 SQLite |
| 空间记忆体验 | ✅ | 支持扫描、检索、纠错、导出与清除浏览器本地记忆 |
| 餐厅高斯溅射实景 | ✅ | 程序内入口加载 `restaurant.splat`，支持旋转、缩放、平移 |
| 真实餐厅与机器人主视觉 | ✅ | 首页加载 `restaurant.splat` 与 `robot.fbx`，保留任务逻辑层 |
| 移动端完整适配 | ⚠️ | 当前以桌面现场演示为主，窄屏提供基础显示 |

## 运行与验证

### 一键启动

```powershell
py -3.11 scripts/start_xiaomi_home.py
```

可选参数：

```powershell
py -3.11 scripts/start_xiaomi_home.py --port 8000 --skip-install
```

### 开发模式

终端一启动后端：

```powershell
.venv\Scripts\python scripts\run_home.py --port 8000
```

终端二启动 Vite：

```powershell
cd web
npm ci
npm run dev
```

开发页为 `http://127.0.0.1:5173`，会将 `/api` 转发至 8000 端口。

### 自动检查

```powershell
.venv\Scripts\python -m pytest -q
.venv\Scripts\python scripts\check_contracts.py --base origin/main
cd web
npm test
npm run build
```

## 项目结构

```text
├─ web/                    用户界面、机器人执行可视化、空间记忆和实景查看器
├─ server/                 本地规划、规则纠错、记忆与日志 HTTP 服务
├─ contracts/              跨模块数据契约
├─ assets/                 机器人和场景素材索引、来源与校验记录
├─ scripts/                启动器、契约和资源验证脚本
├─ docs/                   验收与协作资料
└─ reference/              只读参考实现，不进入默认运行路径
```

## 资源说明

| 资源 | 路径 | 交付方式 |
| --- | --- | --- |
| 餐厅高斯溅射模型 | `web/public/robot-find/models/restaurant.splat` | 随仓库交付，31.4 MB |
| 餐厅布局、语义与导航数据 | `web/public/layouts/`、`web/public/scene-data/` | 随仓库交付 |
| 建筑主场景高斯资产 | `assets/gaussian-splat/scene.ply` | 449 MiB，按素材清单获取 |
| 首页机器人模型 | 原始 `assets/robot/robot.fbx`；网页 `web/public/models/robot.glb` | 随仓库交付，62.3 MB / 21.9 MB |
| 机器人模型与清单 | `assets/robot/` | 随仓库交付 |

餐厅模型 SHA-256：`18731c2cbdcd11a3c3ece79555fdcd4c4e916304af30a88180b17d9a67ad3b6b`。完整素材边界见 [assets/README.md](assets/README.md)。

## 开发约定

1. 不直推 `main`，通过功能分支与 PR 提交。
2. `contracts/` 是接口真值，契约变更单独提交与审查。
3. 素材不重复存放；先查 [assets/README.md](assets/README.md)。
4. `reference/` 为只读参考，不直接纳入产品入口。

第三方运行库许可证保留在对应目录。餐厅模型仅限本项目内部演示，未确认授权前不得拆分或二次发布。
