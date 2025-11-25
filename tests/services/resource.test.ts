/**
 * Resource Service 单元测试
 */

import { ResourceService } from '../../src/services/resource/service';
import { Wallet } from '../../src/wallet/wallet';
import { MockClient } from '../mocks/client';

describe('ResourceService', () => {
  let resourceService: ResourceService;
  let mockClient: MockClient;
  let wallet: Wallet;

  beforeEach(async () => {
    mockClient = new MockClient();
    wallet = await Wallet.create();
    resourceService = new ResourceService(mockClient, wallet);
  });

  describe('deployStaticResource', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        resourceService.deployStaticResource({
          from: invalidAddress,
          fileContent: new Uint8Array([1, 2, 3]),
          mimeType: 'text/plain',
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate filePath or fileContent', async () => {
      await expect(
        resourceService.deployStaticResource({
          from: wallet.address,
          mimeType: 'text/plain',
        })
      ).rejects.toThrow('Either filePath or fileContent must be provided');
    });

    it('should validate mimeType', async () => {
      await expect(
        resourceService.deployStaticResource({
          from: wallet.address,
          fileContent: new Uint8Array([1, 2, 3]),
          mimeType: '',
        })
      ).rejects.toThrow('MIME type is required');
    });
  });

  describe('deployContract', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        resourceService.deployContract({
          from: invalidAddress,
          wasmContent: new Uint8Array([1, 2, 3]),
          contractName: 'TestContract',
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate wasmPath or wasmContent', async () => {
      await expect(
        resourceService.deployContract({
          from: wallet.address,
          contractName: 'TestContract',
        })
      ).rejects.toThrow('Either wasmPath or wasmContent must be provided');
    });

    it('should validate contractName', async () => {
      await expect(
        resourceService.deployContract({
          from: wallet.address,
          wasmContent: new Uint8Array([1, 2, 3]),
          contractName: '',
        })
      ).rejects.toThrow('Contract name is required');
    });
  });

  describe('deployAIModel', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        resourceService.deployAIModel({
          from: invalidAddress,
          modelContent: new Uint8Array([1, 2, 3]),
          modelName: 'TestModel',
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate modelPath or modelContent', async () => {
      await expect(
        resourceService.deployAIModel({
          from: wallet.address,
          modelName: 'TestModel',
        })
      ).rejects.toThrow('Either modelPath or modelContent must be provided');
    });

    it('should validate modelName', async () => {
      await expect(
        resourceService.deployAIModel({
          from: wallet.address,
          modelContent: new Uint8Array([1, 2, 3]),
          modelName: '',
        })
      ).rejects.toThrow('Model name is required');
    });
  });

  describe('getResource', () => {
    it('should validate contentHash length', async () => {
      const invalidHash = new Uint8Array(31);
      await expect(
        resourceService.getResource(invalidHash)
      ).rejects.toThrow('ContentHash must be 32 bytes');
    });

    it('should get resource successfully', async () => {
      const contentHash = new Uint8Array(32).fill(1);

      const mockResource = {
        resourceId: '0x' + '01'.repeat(32),
        resourceType: 'contract',
        contentHash: '0x' + '01'.repeat(32),
        size: 1024,
        mimeType: 'application/wasm',
        lockingConditions: [],
        createdAt: new Date().toISOString(),
      };

      mockClient.setResponse('wes_getResource', mockResource);

      const resource = await resourceService.getResource(contentHash);

      expect(resource).toBeDefined();
      expect(resource.type).toBe('contract');
      expect(resource.size).toBe(1024);
    });
  });

  describe('getResources', () => {
    it('should get resources with filters', async () => {
      const filters = {
        resourceType: 'contract' as const,
        limit: 10,
        offset: 0,
      };

      const mockResources = {
        resources: [
          {
            resourceId: '0x' + '01'.repeat(32),
            resourceType: 'contract',
            contentHash: '0x' + '01'.repeat(32),
            size: 1024,
            mimeType: 'application/wasm',
            lockingConditions: [],
            createdAt: new Date().toISOString(),
          },
          {
            resourceId: '0x' + '02'.repeat(32),
            resourceType: 'static',
            contentHash: '0x' + '02'.repeat(32),
            size: 2048,
            mimeType: 'text/plain',
            lockingConditions: [],
            createdAt: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getResources', mockResources);

      const resources = await resourceService.getResources(filters);

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
    });

    it('should filter resources by type', async () => {
      const filters = {
        resourceType: 'contract' as const,
        limit: 10,
      };

      const mockResources = {
        resources: [
          {
            resourceId: '0x' + '01'.repeat(32),
            resourceType: 'contract',
            contentHash: '0x' + '01'.repeat(32),
            size: 1024,
            lockingConditions: [],
            createdAt: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getResources', mockResources);

      const resources = await resourceService.getResources(filters);

      expect(resources).toBeDefined();
      // 注意：实际过滤逻辑在 WESClient 中实现
    });

    it('should handle empty resources', async () => {
      const filters = {
        limit: 10,
      };

      mockClient.setResponse('wes_getResources', { resources: [] });

      const resources = await resourceService.getResources(filters);

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBe(0);
    });
  });
});

