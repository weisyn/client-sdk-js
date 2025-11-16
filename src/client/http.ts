/**
 * HTTP 客户端实现
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IClient } from './client';
import { ClientConfig, JSONRPCRequest, JSONRPCResponse, EventFilter, EventSubscription, SendTxResult } from './types';

/**
 * HTTP 客户端实现
 */
export class HTTPClient implements IClient {
  private config: ClientConfig;
  private httpClient: AxiosInstance;
  private requestIdCounter: number = 0;

  constructor(config: ClientConfig) {
    this.config = config;
    this.httpClient = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });
  }

  /**
   * 调用 JSON-RPC 方法
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

    try {
      // 如果 endpoint 包含路径，使用完整路径；否则使用默认路径
      const url = this.config.endpoint.includes('/jsonrpc') 
        ? this.config.endpoint 
        : `${this.config.endpoint}/jsonrpc`;
      
      const response = await this.httpClient.post<JSONRPCResponse>(url, request);
      const data = response.data;

      if (this.config.debug) {
        console.log('[HTTPClient] Response:', JSON.stringify(data, null, 2));
      }

      if (data.error) {
        const errorMsg = `JSON-RPC Error: ${data.error.message} (code: ${data.error.code})`;
        if (this.config.debug && data.error.data) {
          console.error('[HTTPClient] Error data:', data.error.data);
        }
        throw new Error(errorMsg);
      }

      return data.result;
    } catch (error: any) {
      if (this.config.debug) {
        console.error('[HTTPClient] Error:', error);
      }
      
      // 处理网络错误
      if (error.response) {
        throw new Error(`HTTP Error: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Network Error: No response received from server');
      } else {
        throw error;
      }
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
  async subscribe(filter: EventFilter): Promise<EventSubscription> {
    throw new Error('Event subscription is not supported in HTTP client. Use WebSocket client instead.');
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // HTTP 客户端无需关闭连接
  }
}

