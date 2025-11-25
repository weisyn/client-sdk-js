/**
 * Batch Helpers 单元测试
 * 
 * 注意：batchGetUTXOsHelper 已删除，因为 UTXO 查询已改为地址模型（listUTXOs）
 * 此文件现在只测试 batchGetResourcesHelper
 */

import { batchGetResourcesHelper } from '../../src/utils/batch_helpers';
import { WESClientMock } from '../../mock/client';

describe('Batch Helpers', () => {
  let mockClient: WESClientMock;

  beforeEach(() => {
    mockClient = new WESClientMock();
  });

  describe('batchGetResourcesHelper', () => {
    it('should batch get resources successfully', async () => {
      const resourceIds = [
        new Uint8Array(32).fill(1),
        new Uint8Array(32).fill(2),
        new Uint8Array(32).fill(3),
      ];

      resourceIds.forEach((id, index) => {
        mockClient.addResource(id, {
          resourceId: id,
          resourceType: 'contract',
          contentHash: new Uint8Array(32),
          size: 1024 * (index + 1),
          lockingConditions: [],
          createdAt: new Date(),
        });
      });

      const result = await batchGetResourcesHelper(mockClient, resourceIds);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should handle partial failures', async () => {
      const resourceIds = [
        new Uint8Array(32).fill(1),
        new Uint8Array(32).fill(99), // 不存在的资源
        new Uint8Array(32).fill(3),
      ];

      mockClient.addResource(resourceIds[0], {
        resourceId: resourceIds[0],
        resourceType: 'contract',
        contentHash: new Uint8Array(32),
        size: 1024,
        lockingConditions: [],
        createdAt: new Date(),
      });
      mockClient.addResource(resourceIds[2], {
        resourceId: resourceIds[2],
        resourceType: 'contract',
        contentHash: new Uint8Array(32),
        size: 2048,
        lockingConditions: [],
        createdAt: new Date(),
      });

      const result = await batchGetResourcesHelper(mockClient, resourceIds, {
        ignoreErrors: true,
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
    });
  });
});

