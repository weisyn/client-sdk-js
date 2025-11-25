/**
 * 批量查询 Helper
 *
 * 基于 utils/batch 实现可控并发的批量查询
 * 支持错误处理和重试机制
 */

import { batchQuery, BatchConfig, BatchQueryResult } from "./batch";
import type { WESClient } from "../client/wesclient";
import type { ResourceInfo } from "../client/wesclient-types";

/**
 * 批量查询资源配置
 */
export interface BatchGetResourcesConfig extends BatchConfig {
  /** 是否忽略错误（部分失败不影响整体） */
  ignoreErrors?: boolean;
}

/**
 * 批量查询资源
 *
 * 使用 utils/batch 进行可控并发的批量查询
 *
 * @param client WESClient 实例
 * @param resourceIds 资源 ID 列表
 * @param config 配置选项
 * @returns 批量查询结果
 */
export async function batchGetResourcesHelper(
  client: WESClient,
  resourceIds: Uint8Array[],
  config: BatchGetResourcesConfig = {}
): Promise<BatchQueryResult<ResourceInfo>> {
  const { ignoreErrors: _ignoreErrors = true, ...batchConfig } = config;

  return batchQuery(
    resourceIds,
    async (resourceId) => {
      return await client.getResource(resourceId);
    },
    {
      concurrency: 5, // 默认并发数
      batchSize: 50, // 默认批次大小
      ...batchConfig,
    }
  );
}

/**
 * 批量查询资源（简化版本，返回成功的结果数组）
 *
 * @param client WESClient 实例
 * @param resourceIds 资源 ID 列表
 * @param config 配置选项
 * @returns 资源数组（仅包含成功的结果）
 */
export async function batchGetResourcesSimple(
  client: WESClient,
  resourceIds: Uint8Array[],
  config: BatchGetResourcesConfig = {}
): Promise<ResourceInfo[]> {
  const result = await batchGetResourcesHelper(client, resourceIds, config);
  return result.results;
}
