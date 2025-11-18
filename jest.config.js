module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    // TypeScript 文件使用 ts-jest
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
      },
    }],
    // ESM JavaScript 文件也需要转换（使用 babel-jest）
    // Jest 使用绝对路径进行匹配，需要匹配完整的文件路径
    // 注意：Jest 的 transform 配置会按照顺序匹配，第一个匹配的会被使用
    // 匹配 @noble 和 js-sha3 的 ESM 模块（包括 pnpm 路径格式）
    '.*node_modules.*(@noble|js-sha3).*\\.(js|mjs)$': 'babel-jest',
    // 匹配所有 JS/MJS 文件（包括 node_modules 中的）
    '^.+\\.(js|mjs)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // 不忽略 @noble/secp256k1 和 js-sha3 模块，让 Jest 转换它们
  // 注意：为了确保 ESM 模块被正确转换，暂时不设置 transformIgnorePatterns
  // 这会让所有 node_modules 中的文件都被转换（包括 @noble 和 js-sha3）
  // 虽然会稍微慢一些，但可以确保 ESM 模块被正确转换
  transformIgnorePatterns: [],
  // 扩展名处理
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mjs'],
  // 注意：使用 Mock 方案后，不再需要自定义 resolver
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // 集成测试配置
  testTimeout: 60000, // 60秒超时（集成测试可能需要更长时间）
  // 可以通过环境变量跳过集成测试
  testPathIgnorePatterns: process.env.SKIP_INTEGRATION_TESTS === 'true' 
    ? ['/node_modules/', '/tests/integration/']
    : ['/node_modules/'],
  // 避免使用 Node.js 22 的 os.availableParallelism
  maxWorkers: '50%',
};

