// Package cache provides memory/Redis caches with business-safe fallback behavior.
package cache

import (
	"log"
	"log/slog"
	"os"
	"sync"
	"time"
)

var (
	globalCache   Cache
	globalCacheMu sync.RWMutex
)

// Init 初始化缓存
func Init() error {
	globalCacheMu.Lock()
	defer globalCacheMu.Unlock()
	previous := globalCache
	globalCache = newConfiguredCache()
	closeCache(previous)
	return nil
}

func newConfiguredCache() Cache {
	// 检查是否配置了Redis
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr != "" {
		// 使用Redis缓存
		redisPassword := os.Getenv("REDIS_PASSWORD")
		redisCache := NewRedisCache(redisAddr, redisPassword, 0)

		// 测试连接
		if err := redisCache.Set("_health_check", []byte("ok"), 10*time.Second); err != nil {
			log.Printf("Redis连接失败，降级到内存缓存: %v", err)
			closeCache(redisCache)
			return NewMemoryCache()
		}
		if err := redisCache.Delete("_health_check"); err != nil {
			slog.Debug("Unable to remove Redis health check entry", "error", err)
		}
		return redisCache
	}
	return NewMemoryCache()
}

// GetCache 获取全局缓存实例
func GetCache() Cache {
	globalCacheMu.RLock()
	current := globalCache
	globalCacheMu.RUnlock()
	if current != nil {
		return current
	}
	globalCacheMu.Lock()
	defer globalCacheMu.Unlock()
	if globalCache == nil {
		globalCache = newConfiguredCache()
	}
	return globalCache
}

// Close releases the current cache without creating one during shutdown.
func Close() {
	globalCacheMu.Lock()
	defer globalCacheMu.Unlock()
	closeCache(globalCache)
	globalCache = nil
}

func closeCache(current Cache) {
	if memory, ok := current.(*MemoryCache); ok {
		memory.Stop()
	} else if redis, ok := current.(*RedisCache); ok {
		if err := redis.Close(); err != nil {
			slog.Debug("Unable to close Redis cache", "error", err)
		}
	}
}

// Get 获取缓存（便捷方法）
func Get(key string) ([]byte, error) {
	return GetCache().Get(key)
}

// Set 设置缓存（便捷方法）
func Set(key string, value []byte, ttl time.Duration) error {
	return GetCache().Set(key, value, ttl)
}

// Delete 删除缓存（便捷方法）
func Delete(key string) error {
	return GetCache().Delete(key)
}
