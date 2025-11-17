/**
 * 浏览器兼容性工具函数
 * 
 * 提供跨环境（Node.js 和浏览器）的工具函数
 */

/**
 * 检测当前运行环境
 */
export function getEnvironment(): 'node' | 'browser' | 'unknown' {
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return 'browser';
  }
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }
  return 'unknown';
}

/**
 * 检查是否支持 Web Crypto API
 */
export function supportsWebCrypto(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.crypto !== 'undefined' && 
         typeof window.crypto.subtle !== 'undefined';
}

/**
 * 检查是否支持 Node.js crypto 模块
 */
export function supportsNodeCrypto(): boolean {
  if (typeof require === 'undefined') {
    return false;
  }
  try {
    require('crypto');
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否支持文件系统操作（仅 Node.js）
 */
export function supportsFileSystem(): boolean {
  if (typeof require === 'undefined') {
    return false;
  }
  try {
    require('fs');
    return true;
  } catch {
    return false;
  }
}

/**
 * 环境信息
 */
export interface EnvironmentInfo {
  environment: 'node' | 'browser' | 'unknown';
  supportsWebCrypto: boolean;
  supportsNodeCrypto: boolean;
  supportsFileSystem: boolean;
  nodeVersion?: string;
  browserInfo?: {
    userAgent: string;
  };
}

/**
 * 获取环境信息
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  const env = getEnvironment();
  const info: EnvironmentInfo = {
    environment: env,
    supportsWebCrypto: supportsWebCrypto(),
    supportsNodeCrypto: supportsNodeCrypto(),
    supportsFileSystem: supportsFileSystem(),
  };

  if (env === 'node' && typeof process !== 'undefined' && process.versions) {
    info.nodeVersion = process.versions.node;
  }

  if (env === 'browser' && typeof window !== 'undefined' && window.navigator) {
    info.browserInfo = {
      userAgent: window.navigator.userAgent,
    };
  }

  return info;
}

/**
 * 浏览器环境错误类
 */
export class BrowserCompatibilityError extends Error {
  constructor(
    message: string,
    public readonly feature: string,
    public readonly environment: 'node' | 'browser' | 'unknown'
  ) {
    super(message);
    this.name = 'BrowserCompatibilityError';
  }
}

/**
 * 检查功能是否在当前环境可用
 */
export function requireFeature(
  feature: string,
  checkFn: () => boolean,
  errorMessage?: string
): void {
  if (!checkFn()) {
    const env = getEnvironment();
    const message = errorMessage || 
      `Feature "${feature}" is not available in ${env} environment`;
    throw new BrowserCompatibilityError(message, feature, env);
  }
}

