/**
 * Client 接口定义
 */

import { ClientConfig, Protocol, EventSubscription, SendTxResult, SubscribeParams } from './types';
import { HTTPClient } from './http';
import { WebSocketClient } from './websocket';

/**
 * WES 客户端接口
 */
export interface IClient {
  /**
   * 调用 JSON-RPC 方法
   * @param method 方法名
   * @param params 参数
   * @returns 返回结果
   */
  call(method: string, params: any): Promise<any>;

  /**
   * 发送已签名的原始交易
   * @param signedTxHex 已签名的交易（十六进制字符串）
   * @returns 交易提交结果
   */
  sendRawTransaction(signedTxHex: string): Promise<SendTxResult>;

  /**
   * 订阅事件（WebSocket 支持）
   * @param params 订阅参数：订阅类型字符串（如 'newHeads'）或事件过滤器
   * @returns 事件订阅对象
   */
  subscribe(params: SubscribeParams): Promise<EventSubscription>;

  /**
   * 关闭连接
   */
  close(): Promise<void>;
}

/**
 * 客户端配置
 */
export type { ClientConfig };

/**
 * 传输协议类型
 */
export type { Protocol };

/**
 * 创建客户端实例（工厂函数）
 * @param config 客户端配置
 * @returns 客户端实例
 */
export function createClient(config: ClientConfig): IClient {
  switch (config.protocol) {
    case 'http':
      return new HTTPClient(config);
    case 'websocket':
      return new WebSocketClient(config);
    default:
      throw new Error(`Unsupported protocol: ${config.protocol}`);
  }
}

/**
 * Client 类（兼容性导出，支持 new Client(config) 用法）
 * 同时可以作为类型使用（Client 类实现了 IClient 接口）
 */
export class Client implements IClient {
  private impl: IClient;

  constructor(config: ClientConfig) {
    this.impl = createClient(config);
  }

  async call(method: string, params: any): Promise<any> {
    return this.impl.call(method, params);
  }

  async sendRawTransaction(signedTxHex: string): Promise<SendTxResult> {
    return this.impl.sendRawTransaction(signedTxHex);
  }

  async subscribe(params: SubscribeParams): Promise<EventSubscription> {
    return this.impl.subscribe(params);
  }

  async close(): Promise<void> {
    return this.impl.close();
  }
}

/**
 * IClient 接口已在上面通过 export interface IClient 导出
 * 不需要再次导出
 */

