/**
 * WESClient 辅助工具函数
 */

import type { WESClient } from '../client/wesclient';
import type {
  OutPoint,
  UTXO,
  ResourceInfo,
  TransactionInfo,
  EventInfo,
} from '../client/wesclient-types';

/**
 * 从 UTXO 列表中查找特定 OutPoint 的 UTXO
 */
export function findUTXO(utxos: UTXO[], outPoint: OutPoint): UTXO | undefined {
  return utxos.find(
    (utxo) =>
      utxo.outPoint.txId === outPoint.txId &&
      utxo.outPoint.outputIndex === outPoint.outputIndex
  );
}

/**
 * 从资源列表中查找特定 resourceId 的资源
 */
export function findResource(
  resources: ResourceInfo[],
  resourceId: Uint8Array
): ResourceInfo | undefined {
  const resourceIdStr = Array.from(resourceId)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return resources.find((resource) => {
    const resourceIdStr2 = Array.from(resource.resourceId)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return resourceIdStr === resourceIdStr2;
  });
}

/**
 * 从交易列表中查找特定 txId 的交易
 */
export function findTransaction(
  transactions: TransactionInfo[],
  txId: string
): TransactionInfo | undefined {
  return transactions.find((tx) => tx.txId === txId);
}

/**
 * 从事件列表中过滤特定 resourceId 的事件
 */
export function filterEventsByResource(
  events: EventInfo[],
  resourceId: Uint8Array
): EventInfo[] {
  const resourceIdStr = Array.from(resourceId)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return events.filter((event) => {
    const eventResourceIdStr = Array.from(event.resourceId)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return resourceIdStr === eventResourceIdStr;
  });
}

/**
 * 从事件列表中过滤特定 eventName 的事件
 */
export function filterEventsByName(
  events: EventInfo[],
  eventName: string
): EventInfo[] {
  return events.filter((event) => event.eventName === eventName);
}

/**
 * 等待交易确认
 * 
 * @param client WESClient 实例
 * @param txId 交易 ID
 * @param maxWaitTime 最大等待时间（毫秒）
 * @param pollInterval 轮询间隔（毫秒）
 * @returns 确认的交易信息，如果超时则返回 null
 */
export async function waitForTransactionConfirmation(
  client: WESClient,
  txId: string,
  maxWaitTime: number = 60000,
  pollInterval: number = 1000
): Promise<TransactionInfo | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const tx = await client.getTransaction(txId);
      if (tx.status === 'confirmed') {
        return tx;
      }
      if (tx.status === 'failed') {
        throw new Error(`Transaction failed: ${txId}`);
      }
    } catch (error: any) {
      // 如果交易不存在，继续等待
      if (error.code !== 'NOT_FOUND') {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return null; // 超时
}

/**
 * 批量查询资源并返回映射
 * 
 * @param client WESClient 实例
 * @param resourceIds 资源 ID 列表
 * @returns Map<resourceId (hex string), ResourceInfo>
 */
export async function batchGetResourcesMap(
  client: WESClient,
  resourceIds: Uint8Array[]
): Promise<Map<string, ResourceInfo>> {
  const resources = await client.batchGetResources(resourceIds);
  const map = new Map<string, ResourceInfo>();

  resources.forEach((resource) => {
    const key = Array.from(resource.resourceId)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    map.set(key, resource);
  });

  return map;
}

/**
 * 通过地址查询 UTXO 并返回映射
 * 
 * @param client WESClient 实例
 * @param address 地址（20字节）
 * @returns Map<"txId:outputIndex", UTXO>
 */
export async function listUTXOsMap(
  client: WESClient,
  address: Uint8Array
): Promise<Map<string, UTXO>> {
  const utxos = await client.listUTXOs(address);
  const map = new Map<string, UTXO>();

  utxos.forEach((utxo) => {
    const key = `${utxo.outPoint.txId}:${utxo.outPoint.outputIndex}`;
    map.set(key, utxo);
  });

  return map;
}

/**
 * 检查资源是否存在
 */
export async function resourceExists(
  client: WESClient,
  resourceId: Uint8Array
): Promise<boolean> {
  try {
    await client.getResource(resourceId);
    return true;
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return false;
    }
    throw error;
  }
}

/**
 * 检查交易是否存在
 */
export async function transactionExists(
  client: WESClient,
  txId: string
): Promise<boolean> {
  try {
    await client.getTransaction(txId);
    return true;
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return false;
    }
    throw error;
  }
}

