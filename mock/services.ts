/**
 * Mock Services 实现
 * 
 * 基于 WESClientMock 创建 Mock Service 实例
 */

import { WESClientMock, WESClientMockConfig } from './client';
// 注意：这些导入在构建时会被 rollup 解析并打包
import { ResourceService } from '../src/services/resource/service';
import { TransactionServiceImpl } from '../src/services/transaction/service';
import { EventServiceImpl } from '../src/services/event/service';
// 注意：使用普通导入而非 import type，以便 rollup 正确处理
// 这些类型只在类型注解中使用，TypeScript 编译器会在编译时移除它们
import { TransactionService } from '../src/services/transaction/service';
import { EventService } from '../src/services/event/service';

/**
 * 创建 Mock ResourceService
 */
export function createMockResourceService(config?: WESClientMockConfig): ResourceService {
  const mockClient = new WESClientMock(config);
  // ResourceService 需要 IClient，但我们可以创建一个适配器
  // 或者直接使用 WESClientMock 作为 IClient（需要类型转换）
  // 这里我们创建一个简单的适配器
  const adapter = createClientAdapter(mockClient);
  return new ResourceService(adapter);
}

/**
 * 创建 Mock TransactionService
 */
export function createMockTransactionService(config?: WESClientMockConfig): TransactionService {
  const mockClient = new WESClientMock(config);
  const adapter = createClientAdapter(mockClient);
  return new TransactionServiceImpl(adapter);
}

/**
 * 创建 Mock EventService
 */
export function createMockEventService(config?: WESClientMockConfig): EventService {
  const mockClient = new WESClientMock(config);
  const adapter = createClientAdapter(mockClient);
  return new EventServiceImpl(adapter);
}

/**
 * 创建 IClient 适配器（将 WESClient 适配为 IClient）
 */
function createClientAdapter(wesClient: WESClientMock): any {
  return {
    async call(method: string, params: any): Promise<any> {
      return wesClient.call(method, params);
    },
    async sendRawTransaction(signedTxHex: string): Promise<any> {
      return wesClient.submitTransaction(signedTxHex);
    },
    async subscribe(params: any): Promise<any> {
      // 将订阅参数转换为 EventFilters
      const filters: any = {};
      if (typeof params === 'object') {
        if (params.resourceId) filters.resourceId = params.resourceId;
        if (params.eventName) filters.eventName = params.eventName;
      }
      return wesClient.subscribeEvents(filters);
    },
    async close(): Promise<void> {
      return wesClient.close();
    },
  };
}

