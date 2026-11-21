package config

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/joho/godotenv"
)

func TestEnvironmentExampleUsesManagedPathsAndCurrentRepository(t *testing.T) {
	example, err := os.ReadFile(filepath.Join("..", "..", ".env.example"))
	if err != nil {
		t.Fatal(err)
	}
	values, err := godotenv.Unmarshal(string(example))
	if err != nil {
		t.Fatal(err)
	}
	for key := range values {
		t.Setenv(key, "")
		if err := os.Unsetenv(key); err != nil {
			t.Fatal(err)
		}
	}
	root := t.TempDir()
	t.Chdir(root)
	t.Setenv("ZHUSUAN_CONFIG_ROOT", filepath.Join(root, "config"))
	t.Setenv("JWT_SECRET", "example-test-secret-with-more-than-32-characters")
	if err := os.WriteFile(".env", example, 0o600); err != nil {
		t.Fatal(err)
	}
	previous := AppConfig
	t.Cleanup(func() { AppConfig = previous })

	Load()

	directory := filepath.Join(root, "config", "primordialweave", "zhusuan")
	if AppConfig.DBPath != filepath.Join(directory, "zhusuan.db") {
		t.Fatalf("example database path = %q; want the managed user database", AppConfig.DBPath)
	}
	if AppConfig.LogPath != filepath.Join(directory, "log", "zhusuan.log") {
		t.Fatalf("example log path = %q; want the managed user log", AppConfig.LogPath)
	}
	if AppConfig.GitHubRepo != "primordialweave/zhusuan" || AppConfig.DBName != "zhusuan" {
		t.Fatalf("example uses outdated app identity: repository=%q, database=%q", AppConfig.GitHubRepo, AppConfig.DBName)
	}
}

func TestLoadAppSloganFromEnvironmentAndDotEnv(t *testing.T) {
	for _, tc := range []struct {
		name, environment, dotenv, want string
		unset                           bool
	}{
		{name: "unset", unset: true, want: DefaultAppSlogan},
		{name: "empty", want: DefaultAppSlogan},
		{name: "whitespace", environment: " \t\n ", want: DefaultAppSlogan},
		{name: "custom", environment: "  每笔收款，清晰有序  ", want: "每笔收款，清晰有序"},
		{name: "dotenv", unset: true, dotenv: "APP_SLOGAN=\"认真记账，从容经营\"\n", want: "认真记账，从容经营"},
		{name: "environment takes precedence", environment: "环境变量介绍", dotenv: "APP_SLOGAN=\"文件介绍\"\n", want: "环境变量介绍"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			t.Chdir(root)
			t.Setenv("ZHUSUAN_CONFIG_ROOT", filepath.Join(root, "config"))
			t.Setenv("JWT_SECRET", "slogan-test-secret-with-more-than-32-characters")
			t.Setenv("ENV", "development")
			t.Setenv("DB_PATH", filepath.Join(root, "slogan-test.db"))
			t.Setenv("APP_SLOGAN", tc.environment)
			if tc.unset {
				if err := os.Unsetenv("APP_SLOGAN"); err != nil {
					t.Fatal(err)
				}
			}
			if tc.dotenv != "" {
				if err := os.WriteFile(filepath.Join(root, ".env"), []byte(tc.dotenv), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			previous := AppConfig
			t.Cleanup(func() { AppConfig = previous })

			Load()

			if AppConfig.AppSlogan != tc.want {
				t.Fatalf("AppSlogan = %q, want %q", AppConfig.AppSlogan, tc.want)
			}
		})
	}
}

func TestLoadWeChatPublicAccountFromEnvironmentAndDotEnv(t *testing.T) {
	for _, tc := range []struct {
		name, environment, dotenv, want string
		unset                           bool
	}{
		{name: "unset", unset: true, want: DefaultWeChatPublicAccount},
		{name: "empty", want: DefaultWeChatPublicAccount},
		{name: "whitespace", environment: " \t\n ", want: DefaultWeChatPublicAccount},
		{name: "custom", environment: "  我们的公众号  ", want: "我们的公众号"},
		{name: "dotenv", unset: true, dotenv: "APP_WECHAT_PUBLIC_ACCOUNT=\"文件公众号\"\n", want: "文件公众号"},
		{name: "environment takes precedence", environment: "环境公众号", dotenv: "APP_WECHAT_PUBLIC_ACCOUNT=\"文件公众号\"\n", want: "环境公众号"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			t.Chdir(root)
			t.Setenv("ZHUSUAN_CONFIG_ROOT", filepath.Join(root, "config"))
			t.Setenv("JWT_SECRET", "wechat-test-secret-with-more-than-32-characters")
			t.Setenv("ENV", "development")
			t.Setenv("DB_PATH", filepath.Join(root, "wechat-test.db"))
			t.Setenv("APP_WECHAT_PUBLIC_ACCOUNT", tc.environment)
			if tc.unset {
				if err := os.Unsetenv("APP_WECHAT_PUBLIC_ACCOUNT"); err != nil {
					t.Fatal(err)
				}
			}
			if tc.dotenv != "" {
				if err := os.WriteFile(filepath.Join(root, ".env"), []byte(tc.dotenv), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			previous := AppConfig
			t.Cleanup(func() { AppConfig = previous })
			Load()
			if AppConfig.WeChatPublicAccount != tc.want {
				t.Fatalf("WeChatPublicAccount = %q, want %q", AppConfig.WeChatPublicAccount, tc.want)
			}
		})
	}
}

func TestLoadIncludesWebDeploymentURLs(t *testing.T) {
	t.Setenv("ZHUSUAN_CONFIG_ROOT", t.TempDir())
	t.Setenv("JWT_SECRET", "orange-dev-secret-32-characters-long")
	t.Setenv("FRONTEND_URL", "https://orange.example.com")
	t.Setenv("API_BASE_URL", "https://api.orange.example.com")
	t.Setenv("ALLOWED_ORIGINS", "")

	Load()

	if AppConfig.FrontendURL != "https://orange.example.com" {
		t.Fatalf("FrontendURL = %q", AppConfig.FrontendURL)
	}
	if AppConfig.APIBaseURL != "https://api.orange.example.com" {
		t.Fatalf("APIBaseURL = %q", AppConfig.APIBaseURL)
	}
	if !slices.Contains(AppConfig.AllowedOrigins, "https://orange.example.com") {
		t.Fatalf("AllowedOrigins = %#v, want frontend URL included", AppConfig.AllowedOrigins)
	}
}

func TestValidateProductionDatabasePolicyRejectsServerSQLite(t *testing.T) {
	cfg := &Config{RuntimeMode: "server", DBType: "sqlite"}

	err := validateProductionDatabasePolicy(cfg, "production", false)
	if err == nil {
		t.Fatal("expected production server sqlite policy error")
	}
}

func TestValidateProductionDatabasePolicyAllowsDesktopSQLite(t *testing.T) {
	cfg := &Config{RuntimeMode: "desktop", DBType: "sqlite"}

	if err := validateProductionDatabasePolicy(cfg, "production", false); err != nil {
		t.Fatalf("unexpected desktop sqlite policy error: %v", err)
	}
}

func TestValidateProductionDatabasePolicyAllowsExplicitSQLiteOverride(t *testing.T) {
	cfg := &Config{RuntimeMode: "server", DBType: "sqlite"}

	if err := validateProductionDatabasePolicy(cfg, "production", true); err != nil {
		t.Fatalf("unexpected override policy error: %v", err)
	}
}
