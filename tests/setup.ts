/**
 * Jest 测试环境设置
 */

// 设置测试超时时间
jest.setTimeout(10000);

// Mock 全局变量（如果需要）
global.console = {
  ...console,
  // 在测试中静默某些日志
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

