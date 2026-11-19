package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNativePreferenceMigrationEndpointIsPrivateOneShotAndNotCached(t *testing.T) {
	loads := 0
	handler := createAssetHandler(http.NotFoundHandler(), func() (map[string]string, error) {
		loads++
		return map[string]string{"theme": "dark", "lastUsername": "migration-fixture"}, nil
	})
	first := httptest.NewRecorder()
	handler.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/__zhusuan_migration__/preferences", nil))
	var preferences map[string]string
	if err := json.Unmarshal(first.Body.Bytes(), &preferences); err != nil {
		t.Fatal(err)
	}
	if first.Code != http.StatusOK || first.Header().Get("Cache-Control") != "no-store" || preferences["theme"] != "dark" {
		t.Fatal("migration preferences unavailable")
	}
	second := httptest.NewRecorder()
	handler.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/__zhusuan_migration__/preferences", nil))
	if second.Code != http.StatusGone || loads != 1 {
		t.Fatal("replayed one-shot migration")
	}
}
