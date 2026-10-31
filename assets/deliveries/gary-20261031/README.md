# Gary 两份交付归档（2026-10-31）

交付人 Gary；由 sen 按用户指示上传。HUD 更新现有 PR #7，独立实景原型只归档，不接入 A/B 正式执行路径。

## 完整原始包

下载入口：[gary-delivery-20261031 Release](https://github.com/Grip1122/HOME-HomeMe/releases/tag/gary-delivery-20261031)。两个 ZIP 保留收到的全部文件及原始字节，已检查 ZIP CRC 并逐文件解压回读 SHA256；清单详见本目录两个 manifest.json。

| 包 | 文件数 | ZIP 字节数 | SHA256 |
| --- | ---: | ---: | --- |
| gary-hud-pr7-20261031.zip | 33 | 2318156 | 177221360a0a35661fb269ed05616cf5dab2d2566700732c4d3804a38798c9d7 |
| gary-robot-find-20261031.zip | 38 | 41724119 | 007607b3e1a44c1184c2aea8709bbf8bc2451bdfb14430a83cf4e3b079459660 |

独立原型包含 49,779,968 字节的 scene.splat；大文件通过 Release 分发，不进入普通 Git。其 scene.meta.json 记载原始旧建筑 1,996,390 点，转换后 1,555,624 splats；不能作为餐厅 999,131 点的性能、坐标或正交验收证据。

## HUD 合入范围

PR #7 增量提交：`92513c0088319239004aae78fef6886b6c886c64`。

- status.js 订阅 plan:corrected，并显示“规则/纠错”来源。
- status.test.js 加入纠错标签、连续移动事件无 UI 副作用两项；保留按文件声明的 jsdom。
- copy.js 新增 corrective 来源文案，同时保留 Jesu 已修正的 found 中文文案。
- 原包其他组件与现有 PR 大多相同。没有用原包的全局 jsdom 配置覆盖已修复的默认 node 配置；没有撤回现有截图命名、宽度比例和 mock bus 验收边界说明。
- 包内 contracts/events.md 与 PR #7 相同，仅作为原包归档保存，冻结契约未覆盖、未改动。package.json 与 lock 也与 PR #7 相同，没有增加项目依赖。

## 验证口径

Gary 原包自带 green/red 日志，声明 5 个 HUD 测试文件、23 条通过；这些原始记录保存在 HUD ZIP 内。

本次独立运行 Chrome headless 的局部检查，见 [hud-browser-check.json](hud-browser-check.json)：纠错标签正确、100 次 robot:moved 保持 HUD 状态/进度/来源/时间线不变、walking 文案正确、失败步骤可见、found 中文文案保留、页面错误 0。这里使用同签名 mock bus，不构成 A+B+C 的生产集成验收；本机没有重跑完整 Vitest/build，全仓结果以 PR 的新 CI 和 owner 复核为准。

实景原型按原样归档，README 中的功能、尺寸、帧率、识别效果和许可表述属于原交付说明，本次未逐项重新验收；其后端、导航和场景实现没有覆盖正式项目。
