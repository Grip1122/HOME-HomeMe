# robot.fbx 转换与加载器源码

在此目录执行 `npm install`，然后 `npm run bundle` 重建主项目 `web/public/robot-find/vendor/robot-model.js`。Three 固定 r160，与主项目现有全局 Three 一致，构建时映射到 window.THREE，不引入第二套实例。

转换（参数需引用实际文件）：

`node --max-old-space-size=8192 convert-fbx.mjs <robot.fbx> <包含 vizcom_texture_12.png 和 vizcom_texture_11.png 的目录> <输出目录>`

输出 robot-web.glb 和 conversion.json。原始文件及贴图见 [Release](https://github.com/Grip1122/HOME-HomeMe/releases/tag/robot-fbx-v1)。先使用 source-inspection.json 确认单 Mesh 前提；脚本遇到多个网格会拒绝，避免漏掉部分。合并重复顶点后按法线/UV 权重简化为 120000 三角面，平移到水平中心及脚底 Y=0，并将 FBX flipY=true 的 UV 转为 glTF 约定。贴图为原始 PNG，颜色因子改为白色、roughness=.7/metallic=0；这些为网页显示参数。转换未创建骨架或动画。

运行时配置在主项目 main.js 的 RF.robotModelConfig；原型使用同一加载器默认路径 assets/models/robot-web.glb。height=1.2、yaw=-π/2 为显示配置。

执行 `npm test` 可运行两条模型检查；测试使用实际 GLB 与本地临时 HTTP 服务。Node 中图片解码用桩，只验证资源封装和工厂行为；实际贴图视觉已用浏览器验证，见交付截图。
