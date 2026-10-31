# HOME / 小觅：实验扫描器指引

这里是交接说明，没有第二份扫描器源码。历史代码唯一位置为 `reference/hackerson/`；该目录已在 PR #9 合入。它是本团队 D 原型的只读参考，不是第三方正式产品，也不是 HOME 的生产后端。

跨平台的实验启动、Python 版本、依赖和资源缺失检查由独立“实验性原型”PR 提供 `scripts/run_reference_scanner.py` 与更新后的 `reference/hackerson/README.md`。在该 PR 合并前，不要运行历史文档中的绝对路径命令或 `scripts/service.py`。

正式 HTTP/SQLite 后端、机器人静态预览、资源下载/打包、实验扫描器四者分别审核与回滚。正式 HTTP 不依赖 reference/，删除整个参考目录仍可运行产品服务。
