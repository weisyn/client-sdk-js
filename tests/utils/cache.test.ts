/**
 * Cache 单元测试
 */

import { Cache, cachedQuery } from '../../src/utils/cache';

describe('Cache', () => {
  let cache: Cache<string, string>;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 1000 }); // 1 秒 TTL
  });

  describe('basic operations', () => {
    it('should set and get value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete value', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    it('should expire after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.has('key1')).toBe(false);
    });

    it('should use custom TTL', async () => {
      cache.set('key1', 'value1', 200);
      cache.set('key2', 'value2', 50);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('max size', () => {
    it('should respect max size', () => {
      const limitedCache = new Cache({ maxSize: 2 });
      limitedCache.set('key1', 'value1');
      limitedCache.set('key2', 'value2');
      limitedCache.set('key3', 'value3'); // 应该删除 key1

      expect(limitedCache.get('key1')).toBeUndefined();
      expect(limitedCache.get('key2')).toBe('value2');
      expect(limitedCache.get('key3')).toBe('value3');
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired items', async () => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      cache.cleanup();
      expect(cache.size()).toBe(1);
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('Uint8Array keys', () => {
    it('should handle Uint8Array keys', () => {
      const key = new Uint8Array([1, 2, 3]);
      cache.set(key, 'value1');
      expect(cache.get(key)).toBe('value1');
    });
  });
});

describe('cachedQuery', () => {
  let cache: Cache<string, string>;
  let queryCount: number;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 1000 });
    queryCount = 0;
  });

  it('should cache query results', async () => {
    const queryFn = async () => {
      queryCount++;
      return `result-${queryCount}`;
    };

    const result1 = await cachedQuery(cache, 'key1', queryFn);
    const result2 = await cachedQuery(cache, 'key1', queryFn);

    expect(result1).toBe('result-1');
    expect(result2).toBe('result-1'); // 应该使用缓存
    expect(queryCount).toBe(1); // 只查询一次
  });

  it('should respect custom TTL', async () => {
    const queryFn = async () => {
      queryCount++;
      return `result-${queryCount}`;
    };

    await cachedQuery(cache, 'key1', queryFn, 100);
    await cachedQuery(cache, 'key1', queryFn); // 使用缓存

    await new Promise((resolve) => setTimeout(resolve, 150));

    await cachedQuery(cache, 'key1', queryFn); // 应该重新查询
    expect(queryCount).toBe(2);
  });
});

