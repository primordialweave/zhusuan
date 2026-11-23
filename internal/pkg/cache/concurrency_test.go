package cache

import (
	"sync"
	"testing"
	"time"
)

func TestMemoryCacheOwnsStoredAndReturnedBytes(t *testing.T) {
	c := NewMemoryCache()
	defer c.Stop()
	input := []byte("1:admin")
	if err := c.Set("auth", input, time.Minute); err != nil {
		t.Fatal(err)
	}
	input[0] = '0'
	first, err := c.Get("auth")
	if err != nil {
		t.Fatal(err)
	}
	if string(first) != "1:admin" {
		t.Fatal("caller changed the stored cache entry")
	}
	first[0] = '0'
	second, err := c.Get("auth")
	if err != nil {
		t.Fatal(err)
	}
	if string(second) != "1:admin" {
		t.Fatal("returned bytes changed the shared cache entry")
	}
}

func TestConcurrentFirstGetUsesOneCacheAndShutdownIsIdempotent(t *testing.T) {
	t.Setenv("REDIS_ADDR", "")
	globalCacheMu.Lock()
	previous := globalCache
	globalCache = nil
	globalCacheMu.Unlock()
	t.Cleanup(func() {
		Close()
		globalCacheMu.Lock()
		globalCache = previous
		globalCacheMu.Unlock()
	})
	const workers = 32
	results := make(chan Cache, workers)
	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() { defer wg.Done(); results <- GetCache() }()
	}
	wg.Wait()
	close(results)
	first := <-results
	for result := range results {
		if result != first {
			t.Fatal("concurrent initialization created different caches")
		}
	}
	for range workers {
		wg.Add(1)
		go func() { defer wg.Done(); first.(*MemoryCache).Stop() }()
	}
	wg.Wait()
	Close()
	Close()
}
