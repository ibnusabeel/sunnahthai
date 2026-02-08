import { LRUCache } from 'lru-cache';

// Options for LRU Cache
const options = {
    max: 500, // Maximum number of items
    ttl: 1000 * 60 * 60, // 1 hour TTL by default
    allowStale: false,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
};

// Create Cache Instance
const cache = new LRUCache(options);

export class CacheService {
    /**
     * Get item from cache
     */
    static get<T>(key: string): T | undefined {
        return cache.get(key) as T;
    }

    /**
     * Set item in cache
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Time to live in milliseconds (optional, defaults to 1 hour)
     */
    static set(key: string, value: any, ttl?: number): void {
        cache.set(key, value, { ttl });
    }

    /**
     * Delete item from cache
     */
    static del(key: string): void {
        cache.delete(key);
    }

    /**
     * Clear all cache
     */
    static flush(): void {
        cache.clear();
    }

    /**
     * Generate a standard cache key
     */
    static generateKey(prefix: string, params: Record<string, any>): string {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}:${params[key]}`)
            .join('|');
        return `${prefix}:${sortedParams}`;
    }
}
