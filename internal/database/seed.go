package database

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"os"
	"path/filepath"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/models"
)

// Seed 填充数据库初始数据
// 该函数在应用启动且数据库表为空时执行，用于预置管理员账号、字典数据等。
// 类似于 Rails 的 db:seed 或 Laravel 的 seeder。
func Seed(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return nil
	}

	slog.Info("Seeding database...")

	// Generate secrets before acquiring the transaction; only its winning writer may publish them.
	adminPassword, err := generateStrongPassword(16)
	if err != nil {
		return fmt.Errorf("生成初始管理员密码失败: %w", err)
	}
	userPassword, err := generateStrongPassword(16)
	if err != nil {
		return fmt.Errorf("生成初始用户密码失败: %w", err)
	}
	// 对密码进行 bcrypt 加密
	adminPasswordHash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	userPasswordHash, err := bcrypt.GenerateFromPassword([]byte(userPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	var credentialsPath string
	created := false
	err = db.Transaction(func(tx *gorm.DB) error {
		// Another startup may have seeded while these passwords were generated.
		// The username unique index also prevents concurrent cloud transactions from
		// reaching publication when both snapshots observed an empty users table.
		if err := tx.Model(&models.User{}).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return nil
		}
		// 1. 初始化用户数据 (Users)
		// 使用 GORM 模型创建，不显式指定自增主键 id，
		// 以保证在 PostgreSQL/MySQL 下自增序列正确前进，避免后续注册主键冲突。
		users := []models.User{
			{Username: "admin", Password: string(adminPasswordHash), Name: "管理员", Email: "admin@example.com", Phone: "13800000000", Role: "admin", Department: "技术部", Position: "系统管理员", Status: 1},
			{Username: "xu", Password: string(userPasswordHash), Name: "郑旭", Email: "xu@company.com", Phone: "13800000001", Role: "user", Department: "技术部", Position: "项目经理", Status: 1},
		}
		if err := tx.Create(&users).Error; err != nil {
			return err
		}

		// 2. 初始化字典数据 (Dictionaries)
		// 每个字典及其明细项通过关联(Items)一次性创建，字典项的 dictionary_id
		// 由 GORM 依据字典创建后分配的主键自动回填，无需硬编码外键。
		dictionaries := []models.Dictionary{
			{Code: "payment_stage", Name: "款项阶段", Status: 1, Items: []models.DictionaryItem{
				{Label: "首付款", Value: "deposit", Sort: 1, Status: 1},
				{Label: "进度款", Value: "progress", Sort: 2, Status: 1},
				{Label: "尾款", Value: "final", Sort: 3, Status: 1},
				{Label: "全款", Value: "all", Sort: 4, Status: 1},
			}},
			{Code: "payment_method", Name: "支付方式", Status: 1, Items: []models.DictionaryItem{
				{Label: "银行转账", Value: "bank_transfer", Sort: 1, Status: 1},
				{Label: "支付宝", Value: "alipay", Sort: 2, Status: 1},
				{Label: "微信支付", Value: "wechat", Sort: 3, Status: 1},
				{Label: "现金", Value: "cash", Sort: 4, Status: 1},
			}},
			{Code: "project_status", Name: "项目状态", Status: 1, Items: []models.DictionaryItem{
				{Label: "未开始", Value: "notstarted", Sort: 1, Status: 1},
				{Label: "进行中", Value: "active", Sort: 2, Status: 1},
				{Label: "已完成", Value: "completed", Sort: 3, Status: 1},
				{Label: "已逾期", Value: "overdue", Sort: 4, Status: 1},
				{Label: "已归档", Value: "archived", Sort: 5, Status: 1},
			}},
			{Code: "project_type", Name: "项目类型", Status: 1, Items: []models.DictionaryItem{
				{Label: "Web开发", Value: "web", Sort: 1, Status: 1},
				{Label: "移动应用", Value: "mobile", Sort: 2, Status: 1},
				{Label: "UI设计", Value: "design", Sort: 3, Status: 1},
				{Label: "SaaS系统", Value: "saas", Sort: 4, Status: 1},
				{Label: "其他", Value: "other", Sort: 5, Status: 1},
			}},
		}
		if err := tx.Create(&dictionaries).Error; err != nil {
			return err
		}
		// Publishing before either insert succeeds can leave committed accounts with
		// a losing startup's passwords. Publication failure must roll back all inserts.
		credentialsPath = writeInitialCredentials(adminPassword, userPassword)
		if credentialsPath == "" {
			return errors.New("无法写入初始凭据文件，初始账户创建已取消；请检查应用配置目录权限后重试")
		}
		created = true
		return nil
	})
	if err != nil {
		return err
	}
	if !created {
		return nil
	}
	slog.Warn("============================================")
	slog.Warn("首次启动检测到空数据库，已创建默认用户")
	slog.Warn("管理员账号: admin，普通用户账号: xu")
	slog.Warn("初始密码已写入凭据文件，请立即登录并修改", "path", credentialsPath)
	slog.Warn("============================================")
	return nil
}

// writeInitialCredentials 将首次启动生成的初始密码写入用户配置目录下的凭据文件 (0600)
// 返回文件路径；写入失败时返回空字符串。
func writeInitialCredentials(adminPassword, userPassword string) string {
	appDir := config.AppConfig.DataDir
	if appDir == "" {
		slog.Error("app config directory unavailable for initial credentials")
		return ""
	}
	if err := os.MkdirAll(appDir, 0700); err != nil {
		slog.Error("failed to create initial credentials dir", "error", err)
		return ""
	}
	path := filepath.Join(appDir, "initial-credentials.txt")
	content := fmt.Sprintf("admin: %s\nxu: %s\n", adminPassword, userPassword)
	file, err := os.CreateTemp(appDir, ".initial-credentials-")
	if err != nil {
		slog.Error("failed to stage initial credentials file", "error", err)
		return ""
	}
	stage := file.Name()
	defer func() {
		if err := os.Remove(stage); err != nil && !errors.Is(err, os.ErrNotExist) {
			slog.Debug("Unable to remove staged initial credentials", "error", err)
		}
	}()
	_, writeErr := file.WriteString(content)
	if writeErr == nil {
		writeErr = file.Sync()
	}
	if closeErr := file.Close(); writeErr == nil {
		writeErr = closeErr
	}
	if writeErr == nil {
		writeErr = os.Rename(stage, path)
	}
	if writeErr != nil {
		slog.Error("failed to write initial credentials file", "error", writeErr)
		return ""
	}
	return path
}

// generateStrongPassword 生成随机强密码
// 密码包含大小写字母、数字和特殊字符，满足强密码要求
func generateStrongPassword(length int) (string, error) {
	return generateStrongPasswordFrom(rand.Reader, length)
}

func generateStrongPasswordFrom(reader io.Reader, length int) (string, error) {
	const (
		upperChars   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		lowerChars   = "abcdefghijklmnopqrstuvwxyz"
		digitChars   = "0123456789"
		specialChars = "!@#$%^&*()-_=+[]{}|;:,.<>?"
	)

	if length < 4 {
		return "", errors.New("密码长度至少4位")
	}
	allChars := upperChars + lowerChars + digitChars + specialChars
	password := make([]byte, length)
	groups := []string{upperChars, lowerChars, digitChars, specialChars}
	for i := range password {
		chars := allChars
		if i < len(groups) {
			chars = groups[i]
		}
		index, err := randomInt(reader, len(chars))
		if err != nil {
			return "", err
		}
		password[i] = chars[index]
	}

	// 打乱顺序
	for i := length - 1; i > 0; i-- {
		j, err := randomInt(reader, i+1)
		if err != nil {
			return "", err
		}
		password[i], password[j] = password[j], password[i]
	}

	return string(password), nil
}

// randomInt 生成 [0, upperBound) 范围内的随机整数
func randomInt(reader io.Reader, upperBound int) (int, error) {
	n, err := rand.Int(reader, big.NewInt(int64(upperBound)))
	if err != nil {
		return 0, fmt.Errorf("安全随机数不可用: %w", err)
	}
	return int(n.Int64()), nil
}
