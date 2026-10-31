# HOME / 小觅：D 的门禁与布局契约边界

## 当前服务端门禁状态（2026-10-31）

仓库公开；当前上传账号只有 push 权限，没有 admin/maintain 权限。main 的保护接口返回 404，仓库 rulesets 为空，不能声称已经启用服务端保护。保留公开属性与当前方案，不擅自转私有或升级付费。管理员 Jesu 应核对分支保护可用性，能启用时要求 PR、独立审核与四项 CI；无法启用时继续人工门禁：作者不自审、不直推 main，Jesu 审核 D 的 PR，CI 全绿后由非作者 squash merge。CODEOWNERS 与本地钩子不等同于服务端强制保护。

## 布局更新边界

`contracts/layout.schema.json` 定义结构；`contracts/layout.example.json` 是合法用例，不是运行真值。运行布局的唯一源是 B 管理的 `web/public/layouts/*.json`，其版本独立递增并经过 Schema、静态布局与寻路快照检查。契约示例更新只提交 contracts/ 和自动刷新的 lock；无需复制到 layout_A。业务布局改动另开 PR，运行 `python scripts/gen_nav_fixture.py` 更新派生导航快照。Schema 发生不兼容更新时，应先设计向后兼容/分阶段迁移，不绕过契约门禁混合提交。

Node 环境由 Jesu / PR #10 维护，D 不修改 web/ 或 Node 配置。本次修复从 main 50ea547 重新提取，仅改变标题传递、Git 错误处理和布局验证；不要求提前引入 web/.nvmrc。职责以已合并的 team/03-demo-coordination.md 为准。本 PR 仍需等待 #10 并由 Jesu 独立审核。
