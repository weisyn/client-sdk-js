/**
 * Mock Client 用于测试
 */

import { IClient } from '../../src/client/client';

/**
 * Mock Client 实现
 */
export class MockClient implements IClient {
  private responses: Map<string, any> = new Map();
  private callHistory: Array<{ method: string; params: any }> = [];

  /**
   * 设置方法响应
   */
  setResponse(method: string, response: any): void {
    this.responses.set(method, response);
  }

  /**
   * 获取调用历史
   */
  getCallHistory(): Array<{ method: string; params: any }> {
    return [...this.callHistory];
  }

  /**
   * 清除调用历史
   */
  clearHistory(): void {
    this.callHistory = [];
  }

  /**
   * 调用 JSON-RPC 方法
   */
  async call(method: string, params: any): Promise<any> {
    this.callHistory.push({ method, params });

    if (this.responses.has(method)) {
      return this.responses.get(method);
    }

    // 默认响应
    switch (method) {
      case 'wes_getUTXO':
        return { utxos: [] };
      case 'wes_getBalance':
        return '0';
      case 'wes_getResource':
        return { contentHash: '', type: 'static', size: 0 };
      default:
        return {};
    }
  }

  /**
   * 发送已签名的原始交易
   */
  async sendRawTransaction(signedTxHex: string): Promise<any> {
    this.callHistory.push({ method: 'wes_sendRawTransaction', params: [signedTxHex] });
    return {
      txHash: '0x' + '0'.repeat(64),
      accepted: true,
    };
  }

  /**
   * 订阅事件（Mock 不支持）
   */
  async subscribe(_filter: any): Promise<any> {
    throw new Error('Mock client does not support subscription');
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // Mock 无需关闭
  }
}

