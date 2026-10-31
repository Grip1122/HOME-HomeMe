# HOME / 小觅：资源获取与归档

正式项目名为 **HOME / 小觅**。`Hackerson` 仅是历史 D 原型目录和归档内路径，不是正式项目名称。

团队场景介绍：**基于开源素材进行优化**。原始页面：[Milano Living — argenzio](https://superspl.at/scene/0131a3b9)。2026-10-31 实际检查页面 license 链接，明确标为 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)；必须保留作者、来源和许可链接、注明修改，只按非商业使用范围交付。不能简写成无限制“开源”，不能把 PlayCanvas 的 MIT 套用到场景。

来源由 D 提供，页面的 1,996,390 个高斯与团队 PLY header 一致；原始 PLY 下载需要登录，目前没有独立验证两份原始下载文件的逐字节一致性，因此清单显式保留这一限制。团队 Release 的 SHA 和字节数已实际核对：471149518 字节，SHA-256 `901cf8ce0be73706d6ab0f2649e4f7520def2ee4342a30bca984b55ce2678fae`。获取日期 2026-10-31。单位未标定、朝上轴未验证、正式渲染器未决，均保留为正式场景验收限制。

下载要求清单包含已验证许可证名称/链接和分发许可，否则报 `team_scene_license_unverified`。当前只提供非商业研究/演示使用，商业部署需另行确认授权。安装仍只允许固定团队 Release 来源，完整下载后核对字节数与 SHA-256，再原子安装。断网、内容损坏或错误大小不会留下半成品，已有损坏文件不会被静默覆盖。

Python 3.11+，从项目根目录运行；下载/打包脚本仅使用标准库，Windows PowerShell、cmd 与 Linux 都使用相同 `python` 命令。

```text
python scripts/fetch_team_scene.py --output assets/gaussian-splat/scene.ply
python scripts/pack_roomscan.py --source ../Hackerson --output ../home-delivery/source.tar.gz
```

打包命令是历史原型备份工具，源目录必须由调用者提供，输出必须在源目录之外。明确排除旧餐厅 ZIP、解压/转换资产和对应实验结果；其余隐藏文件、依赖与许可证按逐文件清单保留。不要将个人凭据放入待归档目录。既有完整归档及逐文件校验表见 [团队 D 归档 Release](https://github.com/Grip1122/HOME-HomeMe/releases/tag/d-roomscan-source-20261031)，不再将 47,334 行清单或依赖副本复制进 Git。

资源校验回归：`python -m pytest tests/test_scene_delivery.py tests/test_delivery_archive.py`，不联网、不下载真实大资产。真实原始文件的字节同一性、标定和商业用途授权仍待确认；合成测试夹具独立于这些验收事项。
