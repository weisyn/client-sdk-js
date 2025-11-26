/**
 * 批量查询性能测试
 */

import { batchGetResourcesHelper } from '../../src/utils/batch_helpers';
import { WESClientMock } from '../../mock/client';

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
  // 此测试已废弃，保留代码但跳过执行
  describe.skip('batchGetUTXOs performance (deprecated)', () => {
    it.skip('should complete batch query within reasonable time', async () => {
      // 此测试已废弃，因为 batchGetUTXOs 功能已移除
    });

    it.skip('should handle large batch efficiently', async () => {
      // 此测试已废弃，因为 batchGetUTXOs 功能已移除
    });
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

