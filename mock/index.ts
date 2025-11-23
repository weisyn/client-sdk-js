/**
 * Mock 包入口
 * 
 * 导出 Mock Client 和 Mock Services，供 Workbench 测试使用
 */

export { WESClientMock } from './client';
export {
  createMockResourceService,
  createMockTransactionService,
  createMockEventService,
} from './services';

// 注意：类型导出通过 TypeScript 声明文件自动生成
// 如果需要类型导出，请使用单独的 .d.ts 文件或通过主包的导出

