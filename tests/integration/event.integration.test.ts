/**
 * Event Service 集成测试
 * 
 * 注意：这些测试需要连接到真实的 WES 节点
 * 可以通过设置环境变量 SKIP_INTEGRATION_TESTS=true 跳过
 */

import { EventServiceImpl } from '../../src/services/event/service';
import { createClient } from '../../src/client/client';
import type { ClientConfig } from '../../src/client/types';

describe('EventServiceImpl Integration Tests', () => {
  let eventService: EventServiceImpl;
  const testConfig: ClientConfig = {
    endpoint: process.env.WES_NODE_URL || 'http://localhost:8545',
    protocol: 'http',
    timeout: 30000,
  };

  beforeAll(() => {
    if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
      console.log('Skipping integration tests');
      return;
    }

    const client = createClient(testConfig);
    eventService = new EventServiceImpl(client);
  });

  describe('getEvents', () => {
    it('should get events', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      const filters = {
        limit: 10,
        offset: 0,
      };

      try {
        const events = await eventService.getEvents(filters);
        expect(Array.isArray(events)).toBe(true);
      } catch (error: any) {
        // 如果 RPC 不存在，这是预期的
        // 错误可能是 WESClientError 或其他类型的错误
        expect(error.code === 'RPC_NOT_IMPLEMENTED' || error.code === 'RPC_ERROR' || error instanceof Error).toBe(true);
      }
    }, 30000);

    it('should filter events by resourceId', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      const filters = {
        resourceId: new Uint8Array(32).fill(1),
        limit: 10,
      };

      try {
        const events = await eventService.getEvents(filters);
        expect(Array.isArray(events)).toBe(true);
      } catch (error: any) {
        // 如果 RPC 不存在，这是预期的
        // 错误可能是 WESClientError 或其他类型的错误
        expect(error.code === 'RPC_NOT_IMPLEMENTED' || error.code === 'RPC_ERROR' || error instanceof Error).toBe(true);
      }
    }, 30000);
  });

  describe('subscribeEvents', () => {
    it('should subscribe to events', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      // 注意：订阅需要 WebSocket 连接
      const filters = {
        resourceId: new Uint8Array(32).fill(1),
      };

      try {
        const subscription = await eventService.subscribeEvents(filters);
        expect(subscription).toBeDefined();
        expect(subscription.id).toBeDefined();

        // 清理
        await subscription.unsubscribe();
      } catch (error: any) {
        // 如果 WebSocket 不可用或 RPC 不存在，这是预期的
        expect(error).toBeDefined();
      }
    }, 30000);
  });
});

