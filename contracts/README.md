# 契约目录 · 唯一真值

这个目录是四人并行的前提。**改这里等于改所有人的地基**，所以流程比业务代码严一档。

## 文件说明

| 文件 | 内容 | 谁能起草 |
|---|---|---|
| `layout.schema.json` | 场景数据格式（房间、门洞、家具、物体、污渍） | 设计 B |
| `layout.example.json` | 布局 A 的完整实例，前端加载、后端校验、测试共用 | 设计 B |
| `plan.schema.json` | `POST /plan` 请求与响应，含 `corrective` 来源约定 | AI-D |
| `memory.schema.json` | 一条空间记忆记录 | AI-D |
| `captions.schema.json` | 固化台词表结构（五句核心台词） | 设计 C |
| `events.md` | 事件名与载荷（EventBus 契约） | 设计 A |
| `contracts.lock.json` | 上述文件的 SHA-256 指纹，由脚本生成，**不要手改** | 脚本 |
| `CHANGELOG.md` | 每次契约变更一行，写清“谁、为什么、影响谁” | 提议人 |

## 改契约的唯一流程

```bash
# 1. 从干净的主干开分支，分支名固定前缀
git switch main && git pull
git switch -c contract/<你要改什么>

# 2. 只改 contracts/ 下的文件（不要顺手改业务代码）
#    - Schema 改动：同步改 layout.example.json，跑检查
python scripts/check_layout.py
python -m pytest tests/test_contracts.py

# 3. 刷指纹
python scripts/check_contracts.py --update-lock

# 4. 在 CHANGELOG.md 追加一行
# 5. 提交（只含 contracts/）
git add contracts/ && git commit -m "contract(layout): 增加 doors[].width 最小 1.0 校验"

# 6. 开 PR，标题前缀 [CONTRACT]，必须 @ 受影响模块的 owner 确认
```

## 三条红线

1. **不得混提交。** `scripts/check_contracts.py` 会拦截“同时改契约和业务代码”的提交；CI 二次校验。
2. **不得手改 lock。** lock 与磁盘不一致时闸门直接失败——这意味着有人改了契约没刷指纹，或直接动了 lock。
3. **不得改字段含义只改注释。** 语义变更必须同时更新 `CHANGELOG.md` 与受影响的测试；否则下一个人会在联调时才发现。

## 兼容性原则

演示窗口只有 26 小时，契约变更一律**只增不删**：

- 新增字段必须可选（Schema 里不进 `required`），并给默认值。
- 不重命名既有字段；要改名就新增一个，旧字段标记 `deprecated` 并在 CHANGELOG 写明删除时间。
- 枚举只加值，不减值。前端遇到未知枚举值必须降级到“未识别”，不能崩溃。
