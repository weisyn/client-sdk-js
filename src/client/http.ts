/**
 * HTTP 客户端实现
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { IClient } from './client';
import { ClientConfig, JSONRPCRequest, JSONRPCResponse, EventFilter, EventSubscription, SendTxResult } from './types';
import { withRetry, RetryConfig } from '../utils/retry';
import {
  WesError,
  WesProblemDetails,
  parseProblemDetailsFromRPCError,
  createDefaultWesError,
  ErrorCode,
} from '../types/wes-problem-details';

/**
 * HTTP 客户端实现
 */
export class HTTPClient implements IClient {
  private config: ClientConfig;
  private httpClient: AxiosInstance;
  private requestIdCounter: number = 0;
  private retryConfig?: RetryConfig;

  constructor(config: ClientConfig) {
    this.config = config;
    
    // 处理 baseURL：如果 endpoint 包含 /jsonrpc，则移除它作为 baseURL
    // 这样在 call 方法中可以使用相对路径 /jsonrpc
    let baseURL = config.endpoint;
    if (baseURL.includes('/jsonrpc')) {
      baseURL = baseURL.replace(/\/jsonrpc\/?$/, '');
    }
    
    this.httpClient = axios.create({
      baseURL: baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });
    
    // 如果配置了重试，使用配置的重试参数
    if (config.retry) {
      this.retryConfig = config.retry;
    }
  }

  /**
   * 调用 JSON-RPC 方法（带重试机制）
   */
  async call(method: string, params: any): Promise<any> {
    const requestId = ++this.requestIdCounter;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method,
      params: Array.isArray(params) ? params : params !== undefined ? [params] : [],
      id: requestId,
    };

    if (this.config.debug) {
      console.log('[HTTPClient] Request:', JSON.stringify(request, null, 2));
    }

    // 执行请求（带重试）
    const executeRequest = async () => {
      // 始终使用相对路径 /jsonrpc，让 axios 自动拼接 baseURL
      const url = '/jsonrpc';
      
      const response = await this.httpClient.post<JSONRPCResponse>(url, request);
      const data = response.data;

      if (this.config.debug) {
        console.log('[HTTPClient] Response:', JSON.stringify(data, null, 2));
      }

      if (data.error) {
        // 强制要求 JSON-RPC 错误的 data 字段必须包含 Problem Details
        const problem = parseProblemDetailsFromRPCError(data.error);
        
        if (!problem) {
          // 如果没有 Problem Details，记录错误并抛出异常
          const errorMsg = `JSON-RPC error response missing Problem Details: ${JSON.stringify(data.error)}`;
          if (this.config.debug) {
            console.error('[HTTPClient] Missing Problem Details:', data.error);
          }
          throw new Error(errorMsg);
        }
        
        // 使用 Problem Details 创建 WesError
        const wesError = WesError.fromProblemDetails(problem);
        if (this.config.debug) {
          console.error('[HTTPClient] WES Error:', {
            code: wesError.code,
            layer: wesError.layer,
            userMessage: wesError.userMessage,
            traceId: wesError.traceId,
          });
        }
        throw wesError;
      }

      return data.result;
    };

    try {
      // 如果配置了重试，使用重试机制
      if (this.retryConfig) {
        return await withRetry(executeRequest, {
          ...this.retryConfig,
          onRetry: (attempt, error) => {
            if (this.config.debug) {
              console.warn(`[HTTPClient] Retry attempt ${attempt}:`, error.message);
            }
            if (this.retryConfig?.onRetry) {
              this.retryConfig.onRetry(attempt, error);
            }
          },
        });
      } else {
        return await executeRequest();
      }
    } catch (error: any) {
      if (this.config.debug) {
        console.error('[HTTPClient] Error:', error);
      }
      
      // 如果已经是 WesError，直接抛出
      if (WesError.isWesError(error)) {
        throw error;
      }
      
      // 处理 axios 错误
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // 强制要求 HTTP 错误响应必须是 Problem Details 格式
        if (axiosError.response) {
          const response = axiosError.response;
          const contentType = response.headers['content-type'];
          
          // 检查是否是 Problem Details 响应
          if (contentType && contentType.includes('application/problem+json')) {
            try {
              const problem = response.data as WesProblemDetails;
              
              // 验证必填字段
              if (problem.code && problem.layer && problem.userMessage && problem.traceId) {
                const wesError = WesError.fromProblemDetails(problem);
                throw wesError;
              }
              
              // 如果格式不正确，抛出异常
              throw new Error(`Invalid Problem Details format: missing required fields`);
            } catch (parseError) {
              if (parseError instanceof WesError) {
                throw parseError;
              }
              // 解析失败，抛出异常
              throw new Error(`Failed to parse Problem Details: ${parseError}`);
            }
          } else {
            // 如果不是 Problem Details 格式，抛出异常
            throw new Error(
              `HTTP error response is not Problem Details format. ` +
              `Expected Content-Type: application/problem+json, ` +
              `got: ${contentType || 'unknown'}. ` +
              `Status: ${response.status} ${response.statusText}`
            );
          }
        }
        
        // 网络错误（无响应）
        if (axiosError.request) {
          throw createDefaultWesError(
            ErrorCode.SDK_CONNECTION_ERROR,
            '无法连接到服务，请检查网络或联系管理员。',
            'Network Error: No response received from server',
            503,
            {
              url: axiosError.config?.url,
              method: axiosError.config?.method,
            }
          );
        }
      }
      
      // 其他错误（超时等）
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw createDefaultWesError(
          ErrorCode.SDK_HTTP_ERROR,
          '请求超时，请稍后重试。',
          error.message || 'Request timeout',
          408,
          {
            timeout: this.config.timeout,
          }
        );
      }
      
      // 未知错误
      throw error;
    }
  }

  /**
   * 发送已签名的原始交易
   */
  async sendRawTransaction(signedTxHex: string): Promise<SendTxResult> {
    const result = await this.call('wes_sendRawTransaction', [signedTxHex]);
    return {
      txHash: result.tx_hash || result.txHash,
      accepted: result.accepted !== false,
      reason: result.reason,
    };
  }

  /**
   * 订阅事件（HTTP 不支持，抛出错误）
   */
  async subscribe(_filter: EventFilter): Promise<EventSubscription> {
    throw new Error('Event subscription is not supported in HTTP client. Use WebSocket client instead.');
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // HTTP 客户端无需关闭连接
  }
}

