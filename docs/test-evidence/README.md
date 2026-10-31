# 前端测试与变异证据

> **判定边界**：以下证据使用与 `core/bus.js` **同签名 mock bus**，验证组件行为与事件契约一致性。
> **未与真实总线联调**，mock 通过不等于生产集成通过。

## 环境

- Node.js 22（CI 使用 Node 20，Vite 8 / Vitest 5 支持）
- `web/` 下：`npm ci && npm test`
- 测试文件与组件同目录：`web/src/ui/*.test.js`
- 测试环境：`vitest.config.js` 默认 `node`；HUD 的 5 个测试文件首行声明 `// @vitest-environment jsdom`
  （设计 A 的 `nav/robot/scene` 用 `new URL(..., import.meta.url)` 读文件，jsdom 的 URL 不认 `file:`）

## 通过证据

`green.txt`：整改后 `vitest run` 输出，**5 个测试文件 / 21 条测试全部通过**。
代传复核时全仓为 **11 个文件 / 69 条**（含设计 A 的 48 条）。

## 变红证据

`red.txt`：把 `web/src/ui/status.js` 中的

```js
typeof p.to !== "string"
this.setState(p.to);
```

故意改成错误字段：

```js
typeof p.state !== "string"
this.setState(p.state);
```

再运行 `npm test`，`status.test.js` 与 `hud.contract.test.js` 失败，出现：

- `reads robot:state.to for idle / walking / celebrating / error`
- `uses only contract fields in the status path`
- 期望「前往中」，实际「状态未知」

随后恢复 `p.to`，`green.txt` 重新 21/21 通过。

## 覆盖

| 文件 | 覆盖 |
|---|---|
| `status.test.js` | `to` 字段、四种状态、失败进度、缺失 `ok`、异常 step |
| `timeline.test.js` | 成功/失败/缺字段步骤、失败任务摘要 |
| `compare.test.js` | 空数据、真实 pair、部分数据、缺 duration |
| `interaction.test.js` | `plan:request`、`task:say`、单飞锁、memory hit/miss |
| `hud.contract.test.js` | 动态读取 `contracts/events.md`，所有 HUD 事件名必须在契约内 |

## 命令

```bash
cd web
npm ci
npm test
```
