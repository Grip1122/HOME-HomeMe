# sen 场景素材交付

- 日期：2026-10-31
- 工作：步骤0.1素材验证；为1.1场景集成提供输入。
- 选择：原版餐厅scene.ply（db3ff012934704ba8787f82464bdc7b1db21760281189274626914a2800efb28）。
- 内容：README、manifest、SHA256、许可、4张截图、验证JSON和选型决定。
- 性能：原版初始拖动约18 FPS；SH1/0合并22–27；80万点收益不明显；50万点约28且破洞。sen决定保留画质、取消本素材30 FPS硬门槛，路演机复测。
- 原始PLY已完成Release上传和远端大小/摘要核对。
- 待完成：数值标定附件、项目正交相机/遮挡/layout对齐。未宣称完整场景或里程碑验收完成。
- 变更范围：仅assets/gaussian-splat/，不修改代码、contracts、正式layout或其他人的模块。
- 校验：JSON语法、源文件SHA256、截图PNG尺寸/指纹及清单引用；不涉及业务逻辑、异步队列或状态机，未编造代码变异测试结果。

- 原版下载：https://github.com/Grip1122/HOME-HomeMe/releases/download/splat-restaurant-v1/scene.ply
- Release原版已上传；本次11个代码目录交付文件仍待提交分支/PR。
