/**
 * WebSocket 客户端实现
 */

import { IClient } from './client';
import { ClientConfig, JSONRPCRequest, EventSubscription, Event, SendTxResult, SubscribeParams } from './types';
import { bytesToHex, hexToBytes } from '../utils/hex';

// 检测运行环境并选择合适的 WebSocket 实现
let WebSocketImpl: any;
if (typeof window !== 'undefined' && window.WebSocket) {
  // 浏览器环境：使用原生 WebSocket
  WebSocketImpl = window.WebSocket;
} else if (typeof global !== 'undefined') {
  // Node.js 环境：使用 ws 包
  try {
    WebSocketImpl = require('ws');
  } catch (e) {
    throw new Error('WebSocket is not available. In Node.js, please install the "ws" package.');
  }
} else {
  throw new Error('WebSocket is not available in this environment');
}

/**
 * WebSocket 客户端实现
 */
export class WebSocketClient implements IClient {
  private config: ClientConfig;
  private ws: any | null = null;
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
    if (this.ws && this.ws.readyState === WebSocketImpl.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocketImpl(this.config.endpoint);

        // 浏览器环境：使用 addEventListener
        if (typeof window !== 'undefined' && this.ws instanceof window.WebSocket) {
          this.ws.addEventListener('open', () => {
            if (this.config.debug) {
              console.log('[WebSocketClient] Connected');
            }
            resolve();
          });

          this.ws.addEventListener('message', (event: MessageEvent) => {
            this.handleMessage(event.data);
          });

          this.ws.addEventListener('error', (evt: globalThis.Event) => {
            if (this.config.debug) {
              console.error('[WebSocketClient] Error:', evt);
            }
            reject(new Error('WebSocket connection error'));
          });

          this.ws.addEventListener('close', () => {
            if (this.config.debug) {
              console.log('[WebSocketClient] Closed');
            }
            // 清理所有待处理的请求
            for (const [, { reject }] of this.pendingRequests) {
              reject(new Error('WebSocket connection closed'));
            }
            this.pendingRequests.clear();
          });
        } else {
          // Node.js 环境：使用 ws 包的事件监听器
          this.ws.on('open', () => {
            if (this.config.debug) {
              console.log('[WebSocketClient] Connected');
            }
            resolve();
          });

          this.ws.on('message', (data: any) => {
            this.handleMessage(data.toString());
          });

          this.ws.on('error', (error: Error) => {
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
            for (const [, { reject }] of this.pendingRequests) {
              reject(new Error('WebSocket connection closed'));
            }
            this.pendingRequests.clear();
          });
        }
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
      const data: any = JSON.parse(message);

      // 处理订阅事件通知（wes_subscription）
      if (data.method === 'wes_subscription' && data.params) {
        const params = data.params as any;
        const subscriptionId = params.subscription;
        const eventData = params.result;

        // 查找对应的订阅
        for (const [, subscription] of this.subscriptions.entries()) {
          if (subscription.id === subscriptionId) {
            // 触发订阅的回调
            // 注意：这里需要访问 subscription 的内部回调列表
            // 我们需要修改 EventSubscription 的结构来支持这个
            this.triggerSubscriptionCallbacks(subscriptionId, eventData);
            return;
          }
        }

        if (this.config.debug) {
          console.warn('[WebSocketClient] Received event for unknown subscription:', subscriptionId);
        }
        return;
      }

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
    } catch (error) {
      if (this.config.debug) {
        console.error('[WebSocketClient] Failed to parse message:', error);
      }
    }
  }

  /**
   * 触发订阅回调
   */
  private triggerSubscriptionCallbacks(subscriptionId: string, eventData: any): void {
    // 查找订阅并触发回调
    const subscription = Array.from(this.subscriptions.values()).find(sub => sub.id === subscriptionId);
    if (subscription && (subscription as any).callbacks) {
      const callbacks = (subscription as any).callbacks as Array<(event: Event) => void>;
      
      // 根据事件类型构建 Event 对象
      // 对于 newHeads 事件，eventData 是 NewHeadEvent 结构
      // 对于 logs 事件，eventData 是 LogsEvent 结构
      const event: Event = {
        topic: eventData.topic || eventData.type || '',
        data: eventData.data ? hexToBytes(eventData.data) : new Uint8Array(),
        blockHeight: eventData.blockHeight || eventData.height,
        txHash: eventData.txHash || eventData.hash,
      };

      // 对于 newHeads 事件，我们传递完整的事件数据
      // 但 Event 接口可能不够，我们需要扩展或者使用 any
      // 暂时传递 eventData 作为 event，让调用者自己处理
      const enrichedEvent: any = {
        ...event,
        ...eventData, // 包含所有原始字段（removed, reorgId, resumeToken 等）
      };

      callbacks.forEach(callback => {
        try {
          callback(enrichedEvent as Event);
        } catch (error) {
          if (this.config.debug) {
            console.error('[WebSocketClient] Event callback error:', error);
          }
        }
      });
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
   * **支持两种订阅方式**：
   * 1. 订阅类型字符串：'newHeads', 'logs', 'newPendingTxs', 'syncing'
   * 2. 事件过滤器：用于合约事件订阅（topics, from, to）
   * 
   * **流程**：
   * 1. 调用 `wes_subscribe` JSON-RPC 方法
   * 2. 创建事件订阅对象
   * 3. 通过 handleMessage 处理订阅事件
   */
  async subscribe(params: SubscribeParams): Promise<EventSubscription> {
    await this.ensureConnected();

    const localSubscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. 构建订阅参数
    let subscribeArgs: any[];
    
    if (typeof params === 'string') {
      // 订阅类型字符串（如 'newHeads'）
      subscribeArgs = [params];
    } else {
      // 事件过滤器（合约事件）
      const subscribeParams: any = {};
      if (params.topics && params.topics.length > 0) {
        subscribeParams.topics = params.topics;
      }
      if (params.from) {
        subscribeParams.from = bytesToHex(params.from);
      }
      if (params.to) {
        subscribeParams.to = bytesToHex(params.to);
      }
      subscribeArgs = [subscribeParams];
    }

    // 2. 调用 wes_subscribe JSON-RPC 方法
    const result = await this.call('wes_subscribe', subscribeArgs);
    
    if (!result || typeof result !== 'string') {
      throw new Error('Invalid subscribe response format');
    }

    const actualSubscriptionId = result; // 节点返回的订阅ID

    // 3. 创建事件订阅对象
    const eventCallbacks: Array<(event: Event) => void> = [];
    
    const subscription: EventSubscription & { callbacks: Array<(event: Event) => void> } = {
      id: actualSubscriptionId,
      callbacks: eventCallbacks,
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
        this.subscriptions.delete(localSubscriptionId);
      },
    };

    // 4. 保存订阅
    this.subscriptions.set(localSubscriptionId, subscription);
    
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

