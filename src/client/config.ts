/**
 * 客户端配置管理
 */

import { ClientConfig, Protocol } from './types';

/**
 * 默认客户端配置
 */
export function defaultConfig(): ClientConfig {
  return {
    endpoint: 'http://localhost:8545',
    protocol: 'http',
    timeout: 30000,
    debug: false,
    headers: {},
  };
}

/**
 * 创建客户端配置
 */
export function createConfig(overrides?: Partial<ClientConfig>): ClientConfig {
  return {
    ...defaultConfig(),
    ...overrides,
  };
}

