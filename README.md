# 小觅HOME

> **虚拟孪生空间中的具身找物与空间记忆演示**

小觅HOME 是一个面向家庭空间的本地优先演示原型：用户通过自然语言让机器人“小觅”执行扫描、寻找、复核和纠错；系统在浏览器端维护可导出、可清除的空间记忆，并提供餐厅高斯溅射实景查看入口。

- **产品名称**：小觅HOME
- **机器人名称**：小觅
- **当前版本**：餐厅实景演示前端（`feat/xiaomi-home-release`）
- **核心原则**：契约优先、本地优先、演示可复现

> 本仓库名称仍为 `hometwin`，仅作为 GitHub 历史地址兼容；产品与所有用户可见文案统一使用“小觅HOME”。

## 演示能力

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| 空间扫描与三区记忆 | ✅ | 可建立、检索、导出和清除浏览器本地记忆 |
| 属性找物与执行反馈 | ✅ | 支持扫描、查找、复核及步骤可视化 |
| 记忆纠错与过期复扫 | ✅ | 演示层提供纠错和重新扫描流程 |
| 餐厅高斯溅射实景 | ✅ | 通过独立入口加载 `restaurant.splat` 实景资产 |
| 后端 `/plan → 执行 → /log` 闭环 | ✅ | 后端模块保留并通过测试；当前母版前端未直接接入产品 API |
| 餐厅语义导航与找物同屏闭环 | ⚠️ | 餐厅语义/导航数据已保留，尚待与母版找物世界整合 |
| 移动端完整适配 | ⚠️ | 当前以桌面演示为主，窄屏仅保留基础降级行为 |

## 快速开始

### 1. 后端与契约测试

```bash
git clone https://github.com/Grip1122/hometwin.git
cd hometwin
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r server\requirements.txt
.venv\Scripts\python -m pytest -q
.venv\Scripts\python scripts\check_contracts.py --base origin/main
git config core.hooksPath .githooks
```

### 2. 前端演示

```bash
cd web
npm ci
npm run dev
```

打开 `http://127.0.0.1:5173`，点击顶部立方体入口即可查看餐厅高斯溅射实景。常用验证命令：

```bash
npm test
npm run build
```

## 项目结构

```text
├─ web/                    小觅HOME 前端演示、UI、3D 交互与餐厅实景查看器
├─ server/                 本地规划、规则纠错、缓存与服务接口
├─ contracts/              跨模块事件与数据契约（唯一真值）
├─ assets/                 机器人、场景素材索引、来源与校验记录
├─ docs/                   验收、协作、分支和提交规范
├─ team/                   四人分工与任务书
├─ scripts/                契约、资源与测试辅助脚本
└─ reference/              只读参考实现，不进入产品运行路径
```

## 资源说明

| 资源 | 路径 | 交付方式 |
| --- | --- | --- |
| 餐厅高斯溅射演示模型 | `web/public/robot-find/models/restaurant.splat` | 随仓库交付，31.4 MB |
| 餐厅布局、语义与导航数据 | `web/public/layouts/`、`web/public/scene-data/` | 随仓库交付 |
| 建筑主场景高斯资产 | `assets/gaussian-splat/scene.ply` | 449 MiB，超过 GitHub 单文件上限；按素材清单获取 |
| 机器人模型与清单 | `assets/robot/` | 随仓库交付 |

餐厅模型 SHA-256：`18731c2cbdcd11a3c3ece79555fdcd4c4e916304af30a88180b17d9a67ad3b6b`。完整资源规则见 [`assets/README.md`](assets/README.md)。

## 开发约定

1. **不直推 `main`**：所有改动通过功能分支与 PR 提交。
2. **契约单独改**：`contracts/` 变更不得与业务代码混合，详情见 [`contracts/README.md`](contracts/README.md)。
3. **测试必须能失败**：新增逻辑要附带可验证的失败用例或证据。
4. **素材只存一份**：先查 [`assets/README.md`](assets/README.md)，不得为同一资源重复建目录。
5. **参考代码只读**：`reference/` 内内容不可直接并入运行路径。

分工、审核和交付流程见 [`team/README.md`](team/README.md) 与 [`docs/branch-commit-spec.md`](docs/branch-commit-spec.md)。

## 许可证与素材使用

第三方运行库的许可证保留在其对应目录；餐厅演示模型仅用于本项目内部演示，不应在未确认来源授权前拆分或二次发布。