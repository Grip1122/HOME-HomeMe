import { defineConfig } from "vitest/config";

// 默认 node 环境：`src/nav`、`src/robot`、`src/scene` 的测试用 `new URL(..., import.meta.url)`
// 读取 layout / manifest，jsdom 的 URL 实现不认 file: 协议会直接报错。
// HUD 组件需要 DOM 的文件在各自首行用 `// @vitest-environment jsdom` 单独声明。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    restoreMocks: true,
  },
});
