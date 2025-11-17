/**
 * Resource Service 集成测试
 * 
 * 需要真实节点运行才能执行
 */

import { ResourceService } from '../../src/services/resource/service';
import { Client } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  fundTestAccount,
  ensureNodeRunning,
  waitForTransactionConfirmation,
} from './setup';

describe('Resource Service Integration Tests', () => {
  let client: Client;
  let wallet: Wallet;
  let resourceService: ResourceService;

  beforeAll(async () => {
    await ensureNodeRunning();
  });

  beforeEach(async () => {
    client = await setupTestClient();
    wallet = await createTestWallet();
    await fundTestAccount(client, wallet.address);
    resourceService = new ResourceService(client, wallet);
  });

  afterEach(async () => {
    await teardownTestClient(client);
  });

  describe('DeployStaticResource', () => {
    it('should deploy static resource successfully', async () => {
      // 创建一个小的测试文件内容
      const fileContent = new Uint8Array([1, 2, 3, 4, 5]);
      const mimeType = 'application/octet-stream';

      const result = await resourceService.deployStaticResource({
        from: wallet.address,
        fileContent,
        mimeType,
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.resourceId).toBeDefined();
    }, 60000);
  });
});

