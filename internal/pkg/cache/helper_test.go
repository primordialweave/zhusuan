package cache

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

type invalidJSONCache struct{ deleted bool }

func (*invalidJSONCache) Get(string) ([]byte, error) { return []byte("not-json"), nil }
func (*invalidJSONCache) Set(string, []byte, time.Duration) error {
	return errors.New("cache unavailable")
}
func (cache *invalidJSONCache) Delete(string) error {
	cache.deleted = true
	return errors.New("cache unavailable")
}
func (*invalidJSONCache) Clear() error { return errors.New("cache unavailable") }

func TestGetJSONKeepsDecodeFailureWhenCleanupIsUnavailable(t *testing.T) {
	previous := globalCache
	cache := &invalidJSONCache{}
	globalCache = cache
	t.Cleanup(func() { globalCache = previous })
	var value map[string]string
	err := GetJSON("fixture", &value)
	var syntaxError *json.SyntaxError
	if !errors.As(err, &syntaxError) {
		t.Fatalf("corrupt JSON was not reported as a decode failure: %v", err)
	}
	if !cache.deleted {
		t.Fatal("corrupt cache cleanup was not attempted")
	}
}
