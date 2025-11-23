/**
 * WESClientMock 实现
 * 
 * 提供可重用的 Mock Client，支持 Workbench 测试
 * 基于 _dev/decisions/adr-0003-mock-client-package.md 设计
 */

// 注意：这些类型只在类型注解中使用，通过类型导入来避免运行时错误
// rollup 的 TypeScript 插件应该能够正确处理这些类型导入
import type { WESClient } from '../src/client/wesclient';
import type {
  OutPoint,
  UTXO,
  ResourceInfo,
  ResourceFilters,
  TransactionInfo,
  TransactionFilters,
  EventInfo,
  EventFilters,
  NodeInfo,
  Transaction,
  SubmitTxResult,
  EventSubscription,
} from '../src/client/wesclient-types';

/**
 * WESClientMock 配置
 */
export interface WESClientMockConfig {
  /** Mock 数据存储 */
  data?: {
    utxos?: Map<string, UTXO>;
    resources?: Map<string, ResourceInfo>;
    transactions?: Map<string, TransactionInfo>;
    events?: EventInfo[];
  };
  /** 是否模拟延迟 */
  simulateDelay?: boolean;
  /** 延迟时间（毫秒） */
  delayMs?: number;
}

/**
 * WESClientMock 实现
 * 
 * 提供内存存储的 Mock 实现，用于测试和开发
 */
export class WESClientMock implements WESClient {
  public supportsBatchQuery = true;

  private utxos: Map<string, UTXO>;
  private resources: Map<string, ResourceInfo>;
  private transactions: Map<string, TransactionInfo>;
  private events: EventInfo[];
  private simulateDelay: boolean;
  private delayMs: number;
  // 通用响应和错误映射（支持 setResponse/setError API）
  private responses: Map<string, any> = new Map();
  private errors: Map<string, Error> = new Map();

  constructor(config: WESClientMockConfig = {}) {
    this.utxos = config.data?.utxos || new Map();
    this.resources = config.data?.resources || new Map();
    this.transactions = config.data?.transactions || new Map();
    this.events = config.data?.events || [];
    this.simulateDelay = config.simulateDelay ?? false;
    this.delayMs = config.delayMs ?? 0;
  }

  /**
   * 设置方法响应（通用 API，符合 ADR 设计）
   */
  setResponse(method: string, response: any): void {
    this.responses.set(method, response);
  }

  /**
   * 设置方法错误（通用 API，符合 ADR 设计）
   */
  setError(method: string, error: Error): void {
    this.errors.set(method, error);
  }

  private async delay(): Promise<void> {
    if (this.simulateDelay && this.delayMs > 0) {
      return new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }

  private getUTXOKey(outPoint: OutPoint): string {
    return `${outPoint.txId}:${outPoint.outputIndex}`;
  }

  private getResourceKey(resourceId: Uint8Array): string {
    return Array.from(resourceId)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async getUTXO(outPoint: OutPoint): Promise<UTXO> {
    await this.delay();
    
    // 检查通用错误设置
    if (this.errors.has('getUTXO')) {
      throw this.errors.get('getUTXO')!;
    }
    
    // 检查通用响应设置
    if (this.responses.has('getUTXO')) {
      return this.responses.get('getUTXO') as UTXO;
    }
    
    // 使用数据存储
    const key = this.getUTXOKey(outPoint);
    const utxo = this.utxos.get(key);
    if (!utxo) {
      throw new Error(`UTXO not found: ${key}`);
    }
    return utxo;
  }

  async getUTXOs(outPoints: OutPoint[]): Promise<UTXO[]> {
    return Promise.all(outPoints.map((op) => this.getUTXO(op)));
  }

  async getResource(resourceId: Uint8Array): Promise<ResourceInfo> {
    await this.delay();
    
    // 检查通用错误设置
    if (this.errors.has('getResource')) {
      throw this.errors.get('getResource')!;
    }
    
    // 检查通用响应设置
    if (this.responses.has('getResource')) {
      return this.responses.get('getResource') as ResourceInfo;
    }
    
    // 使用数据存储
    const key = this.getResourceKey(resourceId);
    const resource = this.resources.get(key);
    if (!resource) {
      throw new Error(`Resource not found: ${key}`);
    }
    return resource;
  }

  async getResources(filters: ResourceFilters): Promise<ResourceInfo[]> {
    await this.delay();
    
    // 检查通用错误设置
    if (this.errors.has('getResources')) {
      throw this.errors.get('getResources')!;
    }
    
    // 检查通用响应设置
    if (this.responses.has('getResources')) {
      return this.responses.get('getResources') as ResourceInfo[];
    }
    
    // 使用数据存储
    let results = Array.from(this.resources.values());

    // 应用过滤器
    if (filters.resourceType) {
      results = results.filter((r) => r.resourceType === filters.resourceType);
    }
    if (filters.owner) {
      // TODO: 根据 owner 过滤（需要从 lockingConditions 推导）
    }

    // 应用分页
    const offset = filters.offset || 0;
    const limit = filters.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async getTransaction(txId: string): Promise<TransactionInfo> {
    await this.delay();
    
    // 检查通用错误设置
    if (this.errors.has('getTransaction')) {
      throw this.errors.get('getTransaction')!;
    }
    
    // 检查通用响应设置
    if (this.responses.has('getTransaction')) {
      return this.responses.get('getTransaction') as TransactionInfo;
    }
    
    // 使用数据存储
    const tx = this.transactions.get(txId);
    if (!tx) {
      throw new Error(`Transaction not found: ${txId}`);
    }
    return tx;
  }

  async getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]> {
    await this.delay();
    let results = Array.from(this.transactions.values());

    // 应用过滤器
    if (filters.resourceId) {
      // TODO: 根据 resourceId 过滤交易
    }
    if (filters.txId) {
      results = results.filter((tx) => tx.txId === filters.txId);
    }

    // 应用分页
    const offset = filters.offset || 0;
    const limit = filters.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async submitTransaction(_tx: Transaction): Promise<SubmitTxResult> {
    await this.delay();
    
    // 检查通用错误设置
    if (this.errors.has('submitTransaction')) {
      throw this.errors.get('submitTransaction')!;
    }
    
    // 检查通用响应设置
    if (this.responses.has('submitTransaction')) {
      return this.responses.get('submitTransaction') as SubmitTxResult;
    }
    
    // Mock 实现：生成一个假的 txHash
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    // 模拟交易被接受
    return {
      txHash,
      accepted: true,
    };
  }

  async getEvents(filters: EventFilters): Promise<EventInfo[]> {
    await this.delay();
    let results = [...this.events];

    // 应用过滤器
    if (filters.resourceId) {
      const resourceKey = this.getResourceKey(filters.resourceId);
      results = results.filter((e) => {
        const eventResourceKey = this.getResourceKey(e.resourceId);
        return eventResourceKey === resourceKey;
      });
    }
    if (filters.eventName) {
      results = results.filter((e) => e.eventName === filters.eventName);
    }

    // 应用分页
    const offset = filters.offset || 0;
    const limit = filters.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async subscribeEvents(_filters: EventFilters): Promise<EventSubscription> {
    await this.delay();
    // Mock 实现：返回一个简单的订阅对象
    const callbacks: Array<(event: any) => void> = [];

    const subscription: EventSubscription = {
      id: `mock-subscription-${Date.now()}`,
      on: (event: 'event', callback: (event: any) => void) => {
        if (event === 'event') {
          callbacks.push(callback);
        }
      },
      unsubscribe: async () => {
        callbacks.length = 0;
      },
    };

    // 模拟事件推送（可选）
    // 在实际使用中，可以根据需要触发事件

    return subscription;
  }

  async getNodeInfo(): Promise<NodeInfo> {
    await this.delay();
    return {
      rpcVersion: '1.0.0',
      chainId: '0x1',
      blockHeight: 1000,
    };
  }

  async batchGetUTXOs(outPoints: OutPoint[]): Promise<UTXO[]> {
    return Promise.all(outPoints.map((op) => this.getUTXO(op)));
  }

  async batchGetResources(resourceIds: Uint8Array[]): Promise<ResourceInfo[]> {
    return Promise.all(resourceIds.map((id) => this.getResource(id)));
  }

  async call(_method: string, _params: any): Promise<any> {
    await this.delay();
    // Mock 实现：返回空结果
    return {};
  }

  async close(): Promise<void> {
    // Mock 实现：无需清理
  }

  // ========== Mock 数据管理方法 ==========

  /**
   * 添加 Mock UTXO
   */
  addUTXO(outPoint: OutPoint, utxo: UTXO): void {
    const key = this.getUTXOKey(outPoint);
    this.utxos.set(key, utxo);
  }

  /**
   * 添加 Mock Resource
   */
  addResource(resourceId: Uint8Array, resource: ResourceInfo): void {
    const key = this.getResourceKey(resourceId);
    this.resources.set(key, resource);
  }

  /**
   * 添加 Mock Transaction
   */
  addTransaction(txId: string, tx: TransactionInfo): void {
    this.transactions.set(txId, tx);
  }

  /**
   * 添加 Mock Event
   */
  addEvent(event: EventInfo): void {
    this.events.push(event);
  }

  /**
   * 清空所有 Mock 数据
   */
  clear(): void {
    this.utxos.clear();
    this.resources.clear();
    this.transactions.clear();
    this.events = [];
  }
}

