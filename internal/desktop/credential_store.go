// Package desktop provides services that are only bound to the desktop webview.
package desktop

import (
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"github.com/zalando/go-keyring"
)

const (
	credentialService            = "org.primordialweave.zhusuan.login"
	legacyCredentialService      = "com.fruitsai.orange.login" // #nosec G101 -- Public Keychain namespace, not a secret.
	desktopCredentialScope       = "zhusuan-desktop/api/v1"    // #nosec G101 -- Public account scope, not a secret.
	legacyDesktopCredentialScope = "orange-desktop/api/v1"
)

// LoginCredentials contains the login details explicitly remembered on this device.
type LoginCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// CredentialStore stores one remembered login per API server in the system keyring.
// It is exposed through Wails bindings, never through the HTTP API.
type CredentialStore struct {
	mu     sync.Mutex
	get    func(string, string) (string, error)
	set    func(string, string, string) error
	delete func(string, string) error
}

// NewCredentialStore creates a store backed by the operating system credential manager.
func NewCredentialStore() *CredentialStore {
	return &CredentialStore{get: keyring.Get, set: keyring.Set, delete: keyring.Delete}
}

// Load retrieves the remembered login for the given API server, or nil if none exists.
func (s *CredentialStore) Load(scope string) (*LoginCredentials, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.TrimSpace(scope) == "" {
		return nil, errors.New("登录服务标识不能为空")
	}
	secret, err := s.get(credentialService, scope)
	if errors.Is(err, keyring.ErrNotFound) {
		return s.inheritLegacyCredential(scope)
	}
	if err != nil {
		return nil, errors.New("读取已保存的登录信息失败")
	}
	return decodeLoginCredentials(secret)
}

type credentialLocation struct{ service, scope string }

func inheritedCredentialLocations(scope string) []credentialLocation {
	legacyScope := scope
	if scope == desktopCredentialScope {
		legacyScope = legacyDesktopCredentialScope
	}
	locations := []credentialLocation{{legacyCredentialService, legacyScope}}
	if legacyScope != scope {
		// Also tolerate a partially migrated frontend/service from a development build.
		locations = []credentialLocation{{credentialService, legacyScope}, {legacyCredentialService, legacyScope}, {legacyCredentialService, scope}}
	}
	return locations
}

func decodeLoginCredentials(secret string) (*LoginCredentials, error) {
	var credentials LoginCredentials
	if json.Unmarshal([]byte(secret), &credentials) != nil || credentials.Username == "" || credentials.Password == "" {
		return nil, errors.New("已保存的登录信息无效")
	}
	return &credentials, nil
}

func (s *CredentialStore) inheritLegacyCredential(scope string) (*LoginCredentials, error) {
	for _, location := range inheritedCredentialLocations(scope) {
		secret, err := s.get(location.service, location.scope)
		if errors.Is(err, keyring.ErrNotFound) {
			continue
		}
		if err != nil {
			return nil, errors.New("读取已保存的登录信息失败")
		}
		credentials, err := decodeLoginCredentials(secret)
		if err != nil {
			return nil, err
		}
		// A current entry is authoritative, including one saved during the legacy read.
		if current, readErr := s.get(credentialService, scope); readErr == nil {
			return decodeLoginCredentials(current)
		} else if !errors.Is(readErr, keyring.ErrNotFound) {
			return nil, errors.New("读取已保存的登录信息失败")
		}
		if err = s.set(credentialService, scope, secret); err != nil {
			return nil, errors.New("迁移已保存的登录信息失败，旧记录已保留")
		}
		return credentials, nil
	}
	return nil, nil
}

// Save remembers a successfully authenticated login in the system keyring.
func (s *CredentialStore) Save(scope string, credentials LoginCredentials) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.TrimSpace(scope) == "" || credentials.Username == "" || credentials.Password == "" {
		return errors.New("登录服务标识、用户名和密码不能为空")
	}
	secret, err := json.Marshal(credentials) // #nosec G117 -- Explicitly remembered credentials go only to the OS keyring, never logs or HTTP responses.
	if err != nil {
		return errors.New("保存登录信息失败")
	}
	if err := s.set(credentialService, scope, string(secret)); err != nil {
		return errors.New("保存登录信息失败，请检查系统凭据存储")
	}
	return nil
}

// Clear forgets the current and inherited remembered login for this API server.
func (s *CredentialStore) Clear(scope string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.TrimSpace(scope) == "" {
		return errors.New("登录服务标识不能为空")
	}
	var failed bool
	locations := append([]credentialLocation{{credentialService, scope}}, inheritedCredentialLocations(scope)...)
	for _, location := range locations {
		if err := s.delete(location.service, location.scope); err != nil && !errors.Is(err, keyring.ErrNotFound) {
			failed = true
		}
	}
	if failed {
		return errors.New("清除已保存的登录信息失败")
	}
	return nil
}
