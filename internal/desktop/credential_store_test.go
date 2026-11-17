package desktop

import (
	"errors"
	"testing"

	"github.com/zalando/go-keyring"
)

func memoryStore() *CredentialStore {
	secrets := make(map[string]string)
	return &CredentialStore{
		get: func(service, scope string) (string, error) {
			secret, ok := secrets[service+":"+scope]
			if !ok {
				return "", keyring.ErrNotFound
			}
			return secret, nil
		},
		set: func(service, scope, secret string) error {
			secrets[service+":"+scope] = secret
			return nil
		},
		delete: func(service, scope string) error {
			delete(secrets, service+":"+scope)
			return nil
		},
	}
}

func TestCredentialStoreRememberAndForget(t *testing.T) {
	store := memoryStore()
	credentials := LoginCredentials{Username: "橙子@example.com", Password: "空 格'\"\n密码🍊"}
	got, err := store.Load("desktop")
	if err != nil || got != nil {
		t.Fatalf("empty store: got %v, %v", got, err)
	}
	if err := store.Save("desktop", credentials); err != nil {
		t.Fatal(err)
	}
	got, err = store.Load("desktop")
	if err != nil || got == nil || *got != credentials {
		t.Fatal("remembered credentials did not round-trip")
	}
	updated := LoginCredentials{Username: "other", Password: "updated-password"}
	if err := store.Save("desktop", updated); err != nil {
		t.Fatal(err)
	}
	got, err = store.Load("desktop")
	if err != nil || got == nil || *got != updated {
		t.Fatal("new login did not replace the previous remembered login")
	}
	if err := store.Clear("desktop"); err != nil {
		t.Fatal(err)
	}
	got, err = store.Load("desktop")
	if err != nil || got != nil {
		t.Fatal("forgotten credentials are still available")
	}
}

func TestCredentialStoreIsolatesServers(t *testing.T) {
	store := memoryStore()
	credentials := LoginCredentials{Username: "admin", Password: "test-password"}
	if err := store.Save("https://one.example/api/v1", credentials); err != nil {
		t.Fatal(err)
	}
	if err := store.Clear("https://two.example/api/v1"); err != nil {
		t.Fatal(err)
	}
	got, err := store.Load("https://two.example/api/v1")
	if err != nil || got != nil {
		t.Fatal("credentials crossed API server boundaries")
	}
	got, err = store.Load("https://one.example/api/v1")
	if err != nil || got == nil || *got != credentials {
		t.Fatal("clearing another server changed the saved login")
	}
}

func TestCredentialStoreErrors(t *testing.T) {
	store := memoryStore()
	if err := store.Save("", LoginCredentials{Username: "u", Password: "p"}); err == nil {
		t.Fatal("empty scope accepted")
	}
	if err := store.Save("desktop", LoginCredentials{Username: "u"}); err == nil {
		t.Fatal("empty password accepted")
	}
	if _, err := store.Load(" "); err == nil {
		t.Fatal("empty load scope accepted")
	}
	if err := store.Clear(""); err == nil {
		t.Fatal("empty clear scope accepted")
	}
	store.get = func(string, string) (string, error) { return "invalid-json", nil }
	if _, err := store.Load("desktop"); err == nil {
		t.Fatal("invalid saved credentials accepted")
	}
	store.get = func(string, string) (string, error) { return "", errors.New("private error") }
	if _, err := store.Load("desktop"); err == nil || err.Error() != "读取已保存的登录信息失败" {
		t.Fatal("read failure not reported safely")
	}
	store.set = func(string, string, string) error { return errors.New("private error") }
	if err := store.Save("desktop", LoginCredentials{Username: "u", Password: "p"}); err == nil {
		t.Fatal("write failure ignored")
	}
	store.delete = func(string, string) error { return errors.New("private error") }
	if err := store.Clear("desktop"); err == nil {
		t.Fatal("delete failure ignored")
	}
	store.delete = func(string, string) error { return keyring.ErrNotFound }
	if err := store.Clear("desktop"); err != nil {
		t.Fatal("forgetting an absent login must succeed")
	}
}
