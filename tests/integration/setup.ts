/**
 * 集成测试设置
 * 
 * 提供与真实节点连接的测试工具函数
 */

import { ClientConfig, createClient, IClient } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';

/**
 * 默认节点端点
 */
export const DEFAULT_NODE_ENDPOINT = process.env.WES_NODE_ENDPOINT || 'http://localhost:8080/jsonrpc';

/**
 * 默认超时时间（毫秒）
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * 交易确认超时时间（毫秒）
 */
export const TRANSACTION_CONFIRM_TIMEOUT = 60000;

/**
 * 交易确认轮询间隔（毫秒）
 */
export const TRANSACTION_CONFIRM_INTERVAL = 2000;

/**
 * 测试配置
 */
export interface TestConfig {
  nodeEndpoint?: string;
  timeout?: number;
}

/**
 * 默认测试配置
 */
export function defaultTestConfig(): Required<TestConfig> {
  return {
    nodeEndpoint: DEFAULT_NODE_ENDPOINT,
    timeout: DEFAULT_TIMEOUT,
  };
}

/**
 * 设置测试客户端
 * 
 * @param config 测试配置
 * @returns 客户端实例
 */
export async function setupTestClient(config?: TestConfig): Promise<IClient> {
  const cfg = { ...defaultTestConfig(), ...config };
  
  const clientConfig: ClientConfig = {
    endpoint: cfg.nodeEndpoint,
    protocol: 'http',
    timeout: cfg.timeout,
    debug: false,
  };

  const client = createClient(clientConfig);

  // 验证节点是否运行
  try {
    await client.call('wes_blockNumber', []);
  } catch (error) {
    throw new Error(
      `节点未运行，请先启动节点: ${cfg.nodeEndpoint}\n` +
      `启动命令: cd /Users/qinglong/go/src/chaincodes/WES/weisyn.git && bash scripts/testing/common/test_init.sh`
    );
  }

  return client;
}

/**
 * 清理测试客户端
 * 
 * @param client 客户端实例
 */
export async function teardownTestClient(client: IClient): Promise<void> {
  if (client) {
    await client.close();
  }
}

/**
 * 创建测试钱包
 * 
 * @returns 钱包实例
 */
export async function createTestWallet(): Promise<Wallet> {
  return await Wallet.create();
}

/**
 * 从私钥创建测试钱包
 * 
 * @param privateKeyHex 私钥（十六进制）
 * @returns 钱包实例
 */
export async function createTestWalletFromPrivateKey(privateKeyHex: string): Promise<Wallet> {
  return await Wallet.fromPrivateKey(privateKeyHex);
}

/**
 * 为测试账户充值（通过挖矿）
 * 
 * @param client 客户端实例
 * @param address 地址（20 字节）
 * @param amount 金额（可选，实际通过挖矿获得）
 */
export async function fundTestAccount(
  client: IClient,
  address: Uint8Array,
  _amount?: bigint
): Promise<void> {
  // TODO: 实现账户充值功能
  // 将地址转换为 Base58 格式
  const { addressBytesToBase58 } = await import('../../src/utils/address');
  const addressBase58 = addressBytesToBase58(address);

  // 1. 尝试停止当前挖矿（忽略错误）
  try {
    await client.call('wes_stopMining', []);
  } catch (error) {
    // 忽略错误
  }

  // 2. 使用当前地址启动挖矿
  await client.call('wes_startMining', [addressBase58]);

  // 3. 等待区块生成并确认 UTXO 可用
  const maxWait = 10000; // 10秒
  const checkInterval = 500; // 500ms
  const deadline = Date.now() + maxWait;

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    
    try {
      const result = await client.call('wes_getUTXO', [addressBase58]) as any;
      if (result?.utxos && result.utxos.length > 0) {
        break; // UTXO 已可用
      }
    } catch (error) {
      // 继续等待
    }
  }

  // 4. 停止挖矿（忽略错误）
  try {
    await client.call('wes_stopMining', []);
  } catch (error) {
    // 忽略错误
  }
}

/**
 * 查询测试账户余额
 * 
 * @param client 客户端实例
 * @param address 地址（20 字节）
 * @param tokenId 代币 ID（null 表示原生币）
 * @returns 余额
 */
export async function getTestAccountBalance(
  client: IClient,
  address: Uint8Array,
  tokenId: Uint8Array | null = null
): Promise<bigint> {
  const { addressBytesToBase58 } = await import('../../src/utils/address');
  const addressBase58 = addressBytesToBase58(address);

  const result = await client.call('wes_getUTXO', [addressBase58]) as any;
  
  if (!result?.utxos) {
    return BigInt(0);
  }

  // 汇总金额
  let totalAmount = BigInt(0);
  for (const utxo of result.utxos) {
    // 检查 tokenID 是否匹配
    if (tokenId !== null) {
      const utxoTokenId = utxo.token_id;
      const expectedTokenIdHex = '0x' + Array.from(tokenId)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      if (utxoTokenId !== expectedTokenIdHex) {
        continue;
      }
    } else {
      // nil tokenID 表示原生币
      const utxoTokenId = utxo.token_id;
      if (utxoTokenId && utxoTokenId !== '0x' && utxoTokenId !== '') {
        continue;
      }
    }

    // 提取金额（amount 为十进制字符串）
    const amountStr = utxo.amount;
    if (amountStr) {
      totalAmount += BigInt(amountStr);
    }
  }

  return totalAmount;
}

/**
 * 确保节点运行
 * 
 * @throws 如果节点未运行
 */
export async function ensureNodeRunning(config?: TestConfig): Promise<void> {
  const cfg = { ...defaultTestConfig(), ...config };
  
  const clientConfig: ClientConfig = {
    endpoint: cfg.nodeEndpoint,
    protocol: 'http',
    timeout: 5000,
    debug: false,
  };

  const client = createClient(clientConfig);
  
  try {
    await client.call('wes_blockNumber', []);
  } catch (error) {
    await client.close();
    throw new Error(
      `节点未运行，请先启动节点: ${cfg.nodeEndpoint}\n` +
      `启动命令: cd /Users/qinglong/go/src/chaincodes/WES/weisyn.git && bash scripts/testing/common/test_init.sh`
    );
  } finally {
    await client.close();
  }
}

/**
 * 等待交易确认
 * 
 * @param client 客户端实例
 * @param txHash 交易哈希
 * @param timeout 超时时间（毫秒）
 * @returns 是否确认成功
 */
export async function waitForTransactionConfirmation(
  client: IClient,
  txHash: string,
  timeout: number = TRANSACTION_CONFIRM_TIMEOUT
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  const interval = TRANSACTION_CONFIRM_INTERVAL;

  while (Date.now() < deadline) {
    try {
      const result = await client.call('wes_getTransactionByHash', [txHash]) as any;
      if (result && result.block_number) {
        return true; // 交易已确认
      }
    } catch (error) {
      // 继续等待
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false; // 超时
}

