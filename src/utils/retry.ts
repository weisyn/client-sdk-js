/**
 * 请求重试工具
 *
 * 提供指数退避重试机制，用于处理网络请求失败的情况
 */

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 初始延迟（毫秒） */
  initialDelay?: number;
  /** 最大延迟（毫秒） */
  maxDelay?: number;
  /** 退避倍数 */
  backoffMultiplier?: number;
  /** 可重试的错误判断函数 */
  retryable?: (error: any) => boolean;
  /** 重试前的回调函数 */
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, "retryable" | "onRetry">> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: any): boolean {
  // 网络错误（无响应）
  if (
    error.message &&
    (error.message.includes("Network Error") ||
      error.message.includes("No response received") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND"))
  ) {
    return true;
  }

  // HTTP 5xx 错误（服务器错误）
  if (error.response && error.response.status >= 500 && error.response.status < 600) {
    return true;
  }

  // HTTP 429 错误（请求过多）
  if (error.response && error.response.status === 429) {
    return true;
  }

  return false;
}

/**
 * 计算退避延迟
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * 延迟指定时间
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的函数执行器
 *
 * @param fn 要执行的函数
 * @param config 重试配置
 * @returns Promise<T> 函数执行结果
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const {
    maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
    initialDelay = DEFAULT_RETRY_CONFIG.initialDelay,
    maxDelay = DEFAULT_RETRY_CONFIG.maxDelay,
    backoffMultiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier,
    retryable = isRetryableError,
    onRetry,
  } = config;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 如果是最后一次尝试，直接抛出错误
      if (attempt >= maxRetries) {
        break;
      }

      // 判断是否可重试
      if (!retryable(error)) {
        throw error;
      }

      // 计算延迟时间
      const delay = calculateBackoffDelay(attempt, initialDelay, maxDelay, backoffMultiplier);

      // 调用重试回调
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // 等待后重试
      await sleep(delay);
    }
  }

  // 所有重试都失败，抛出最后一个错误
  throw lastError;
}

/**
 * 创建重试装饰器
 */
export function createRetryWrapper(config: RetryConfig = {}) {
  return <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return ((...args: any[]) => {
      return withRetry(() => fn(...args), config);
    }) as T;
  };
}
