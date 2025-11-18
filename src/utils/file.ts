/**
 * 大文件处理工具
 * 
 * 提供流式处理和分块上传功能，优化大文件处理性能
 */

/**
 * 文件分块配置
 */
export interface ChunkConfig {
  /** 分块大小（字节） */
  chunkSize?: number;
  /** 并发上传数量 */
  concurrency?: number;
  /** 进度回调 */
  onProgress?: (progress: FileProgress) => void;
}

/**
 * 文件上传进度
 */
export interface FileProgress {
  /** 已处理字节数 */
  loaded: number;
  /** 总字节数 */
  total: number;
  /** 进度百分比（0-100） */
  percentage: number;
  /** 当前分块索引 */
  currentChunk?: number;
  /** 总分块数 */
  totalChunks?: number;
}

/**
 * 默认分块配置
 */
const DEFAULT_CHUNK_CONFIG: Required<Omit<ChunkConfig, 'onProgress'>> = {
  chunkSize: 1024 * 1024, // 1MB
  concurrency: 3, // 并发3个分块
};

// ChunkResult interface removed - not used

/**
 * 将文件分块
 */
export function chunkFile(
  data: Uint8Array,
  chunkSize: number = DEFAULT_CHUNK_CONFIG.chunkSize
): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 并发处理分块
 */
async function processChunksConcurrently<T>(
  chunks: Uint8Array[],
  processor: (chunk: Uint8Array, index: number) => Promise<T>,
  concurrency: number = DEFAULT_CHUNK_CONFIG.concurrency,
  onProgress?: (progress: FileProgress) => void
): Promise<T[]> {
  const results: T[] = new Array(chunks.length);
  const executing: Promise<void>[] = [];
  let completed = 0;

  const execute = async (chunk: Uint8Array, index: number) => {
    try {
      const result = await processor(chunk, index);
      results[index] = result;
      completed++;
      
      if (onProgress) {
        onProgress({
          loaded: completed * chunk.length,
          total: chunks.reduce((sum, c) => sum + c.length, 0),
          percentage: Math.round((completed / chunks.length) * 100),
          currentChunk: index + 1,
          totalChunks: chunks.length,
        });
      }
    } catch (error) {
      throw error;
    }
  };

  for (let i = 0; i < chunks.length; i++) {
    const promise = execute(chunks[i], i).then(() => {
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

/**
 * 流式读取文件（浏览器环境）
 */
export async function readFileAsStream(
  file: File,
  onChunk?: (chunk: Uint8Array, index: number) => void
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = file.stream().getReader();
  let index = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new Uint8Array(value);
      chunks.push(chunk);
      
      if (onChunk) {
        onChunk(chunk, index++);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // 合并所有分块
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * 分块处理文件
 * 
 * @param data 文件数据
 * @param processor 处理函数
 * @param config 配置
 */
export async function processFileInChunks<T>(
  data: Uint8Array,
  processor: (chunk: Uint8Array, index: number) => Promise<T>,
  config: ChunkConfig = {}
): Promise<T[]> {
  const {
    chunkSize = DEFAULT_CHUNK_CONFIG.chunkSize,
    concurrency = DEFAULT_CHUNK_CONFIG.concurrency,
    onProgress,
  } = config;

  // 如果文件小于分块大小，直接处理
  if (data.length <= chunkSize) {
    const result = await processor(data, 0);
    if (onProgress) {
      onProgress({
        loaded: data.length,
        total: data.length,
        percentage: 100,
        currentChunk: 1,
        totalChunks: 1,
      });
    }
    return [result];
  }

  // 分块处理
  const chunks = chunkFile(data, chunkSize);
  return processChunksConcurrently(chunks, processor, concurrency, onProgress);
}

/**
 * 估算文件处理时间
 */
export function estimateProcessingTime(
  fileSize: number,
  _chunkSize: number = DEFAULT_CHUNK_CONFIG.chunkSize,
  processingSpeed: number = 1024 * 1024 // 1MB/s
): number {
  const estimatedTime = fileSize / processingSpeed;
  return estimatedTime;
}

