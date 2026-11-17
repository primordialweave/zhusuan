// Package desktop provides services that are only bound to the desktop webview.
package desktop

import (
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"github.com/zalando/go-keyring"
)

const credentialService = "com.fruitsai.orange.login"

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
		return nil, nil
	}
	if err != nil {
		return nil, errors.New("读取已保存的登录信息失败")
	}
	var credentials LoginCredentials
	if json.Unmarshal([]byte(secret), &credentials) != nil ||
		credentials.Username == "" || credentials.Password == "" {
		return nil, errors.New("已保存的登录信息无效")
	}
	return &credentials, nil
}

// Save remembers a successfully authenticated login in the system keyring.
func (s *CredentialStore) Save(scope string, credentials LoginCredentials) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.TrimSpace(scope) == "" || credentials.Username == "" || credentials.Password == "" {
		return errors.New("登录服务标识、用户名和密码不能为空")
	}
	secret, err := json.Marshal(credentials)
	if err != nil {
		return errors.New("保存登录信息失败")
	}
	if err := s.set(credentialService, scope, string(secret)); err != nil {
		return errors.New("保存登录信息失败，请检查系统凭据存储")
	}
	return nil
}

// Clear forgets only Orange's remembered login for the given API server.
func (s *CredentialStore) Clear(scope string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.TrimSpace(scope) == "" {
		return errors.New("登录服务标识不能为空")
	}
	if err := s.delete(credentialService, scope); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return errors.New("清除已保存的登录信息失败")
	}
	return nil
}
