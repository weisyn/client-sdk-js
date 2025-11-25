/**
 * 批量操作工具
 *
 * 提供批量查询、批量操作等功能，提升性能
 */

/**
 * 批量操作配置
 */
export interface BatchConfig {
  /** 批量大小 */
  batchSize?: number;
  /** 并发数量 */
  concurrency?: number;
  /** 进度回调 */
  onProgress?: (progress: BatchProgress) => void;
}

/**
 * 批量操作进度
 */
export interface BatchProgress {
  /** 已完成数量 */
  completed: number;
  /** 总数量 */
  total: number;
  /** 进度百分比（0-100） */
  percentage: number;
  /** 成功数量 */
  success: number;
  /** 失败数量 */
  failed: number;
}

/**
 * 默认批量配置
 */
const DEFAULT_BATCH_CONFIG: Required<Omit<BatchConfig, "onProgress">> = {
  batchSize: 50,
  concurrency: 5,
};

/**
 * 批量查询结果
 */
export interface BatchQueryResult<T> {
  /** 成功的结果 */
  results: T[];
  /** 失败的项目 */
  errors: Array<{ index: number; error: Error }>;
  /** 总数量 */
  total: number;
  /** 成功数量 */
  success: number;
  /** 失败数量 */
  failed: number;
}

/**
 * 将数组分批次处理
 */
export function batchArray<T>(
  array: T[],
  batchSize: number = DEFAULT_BATCH_CONFIG.batchSize
): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * 批量查询
 *
 * @param items 要查询的项目列表
 * @param queryFn 查询函数
 * @param config 配置
 */
export async function batchQuery<T, R>(
  items: T[],
  queryFn: (item: T, index: number) => Promise<R>,
  config: BatchConfig = {}
): Promise<BatchQueryResult<R>> {
  const {
    batchSize = DEFAULT_BATCH_CONFIG.batchSize,
    concurrency = DEFAULT_BATCH_CONFIG.concurrency,
    onProgress,
  } = config;

  const results: R[] = [];
  const errors: Array<{ index: number; error: Error }> = [];
  let completed = 0;
  let success = 0;
  let failed = 0;

  // 分批处理
  const batches = batchArray(items, batchSize);

  for (const batch of batches) {
    // 并发处理当前批次
    const batchPromises = batch.map(async (item, batchIndex) => {
      const globalIndex = batches.indexOf(batch) * batchSize + batchIndex;
      try {
        const result = await queryFn(item, globalIndex);
        results.push(result);
        success++;
        completed++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ index: globalIndex, error: err });
        failed++;
        completed++;
      } finally {
        if (onProgress) {
          onProgress({
            completed,
            total: items.length,
            percentage: Math.round((completed / items.length) * 100),
            success,
            failed,
          });
        }
      }
    });

    // 控制并发
    const executing: Promise<void>[] = [];
    for (const promise of batchPromises) {
      const p = promise.then(() => {
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }

  return {
    results,
    errors,
    total: items.length,
    success,
    failed,
  };
}

/**
 * 批量操作（带事务性保证）
 *
 * @param items 要操作的项目列表
 * @param operationFn 操作函数
 * @param config 配置
 */
export async function batchOperation<T, R>(
  items: T[],
  operationFn: (item: T, index: number) => Promise<R>,
  config: BatchConfig = {}
): Promise<BatchQueryResult<R>> {
  // 批量操作与批量查询类似，但可能需要事务性保证
  // 这里先使用相同的实现，后续可以根据需要添加事务性逻辑
  return batchQuery(items, operationFn, config);
}

/**
 * 并行执行多个操作
 */
export async function parallelExecute<T, R>(
  items: T[],
  executeFn: (item: T) => Promise<R>,
  concurrency: number = DEFAULT_BATCH_CONFIG.concurrency
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Promise<void>[] = [];

  const execute = async (item: T, index: number) => {
    try {
      const result = await executeFn(item);
      results[index] = result;
    } catch (error) {
      throw error;
    }
  };

  for (let i = 0; i < items.length; i++) {
    const promise = execute(items[i], i).then(() => {
      executing.splice(executing.indexOf(promise), 1);
    });
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}
