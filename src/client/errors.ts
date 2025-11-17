/**
 * 客户端错误定义
 */

/**
 * SDK 错误基类
 */
export class SDKError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'SDKError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends SDKError {
  constructor(message: string, public statusCode?: number) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * JSON-RPC 错误
 */
export class JSONRPCError extends SDKError {
  constructor(message: string, public rpcCode: number, public rpcData?: any) {
    super(message, 'JSONRPC_ERROR');
    this.name = 'JSONRPCError';
  }
}

/**
 * 交易错误
 */
export class TransactionError extends SDKError {
  constructor(message: string, public txHash?: string) {
    super(message, 'TRANSACTION_ERROR');
    this.name = 'TransactionError';
  }
}

/**
 * 钱包错误
 */
export class WalletError extends SDKError {
  constructor(message: string) {
    super(message, 'WALLET_ERROR');
    this.name = 'WalletError';
  }
}

/**
 * 参数验证错误
 */
export class ValidationError extends SDKError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * 浏览器兼容性错误
 */
export class BrowserCompatibilityError extends SDKError {
  constructor(
    message: string,
    public feature: string,
    public environment: 'node' | 'browser' | 'unknown'
  ) {
    super(message, 'BROWSER_COMPATIBILITY_ERROR');
    this.name = 'BrowserCompatibilityError';
  }
}

