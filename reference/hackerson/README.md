# HOME / 小觅：历史扫描器参考

`hackerson` 是 D 早期独立原型的历史目录名，不是正式产品名。正式项目为 **HOME / 小觅**；产品的 HTTP、业务布局与前端状态机均不依赖这里的代码。原型使用 MuJoCo、独立 NBV 和 PlayCanvas，不能把旧餐厅截图、覆盖率、吞吐数字当成正式项目验收。

## 代码归属

- 本团队 D 的原型代码：`run.py`、`scanner/`、`web/`、建模脚本。
- 第三方代码：`web/vendor/playcanvas.mjs` 与同目录 MIT 许可。
- 上游研究 README 快照：`research/upstream/`，不是已集成依赖。
- 机器人正式资产唯一位置：项目根 `assets/robot/`（PR #9 已合入）。参考目录不再复制模型或高斯场景。
- 旧餐厅资产不随当前交付。归档中的 RESTAURANT/VALIDATION/RUN_WINDOWS 等历史文档保留原始记录，**不作为当前启动说明**。

## Windows 启动（可选实验环境）

Python 3.11+，以下均在项目根目录执行，不使用服务器绝对路径，也不运行 Linux service.py。

```powershell
py -3.11 -m venv .venv-scanner
.\.venv-scanner\Scripts\python.exe -m pip install -r reference/hackerson/requirements.txt
.\.venv-scanner\Scripts\python.exe scripts/run_reference_scanner.py --check-only
.\.venv-scanner\Scripts\python.exe scripts/run_reference_scanner.py --port 8765
```

Windows 使用 GLFW，需可用桌面 OpenGL 驱动；`--gpu` 不强行指定 Windows 浏览器或系统图形适配器。浏览器访问 http://127.0.0.1:8765 ，Ctrl+C 停止。依赖仅安装在 `.venv-scanner`，不会加入正式服务 requirements。

## Linux 服务器 / Windows 浏览器

```sh
python3 -m venv .venv-scanner
.venv-scanner/bin/python -m pip install -r reference/hackerson/requirements.txt
.venv-scanner/bin/python scripts/run_reference_scanner.py --gpu 1 --port 8765
```

Linux 默认 EGL，`--gpu 1` 设置 MUJOCO_EGL_DEVICE_ID=1；应通过 nvidia-smi 核对实际设备。Windows 转发：`ssh -N -L 8765:127.0.0.1:8765 <服务器用户>@<服务器地址>`，保持窗口打开后访问本地同一端口。

## 运行与资源边界

启动器先检查依赖、参考源码、正式 GLB/manifest/OBJ。缺失时明确报 missing_optional_dependencies 或 missing_reference_resources，并以非零码退出，不会返回虚假运行成功。启动器将参考代码与机器人复制到 `.local/reference-runtime/` 后运行；日志和结果都写运行副本，保留 reference/ 只读。可用 --runtime 指向另一个空闲目录。不要与已有服务共用端口。

入口显式使用 **demo 实验几何**，不加载缺失餐厅、不伪造队友高斯场景或正式导航标定。当前服务器 Hackerson 原型切队友场景/GPU1 的本地运行属于另一份实验产物；它未被这一文档 PR 冒充为正式产品集成。

完整原型备份与校验表见 [团队 D 归档 Release](https://github.com/Grip1122/HOME-HomeMe/releases/tag/d-roomscan-source-20261031)。里面保留历史路径和依赖用于追溯，排除旧餐厅 ZIP 及所有旧餐厅场景数据；不是一键产品安装包。
