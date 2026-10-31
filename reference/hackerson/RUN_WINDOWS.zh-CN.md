# 在 Windows 查看服务器仿真

## 服务器端

```bash
cd /home/xch/data/cww/Hackerson
python3 scripts/service.py start
python3 scripts/service.py status
```

服务默认绑定 `127.0.0.1:8765`。渲染和规划都在服务器完成，不需要 Windows 安装 MuJoCo、ROS 或 CUDA。日志为 `artifacts/server.log`。

## Windows 端

你提供的 SSH 目标为 `xch@10.200.238.100`。打开 Windows PowerShell，执行：

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 8765:127.0.0.1:8765 xch@10.200.238.100
```

按平时方式完成 SSH 验证，保持窗口连接，再打开 **http://localhost:8765**。`-N` 表示只建立转发，不进入远程 shell；窗口不出现命令提示符属于正常情况。

如果平时还需要指定端口、密钥或跳板机，保留原有选项。通用写法为：

```powershell
ssh -L 8765:127.0.0.1:8765 用户名@服务器地址
```

`用户名@服务器地址` 是占位符，要替换成现有的 SSH 目标。例如原来使用 `ssh my-gpu`，现在使用：

```powershell
ssh -L 8765:127.0.0.1:8765 my-gpu
```

保持这个窗口连接，浏览器打开：

**http://localhost:8765**

如果 Windows 的 8765 端口被占用，可以只换本地端口：

```powershell
ssh -L 8877:127.0.0.1:8765 my-gpu
```

然后访问 `http://localhost:8877`。使用 VS Code Remote SSH 时，也可在 Ports 面板转发服务器的 8765 端口，打开该面板提供的本地地址。

## 演示操作

默认加载“天安骏业集团餐厅”。顶部可切换“原演示房间”；切换会重置当前任务。餐厅页面有三个视图：“餐厅原景”显示真实高斯资产与机器人，“几何代理”显示服务器实际用于深度扫描的近似几何，“重建点云”显示相机采集结果。原景首次下载约 11.3 MiB，需要浏览器支持 WebGL 2；如加载失败可以使用几何代理视图。

在餐厅原景中拖动旋转、滚轮缩放，Shift 拖动平移；可选择“跟随机器人”或“全景俯看”。图像高处已作剖切，完整原始资产仍保存在服务器。作者 Hilo，来源 SuperSplat，CC BY 4.0。

1. 等待右上角显示“服务器已连接”，仿真场景出现。
2. 点击“开始扫描”。底盘会先收杆、转向、避障移动，再调整杆高和相机俯仰进行采集。
3. 查看四路环视图、轨迹、下一扫描视角和覆盖率曲线。3× 是仿真步长倍率，不代表实时帧率。
4. 点击“重建点云”，拖动旋转，滚轮缩放。这里显示的是相机实际深度生成的观测点。
5. 可暂停、继续或重置。切换固定高度基线需要先结束/重置或暂停后重置，再选择策略。
6. 点击“保存结果”，随后下载 `.ply` 点云、`.json` 记录或 `.npz` 体素地图。任务自动结束也会保存结果。

默认最多执行 48 次扫描；也可因收益变低、连续新增信息较少或候选耗尽而结束。结束提示会显示具体原因，达到次数预算不等于覆盖率必然达到 100%。

## 重启与离线评估

```bash
python3 scripts/service.py stop
python3 scripts/service.py start
```

需要改端口、扫描预算等参数，可停掉后台服务后前台启动：

```bash
python3 run.py --port 8765 --max-scans 48 --speed 3
```

离线快速跑完整任务，不需要浏览器：

```bash
python3 run.py --benchmark --max-scans 48
```

输出位置在终端最后的 `export` 字段。任务画面与结果保存在项目的 `artifacts/runs/`。

## 连接问题

- 页面打不开：先检查服务器进程，再检查 SSH 转发窗口是否仍连接。
- 页面提示连接中断：运行 `python3 scripts/service.py status` 并查看 `artifacts/server.log`。
- 不要在 Windows 直接访问服务器的 `127.0.0.1`；先建立端口转发。SSH 别名、跳板机或非标准端口可沿用原连接设置。
- 此次已在服务器本机的真实 Chromium 浏览器验证界面和操作，尚未从你的 Windows 网络环境实际连接。
