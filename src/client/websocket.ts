/**
 * WebSocket 客户端实现
 */

import WebSocket from 'ws';
import { IClient } from './client';
import { ClientConfig, JSONRPCRequest, JSONRPCResponse, EventFilter, EventSubscription, Event, SendTxResult } from './types';
import { bytesToHex, hexToBytes } from '../utils/hex';

/**
 * WebSocket 客户端实现
 */
export class WebSocketClient implements IClient {
  private config: ClientConfig;
  private ws: WebSocket | null = null;
  private requestIdCounter: number = 0;
  private pendingRequests: Map<number | string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();

  constructor(config: ClientConfig) {
    this.config = config;
  }

  /**
   * 确保 WebSocket 连接已建立
   */
  private async ensureConnected(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.endpoint);

        this.ws.on('open', () => {
          if (this.config.debug) {
            console.log('[WebSocketClient] Connected');
          }
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          if (this.config.debug) {
            console.error('[WebSocketClient] Error:', error);
          }
          reject(error);
        });

        this.ws.on('close', () => {
          if (this.config.debug) {
            console.log('[WebSocketClient] Closed');
          }
          // 清理所有待处理的请求
          for (const [id, { reject }] of this.pendingRequests) {
            reject(new Error('WebSocket connection closed'));
          }
          this.pendingRequests.clear();
        });
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(message: string): void {
    try {
      const data: JSONRPCResponse = JSON.parse(message);

      // 处理请求响应
      if (data.id !== undefined) {
        const pending = this.pendingRequests.get(data.id);
        if (pending) {
          this.pendingRequests.delete(data.id);
          if (data.error) {
            pending.reject(new Error(`JSON-RPC Error: ${data.error.message} (code: ${data.error.code})`));
          } else {
            pending.resolve(data.result);
          }
        }
      }

      // 处理事件订阅
      // TODO: 实现事件订阅的消息处理
    } catch (error) {
      if (this.config.debug) {
        console.error('[WebSocketClient] Failed to parse message:', error);
      }
    }
  }

  /**
   * 调用 JSON-RPC 方法
   */
  async call(method: string, params: any): Promise<any> {
    await this.ensureConnected();

    const requestId = ++this.requestIdCounter;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method,
      params: Array.isArray(params) ? params : [params],
      id: requestId,
    };

    if (this.config.debug) {
      console.log('[WebSocketClient] Request:', JSON.stringify(request, null, 2));
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      if (this.ws) {
        this.ws.send(JSON.stringify(request));
      } else {
        reject(new Error('WebSocket is not connected'));
      }
    });
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
   * 订阅事件
   * 
   * **流程**：
   * 1. 调用 `wes_subscribe` JSON-RPC 方法
   * 2. 创建事件订阅对象
   * 3. 监听 WebSocket 消息中的事件
   */
  async subscribe(filter: EventFilter): Promise<EventSubscription> {
    await this.ensureConnected();

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. 构建订阅参数
    const subscribeParams: any = {};
    if (filter.topics && filter.topics.length > 0) {
      subscribeParams.topics = filter.topics;
    }
    if (filter.from) {
      subscribeParams.from = bytesToHex(filter.from);
    }
    if (filter.to) {
      subscribeParams.to = bytesToHex(filter.to);
    }

    // 2. 调用 wes_subscribe JSON-RPC 方法
    const result = await this.call('wes_subscribe', [subscribeParams]);
    
    if (!result || typeof result !== 'string') {
      throw new Error('Invalid subscribe response format');
    }

    const actualSubscriptionId = result; // 节点返回的订阅ID

    // 3. 创建事件订阅对象
    const eventCallbacks: Array<(event: Event) => void> = [];
    
    const subscription: EventSubscription = {
      id: actualSubscriptionId,
      on: (eventType: 'event', callback: (event: Event) => void) => {
        if (eventType === 'event') {
          eventCallbacks.push(callback);
        }
      },
      unsubscribe: async () => {
        // 调用 wes_unsubscribe 取消订阅
        try {
          await this.call('wes_unsubscribe', [actualSubscriptionId]);
        } catch (error) {
          // 忽略取消订阅错误
        }
        this.subscriptions.delete(subscriptionId);
      },
    };

    // 4. 设置消息处理器（处理订阅的事件）
    const messageHandler = (data: string) => {
      try {
        const message: JSONRPCResponse = JSON.parse(data);
        
        // 检查是否是订阅事件消息
        if (message.method === 'wes_subscription' || message.params) {
          const params = message.params as any;
          if (params && params.subscription === actualSubscriptionId) {
            // 解析事件数据
            const eventData = params.result;
            const event: Event = {
              topic: eventData.topic || '',
              data: eventData.data ? hexToBytes(eventData.data) : new Uint8Array(),
              blockHeight: eventData.blockHeight,
              txHash: eventData.txHash,
            };

            // 调用所有注册的回调
            eventCallbacks.forEach(callback => {
              try {
                callback(event);
              } catch (error) {
                if (this.config.debug) {
                  console.error('[WebSocketClient] Event callback error:', error);
                }
              }
            });
          }
        }
      } catch (error) {
        if (this.config.debug) {
          console.error('[WebSocketClient] Failed to parse subscription message:', error);
        }
      }
    };

    // 5. 添加消息处理器（需要保存以便后续移除）
    if (this.ws) {
      const originalOnMessage = this.ws.on.bind(this.ws);
      this.ws.on('message', (data: WebSocket.Data) => {
        const messageStr = data.toString();
        this.handleMessage(messageStr);
        messageHandler(messageStr);
      });
    }

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // 取消所有订阅
    for (const subscription of this.subscriptions.values()) {
      await subscription.unsubscribe();
    }
    this.subscriptions.clear();

    // 关闭 WebSocket 连接
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

