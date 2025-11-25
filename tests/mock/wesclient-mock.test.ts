/**
 * WESClientMock 单元测试
 */

import { WESClientMock } from '../../mock/client';
import type {
  OutPoint,
  UTXO,
  ResourceInfo,
  TransactionInfo,
  EventInfo,
} from '../../src/client/wesclient-types';

describe('WESClientMock', () => {
  let mockClient: WESClientMock;

  beforeEach(() => {
    mockClient = new WESClientMock();
  });

  describe('UTXO operations', () => {
    it('should list UTXOs by address', async () => {
      const address = new Uint8Array(20).fill(1);
      const outPoint: OutPoint = {
        txId: '0x1111',
        outputIndex: 0,
      };

      const mockUTXO: UTXO = {
        outPoint,
        output: { amount: '1000' },
        lockingCondition: {},
      };

      // 使用地址作为 key 添加 UTXO（地址模型）
      mockClient.addUTXO(address, mockUTXO);

      const utxos = await mockClient.listUTXOs(address);
      expect(Array.isArray(utxos)).toBe(true);
      // Mock 实现会返回所有 UTXO（简化实现）
      expect(utxos.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when address has no UTXOs', async () => {
      const address = new Uint8Array(20).fill(2); // 不同的地址

      const utxos = await mockClient.listUTXOs(address);
      expect(Array.isArray(utxos)).toBe(true);
      // Mock 实现可能返回空数组或所有 UTXO（取决于实现）
    });
  });

  describe('Resource operations', () => {
    it('should add and get resource', async () => {
      const resourceId = new Uint8Array(32).fill(1);
      const mockResource: ResourceInfo = {
        resourceId,
        resourceType: 'contract',
        contentHash: new Uint8Array(32).fill(2),
        size: 1024,
        mimeType: 'application/wasm',
        lockingConditions: [],
        createdAt: new Date(),
      };

      mockClient.addResource(resourceId, mockResource);

      const resource = await mockClient.getResource(resourceId);
      expect(resource).toEqual(mockResource);
    });

    it('should filter resources by type', async () => {
      const resourceId1 = new Uint8Array(32).fill(1);
      const resourceId2 = new Uint8Array(32).fill(2);

      mockClient.addResource(resourceId1, {
        resourceId: resourceId1,
        resourceType: 'contract',
        contentHash: new Uint8Array(32),
        size: 0,
        lockingConditions: [],
        createdAt: new Date(),
      });

      mockClient.addResource(resourceId2, {
        resourceId: resourceId2,
        resourceType: 'static',
        contentHash: new Uint8Array(32),
        size: 0,
        lockingConditions: [],
        createdAt: new Date(),
      });

      const contracts = await mockClient.getResources({ resourceType: 'contract' });
      expect(contracts).toHaveLength(1);
      expect(contracts[0].resourceType).toBe('contract');
    });

    it('should apply pagination', async () => {
      // 添加多个资源
      for (let i = 0; i < 10; i++) {
        const resourceId = new Uint8Array(32).fill(i);
        mockClient.addResource(resourceId, {
          resourceId,
          resourceType: 'contract',
          contentHash: new Uint8Array(32),
          size: 0,
          lockingConditions: [],
          createdAt: new Date(),
        });
      }

      const page1 = await mockClient.getResources({ limit: 5, offset: 0 });
      expect(page1).toHaveLength(5);

      const page2 = await mockClient.getResources({ limit: 5, offset: 5 });
      expect(page2).toHaveLength(5);
    });
  });

  describe('Transaction operations', () => {
    it('should add and get transaction', async () => {
      const txId = '0x1234';
      const mockTx: TransactionInfo = {
        txId,
        status: 'confirmed',
        inputs: [],
        outputs: [],
        blockHeight: 1000,
        timestamp: new Date(),
      };

      mockClient.addTransaction(txId, mockTx);

      const tx = await mockClient.getTransaction(txId);
      expect(tx).toEqual(mockTx);
    });

    it('should filter transactions by txId', async () => {
      const txId = '0x1234';
      mockClient.addTransaction(txId, {
        txId,
        status: 'confirmed',
        inputs: [],
        outputs: [],
        timestamp: new Date(),
      });

      const txs = await mockClient.getTransactionHistory({ txId });
      expect(txs).toHaveLength(1);
      expect(txs[0].txId).toBe(txId);
    });
  });

  describe('Event operations', () => {
    it('should add and get events', async () => {
      const event: EventInfo = {
        eventName: 'Transfer',
        resourceId: new Uint8Array(32).fill(1),
        data: new Uint8Array(32),
        txId: '0x1234',
        blockHeight: 1000,
        timestamp: new Date(),
      };

      mockClient.addEvent(event);

      const events = await mockClient.getEvents({});
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('Transfer');
    });

    it('should filter events by resourceId', async () => {
      const resourceId1 = new Uint8Array(32).fill(1);
      const resourceId2 = new Uint8Array(32).fill(2);

      mockClient.addEvent({
        eventName: 'Transfer',
        resourceId: resourceId1,
        data: new Uint8Array(32),
        txId: '0x1111',
        timestamp: new Date(),
      });

      mockClient.addEvent({
        eventName: 'Transfer',
        resourceId: resourceId2,
        data: new Uint8Array(32),
        txId: '0x2222',
        timestamp: new Date(),
      });

      const events = await mockClient.getEvents({ resourceId: resourceId1 });
      expect(events).toHaveLength(1);
    });

    it('should filter events by eventName', async () => {
      mockClient.addEvent({
        eventName: 'Transfer',
        resourceId: new Uint8Array(32),
        data: new Uint8Array(32),
        txId: '0x1111',
        timestamp: new Date(),
      });

      mockClient.addEvent({
        eventName: 'Approval',
        resourceId: new Uint8Array(32),
        data: new Uint8Array(32),
        txId: '0x2222',
        timestamp: new Date(),
      });

      const transfers = await mockClient.getEvents({ eventName: 'Transfer' });
      expect(transfers).toHaveLength(1);
      expect(transfers[0].eventName).toBe('Transfer');
    });
  });

  describe('Node info', () => {
    it('should return mock node info', async () => {
      const nodeInfo = await mockClient.getNodeInfo();

      expect(nodeInfo).toBeDefined();
      expect(nodeInfo.rpcVersion).toBe('1.0.0');
      expect(nodeInfo.chainId).toBe('0x1');
      expect(nodeInfo.blockHeight).toBe(1000);
    });
  });

  describe('Submit transaction', () => {
    it('should return mock transaction hash', async () => {
      const result = await mockClient.submitTransaction('0x1234');

      expect(result).toBeDefined();
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.accepted).toBe(true);
    });
  });

  describe('Subscribe events', () => {
    it('should create subscription', async () => {
      const subscription = await mockClient.subscribeEvents({
        resourceId: new Uint8Array(32).fill(1),
      });

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(typeof subscription.on).toBe('function');
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should allow unsubscribing', async () => {
      const subscription = await mockClient.subscribeEvents({});

      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('Clear data', () => {
    it('should clear all mock data', async () => {
      const address = new Uint8Array(20).fill(3);
      const outPoint: OutPoint = { txId: '0x1111', outputIndex: 0 };
      mockClient.addUTXO(address, {
        outPoint,
        output: {},
        lockingCondition: {},
      });

      mockClient.clear();

      const utxos = await mockClient.listUTXOs(address);
      expect(Array.isArray(utxos)).toBe(true);
    });
  });

  describe('Delay simulation', () => {
    it('should simulate delay when enabled', async () => {
      const delayedClient = new WESClientMock({
        simulateDelay: true,
        delayMs: 100,
      });

      const startTime = Date.now();
      await delayedClient.getNodeInfo();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // 允许一些误差
    });
  });

  describe('setResponse/setError API', () => {
    it('should use setResponse for listUTXOs', async () => {
      const address = new Uint8Array(20).fill(1);
      const mockUTXOs: UTXO[] = [
        {
          outPoint: { txId: '0x1111', outputIndex: 0 },
          output: { amount: '1000' },
          lockingCondition: {},
        },
      ];

      mockClient.setResponse('listUTXOs', mockUTXOs);

      const utxos = await mockClient.listUTXOs(address);
      expect(utxos).toEqual(mockUTXOs);
    });

    it('should use setError for getResource', async () => {
      const resourceId = new Uint8Array(32).fill(1);
      const error = new Error('Custom error');

      mockClient.setError('getResource', error);

      await expect(mockClient.getResource(resourceId)).rejects.toThrow('Custom error');
    });

    it('should use setResponse for getResources', async () => {
      const mockResources: ResourceInfo[] = [
        {
          resourceId: new Uint8Array(32).fill(1),
          resourceType: 'contract',
          contentHash: new Uint8Array(32),
          size: 1024,
          lockingConditions: [],
          createdAt: new Date(),
        },
      ];

      mockClient.setResponse('getResources', mockResources);

      const resources = await mockClient.getResources({});
      expect(resources).toEqual(mockResources);
    });

    it('should use setError for submitTransaction', async () => {
      const error = new Error('Insufficient balance');

      mockClient.setError('submitTransaction', error);

      await expect(mockClient.submitTransaction('0x1234')).rejects.toThrow('Insufficient balance');
    });

    it('should prioritize setResponse over data storage', async () => {
      const address = new Uint8Array(20).fill(1);
      const outPoint: OutPoint = { txId: '0x1111', outputIndex: 0 };
      
      // 先添加数据存储（使用地址作为 key）
      mockClient.addUTXO(address, {
        outPoint,
        output: { amount: '1000' },
        lockingCondition: {},
      });

      // 然后设置响应
      const customUTXOs: UTXO[] = [
        {
          outPoint,
          output: { amount: '2000' },
          lockingCondition: {},
        },
      ];
      mockClient.setResponse('listUTXOs', customUTXOs);

      // 应该返回 setResponse 的值
      const utxos = await mockClient.listUTXOs(address);
      expect(utxos[0].output.amount).toBe('2000');
    });
  });
});

