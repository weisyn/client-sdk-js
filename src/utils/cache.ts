/**
 * 缓存层实现
 *
 * 提供轻量级的内存缓存，支持 TTL 过期策略
 */

/**
 * 缓存项
 */
interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 默认 TTL（毫秒） */
  defaultTTL?: number;
  /** 最大缓存项数量 */
  maxSize?: number;
}

/**
 * 缓存实现
 */
export class Cache<K, V> {
  private cache: Map<string, CacheItem<V>> = new Map();
  private defaultTTL: number;
  private maxSize: number;

  constructor(config: CacheConfig = {}) {
    this.defaultTTL = config.defaultTTL || 60000; // 默认 60 秒
    this.maxSize = config.maxSize || 1000; // 默认最多 1000 项
  }

  /**
   * 生成缓存键
   */
  private getKey(key: K): string {
    if (typeof key === "string") {
      return key;
    }
    if (key instanceof Uint8Array) {
      return Array.from(key)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    return JSON.stringify(key);
  }

  /**
   * 获取缓存值
   */
  get(key: K): V | undefined {
    const cacheKey = this.getKey(key);
    const item = this.cache.get(cacheKey);

    if (!item) {
      return undefined;
    }

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return item.value;
  }

  /**
   * 设置缓存值
   */
  set(key: K, value: V, ttl?: number): void {
    const cacheKey = this.getKey(key);
    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    // 如果超过最大大小，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, { value, expiresAt });
  }

  /**
   * 删除缓存项
   */
  delete(key: K): boolean {
    const cacheKey = this.getKey(key);
    return this.cache.delete(cacheKey);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    // 清理过期项
    this.cleanup();
    return this.cache.size;
  }

  /**
   * 清理过期项
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 检查是否存在
   */
  has(key: K): boolean {
    const cacheKey = this.getKey(key);
    const item = this.cache.get(cacheKey);

    if (!item) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }
}

/**
 * 带缓存的查询函数包装器
 *
 * @param cache 缓存实例
 * @param key 缓存键
 * @param queryFn 查询函数
 * @param ttl TTL（毫秒）
 */
export async function cachedQuery<T, K>(
  cache: Cache<K, T>,
  key: K,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 先检查缓存
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // 查询并缓存
  const value = await queryFn();
  cache.set(key, value, ttl);
  return value;
}
