package desktop

import (
	"bytes"
	"sync"
	"testing"
)

func TestAppIconManagerSwitchesAndDeduplicates(t *testing.T) {
	light := []byte("light-png")
	dark := []byte("dark-png")

	var applied [][]byte
	manager := NewAppIconManager(light, dark)
	manager.apply = func(icon []byte) {
		applied = append(applied, append([]byte(nil), icon...))
	}

	if err := manager.SetAppearance("dark"); err != nil {
		t.Fatalf("SetAppearance(dark) returned unexpected error: %v", err)
	}
	if manager.CurrentAppearance() != "dark" {
		t.Fatalf("expected current appearance dark, got %q", manager.CurrentAppearance())
	}
	if len(applied) != 1 || !bytes.Equal(applied[0], dark) {
		t.Fatalf("expected dark icon to be applied once, got %d calls", len(applied))
	}

	// Repeated identical appearance should be a no-op.
	if err := manager.SetAppearance("DARK"); err != nil {
		t.Fatalf("repeated SetAppearance(DARK) returned error: %v", err)
	}
	if len(applied) != 1 {
		t.Fatalf("expected duplicate appearance to be deduplicated, got %d calls", len(applied))
	}

	if err := manager.SetAppearance("light"); err != nil {
		t.Fatalf("SetAppearance(light) returned unexpected error: %v", err)
	}
	if len(applied) != 2 || !bytes.Equal(applied[1], light) {
		t.Fatalf("expected light icon on second switch, got %d calls", len(applied))
	}
}

func TestAppIconManagerRejectsInvalidAppearance(t *testing.T) {
	manager := NewAppIconManager([]byte("light"), []byte("dark"))
	called := false
	manager.apply = func([]byte) { called = true }

	if err := manager.SetAppearance("auto"); err == nil {
		t.Fatal("expected error for unresolved 'auto' appearance")
	}
	if err := manager.SetAppearance(""); err == nil {
		t.Fatal("expected error for empty appearance")
	}
	if called {
		t.Fatal("expected apply not to be called on invalid appearance")
	}
}

func TestAppIconManagerSkipsEmptyPayloadSafely(t *testing.T) {
	manager := NewAppIconManager(nil, nil)
	called := false
	manager.apply = func([]byte) { called = true }

	if err := manager.SetAppearance("dark"); err != nil {
		t.Fatalf("SetAppearance(dark) with nil payload returned error: %v", err)
	}
	if called {
		t.Fatal("expected empty icon payload not to call apply")
	}
}

func TestAppIconManagerConcurrentSafety(t *testing.T) {
	manager := NewAppIconManager([]byte("light"), []byte("dark"))
	manager.apply = func([]byte) {}

	var wg sync.WaitGroup
	for i := range 16 {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			mode := "light"
			if idx%2 == 1 {
				mode = "dark"
			}
			if err := manager.SetAppearance(mode); err != nil {
				t.Errorf("concurrent SetAppearance(%s) failed: %v", mode, err)
			}
			_ = manager.CurrentAppearance()
		}(i)
	}
	wg.Wait()
}
