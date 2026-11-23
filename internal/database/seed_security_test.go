package database

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/stretchr/testify/require"
)

type unavailableEntropy struct{}

func (unavailableEntropy) Read([]byte) (int, error) {
	return 0, errors.New("fixture entropy unavailable")
}

func TestInitialPasswordGenerationFailsWhenEntropyIsUnavailable(t *testing.T) {
	password, err := generateStrongPasswordFrom(unavailableEntropy{}, 16)
	require.Error(t, err)
	require.Empty(t, password)
	for _, length := range []int{0, 3, 16} {
		value, err := generateStrongPassword(length)
		if length < 4 {
			require.Error(t, err)
			continue
		}
		require.NoError(t, err)
		require.Len(t, value, length)
		require.True(t, strings.ContainsAny(value, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"))
		require.True(t, strings.ContainsAny(value, "abcdefghijklmnopqrstuvwxyz"))
		require.True(t, strings.ContainsAny(value, "0123456789"))
		require.True(t, strings.ContainsAny(value, "!@#$%^&*()-_=+[]{}|;:,.<>?"))
	}
}

func TestInitialCredentialsReplacePermissiveFileWithPrivateCompleteFile(t *testing.T) {
	previous := config.AppConfig
	root := t.TempDir()
	config.AppConfig = &config.Config{DataDir: root}
	t.Cleanup(func() { config.AppConfig = previous })
	path := filepath.Join(root, "initial-credentials.txt")
	require.NoError(t, os.WriteFile(path, []byte("old credentials"), 0o644))
	require.Equal(t, path, writeInitialCredentials("admin-fixture", "user-fixture"))
	contents, err := os.ReadFile(path)
	require.NoError(t, err)
	require.Equal(t, "admin: admin-fixture\nxu: user-fixture\n", string(contents))
	info, err := os.Stat(path)
	require.NoError(t, err)
	if runtime.GOOS != "windows" {
		require.Zero(t, info.Mode().Perm()&0o077)
	}
	stages, err := filepath.Glob(filepath.Join(root, ".initial-credentials-*"))
	require.NoError(t, err)
	require.Empty(t, stages)
}
