// Package main adds configured database indexes and prints query diagnostics.
package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
)

type indexSpec struct{ name, statement string }
type indexGroup struct {
	title   string
	indexes []indexSpec
}

var indexGroups = []indexGroup{
	{title: "1. 添加项目表索引...", indexes: []indexSpec{
		{name: "idx_projects_user_id", statement: "CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)"},
		{name: "idx_projects_status", statement: "CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)"},
		{name: "idx_projects_user_status", statement: "CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status)"},
		{name: "idx_projects_contract_number", statement: "CREATE INDEX IF NOT EXISTS idx_projects_contract_number ON projects(contract_number)"},
	}},
	{title: "2. 添加款项表索引...", indexes: []indexSpec{
		{name: "idx_payments_project_id", statement: "CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id)"},
		{name: "idx_payments_status", statement: "CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)"},
		{name: "idx_payments_plan_date", statement: "CREATE INDEX IF NOT EXISTS idx_payments_plan_date ON payments(plan_date)"},
		{name: "idx_payments_actual_date", statement: "CREATE INDEX IF NOT EXISTS idx_payments_actual_date ON payments(actual_date)"},
		{name: "idx_payments_project_status", statement: "CREATE INDEX IF NOT EXISTS idx_payments_project_status ON payments(project_id, status)"},
	}},
	{title: "3. 添加用户表索引...", indexes: []indexSpec{
		{name: "idx_users_email", statement: "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"},
		{name: "idx_users_phone", statement: "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)"},
	}},
	{title: "4. 添加通知表索引...", indexes: []indexSpec{
		{name: "idx_notifications_global", statement: "CREATE INDEX IF NOT EXISTS idx_notifications_global ON notifications(is_global)"},
		{name: "idx_notifications_type", statement: "CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)"},
		{name: "idx_notifications_create_time", statement: "CREATE INDEX IF NOT EXISTS idx_notifications_create_time ON notifications(create_time)"},
	}},
	{title: "5. 添加通知读取状态表索引...", indexes: []indexSpec{
		{name: "idx_user_notifications_user_read", statement: "CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read ON user_notifications(user_id, is_read, notification_id)"},
	}},
}

func main() {
	config.Load()
	if config.AppConfig.DBType != "sqlite" {
		log.Fatal("此索引诊断命令仅支持 SQLite")
	}
	db := database.GetDB()
	fmt.Println("开始添加数据库索引...")
	for _, group := range indexGroups {
		if err := addIndexGroup(db, group); err != nil {
			log.Fatal(err)
		}
	}
	fmt.Println("\n索引添加完成!")
	printDatabaseIndexes(db)
	analyzeDatabaseTables(db)
	fmt.Println("\n数据库优化完成!")
	fmt.Println("\n性能测试...")
	testDatabasePerformance(db)
}

func addIndexGroup(db *gorm.DB, group indexGroup) error {
	fmt.Println(group.title)
	for _, index := range group.indexes {
		if err := db.Exec(index.statement).Error; err != nil {
			return fmt.Errorf("创建 %s 失败: %w", index.name, err)
		}
		label := index.name
		if strings.HasPrefix(index.statement, "CREATE UNIQUE") {
			label += " (UNIQUE)"
		}
		fmt.Printf("   ✓ %s\n", label)
	}
	return nil
}

func printDatabaseIndexes(db *gorm.DB) {
	fmt.Println("\n验证索引...")
	var indexes []struct {
		Name string
		SQL  string
	}
	if err := db.Raw("SELECT name, sql FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").Scan(&indexes).Error; err != nil {
		log.Printf("查询索引失败: %v", err)
		return
	}
	fmt.Printf("共创建 %d 个索引:\n", len(indexes))
	for _, index := range indexes {
		fmt.Printf("  - %s\n", index.Name)
	}
}

func analyzeDatabaseTables(db *gorm.DB) {
	fmt.Println("\n更新表统计信息...")
	for _, table := range []string{"projects", "payments", "users", "notifications", "user_notifications"} {
		if err := db.Exec(fmt.Sprintf("ANALYZE %s", table)).Error; err != nil {
			log.Printf("分析表 %s 失败: %v", table, err)
		} else {
			fmt.Printf("  ✓ %s\n", table)
		}
	}
}

func testDatabasePerformance(db *gorm.DB) {
	fmt.Println("1. 测试项目查询性能...")
	start := time.Now()
	var projects []models.Project
	if err := db.Where("user_id = ? AND status = ?", 1, "active").Limit(10).Find(&projects).Error; err != nil {
		log.Printf("项目查询失败: %v", err)
		return
	}
	fmt.Printf("   查询时间: %v\n", time.Since(start))

	fmt.Println("2. 测试款项查询性能...")
	start = time.Now()
	var payments []models.Payment
	if err := db.Where("project_id = ? AND status = ?", 1, "pending").Order("plan_date ASC").Limit(10).Find(&payments).Error; err != nil {
		log.Printf("款项查询失败: %v", err)
		return
	}
	fmt.Printf("   查询时间: %v\n", time.Since(start))

	fmt.Println("3. 测试用户查询性能...")
	start = time.Now()
	var user models.User
	if err := db.Where("username = ?", "admin").First(&user).Error; err != nil {
		log.Printf("用户查询失败: %v", err)
		return
	}
	fmt.Printf("   查询时间: %v\n", time.Since(start))
}
