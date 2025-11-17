module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
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
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // 集成测试配置
  testTimeout: 60000, // 60秒超时（集成测试可能需要更长时间）
  // 可以通过环境变量跳过集成测试
  testPathIgnorePatterns: process.env.SKIP_INTEGRATION_TESTS === 'true' 
    ? ['/node_modules/', '/tests/integration/']
    : ['/node_modules/'],
};

