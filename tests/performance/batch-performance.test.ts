/**
 * 批量查询性能测试
 */

import { batchGetResourcesHelper } from '../../src/utils/batch_helpers';
import { WESClientMock } from '../../mock/client';
import type { OutPoint, ResourceInfo } from '../../src/client/wesclient-types';

describe('Batch Performance Tests', () => {
  let mockClient: WESClientMock;

  beforeEach(() => {
    mockClient = new WESClientMock({
      simulateDelay: true,
      delayMs: 10, // 模拟 10ms 延迟
    });
  });

  // 注意：batchGetUTXOs 已删除，UTXO 查询已改为地址模型（listUTXOs）
  // 性能测试应直接测试 listUTXOs 方法
  describe.skip('batchGetUTXOs performance (deprecated)', () => {
    it('should complete batch query within reasonable time', async () => {
      const outPoints: OutPoint[] = Array.from({ length: 50 }, (_, i) => ({
        txId: `0x${i.toString(16).padStart(64, '0')}`,
        outputIndex: 0,
      }));

      outPoints.forEach((op) => {
        mockClient.addUTXO(op, {
          outPoint: op,
          output: {},
          lockingCondition: {},
        });
      });

      const startTime = Date.now();
      const result = await batchGetUTXOsHelper(mockClient, outPoints, {
        concurrency: 5,
      });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(50);
      expect(elapsed).toBeLessThan(2000); // 应该在 2 秒内完成（50个 * 10ms / 5并发 ≈ 100ms + 开销）
    }, 10000);

    it('should handle large batch efficiently', async () => {
      const outPoints: OutPoint[] = Array.from({ length: 100 }, (_, i) => ({
        txId: `0x${i.toString(16).padStart(64, '0')}`,
        outputIndex: 0,
      }));

      outPoints.forEach((op) => {
        mockClient.addUTXO(op, {
          outPoint: op,
          output: {},
          lockingCondition: {},
        });
      });

      const startTime = Date.now();
      const result = await batchGetUTXOsHelper(mockClient, outPoints, {
        concurrency: 10,
        batchSize: 20,
      });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(100);
      expect(elapsed).toBeLessThan(3000); // 应该在 3 秒内完成
    }, 15000);
  });

  describe('batchGetResources performance', () => {
    it('should complete batch query within reasonable time', async () => {
      const resourceIds = Array.from({ length: 50 }, (_, i) =>
        new Uint8Array(32).fill(i)
      );

      resourceIds.forEach((id) => {
        mockClient.addResource(id, {
          resourceId: id,
          resourceType: 'contract',
          contentHash: new Uint8Array(32),
          size: 1024,
          lockingConditions: [],
          createdAt: new Date(),
        });
      });

      const startTime = Date.now();
      const result = await batchGetResourcesHelper(mockClient, resourceIds, {
        concurrency: 5,
      });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(50);
      expect(elapsed).toBeLessThan(2000);
    }, 10000);
  });
});

