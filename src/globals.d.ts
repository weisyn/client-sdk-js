/**
 * 全局类型声明
 * 
 * 用于支持浏览器和 Node.js 环境的类型定义
 */

// Node.js 全局变量声明（仅在 Node.js 环境中存在）
// 使用条件类型确保在浏览器环境中不会报错
declare let global: typeof globalThis | undefined;
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
declare let require: NodeRequire | undefined;
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
declare let Buffer: typeof globalThis.Buffer | undefined;

// 确保这些全局变量在类型检查时可用
// 在浏览器环境中，这些变量不存在，但代码会通过运行时检查来处理

