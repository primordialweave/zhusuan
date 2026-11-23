// Package main provides manually invoked service benchmarks against the benchmark database.
package main

import (
	"flag"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/service"
)

const (
	benchmarkPasswordPlaceholder = "hashed"
	benchmarkCompany             = "测试公司"
)

// BenchmarkProjectServiceCreate 项目创建性能测试
func BenchmarkProjectServiceCreate(b *testing.B) {
	setupBenchmarkDB(b)
	svc := service.NewProjectService()

	// 创建测试用户
	user := &models.User{
		Username: "benchuser",
		Password: benchmarkPasswordPlaceholder,
		Email:    "bench@test.com",
		Role:     constants.RoleUser,
		Status:   1,
	}
	db := database.GetDB()
	if err := db.Create(user).Error; err != nil {
		b.Fatalf("create benchmark user: %v", err)
	}

	req := dto.CreateProjectRequest{
		Name:           "性能测试项目",
		Company:        benchmarkCompany,
		ContractNumber: "BENCH-001",
		TotalAmount:    100000,
		StartDate:      time.Now().Format("2006-01-02"),
		EndDate:        time.Now().AddDate(0, 6, 0).Format("2006-01-02"),
		Status:         constants.ProjectStatusOngoing,
		UserID:         user.ID,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req.ContractNumber = fmt.Sprintf("BENCH-%d", i)
		if _, err := svc.Create(req); err != nil {
			b.Fatalf("create benchmark project: %v", err)
		}
	}
}

// BenchmarkProjectServiceList 项目列表查询性能测试
func BenchmarkProjectServiceList(b *testing.B) {
	setupBenchmarkDB(b)
	svc := service.NewProjectService()

	// 创建测试数据
	user := &models.User{
		Username: "listuser",
		Password: benchmarkPasswordPlaceholder,
		Email:    "list@test.com",
		Role:     constants.RoleUser,
		Status:   1,
	}
	db := database.GetDB()
	if err := db.Create(user).Error; err != nil {
		b.Fatalf("create benchmark user: %v", err)
	}

	// 创建100个项目
	for i := 0; i < 100; i++ {
		req := dto.CreateProjectRequest{
			Name:           fmt.Sprintf("项目%d", i),
			Company:        "公司",
			ContractNumber: fmt.Sprintf("LIST-%d", i),
			TotalAmount:    100000,
			StartDate:      time.Now().Format("2006-01-02"),
			EndDate:        time.Now().AddDate(0, 6, 0).Format("2006-01-02"),
			Status:         constants.ProjectStatusOngoing,
			UserID:         user.ID,
		}
		if _, err := svc.Create(req); err != nil {
			b.Fatalf("create benchmark project: %v", err)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := svc.List(user.ID, "", "", 1, 10); err != nil {
			b.Fatalf("list benchmark projects: %v", err)
		}
	}
}

// BenchmarkPaymentServiceCreate 款项创建性能测试
func BenchmarkPaymentServiceCreate(b *testing.B) {
	setupBenchmarkDB(b)
	projectSvc := service.NewProjectService()
	paymentSvc := service.NewPaymentService()

	// 创建测试数据
	user := &models.User{
		Username: "paymentuser",
		Password: benchmarkPasswordPlaceholder,
		Email:    "payment@test.com",
		Role:     constants.RoleUser,
		Status:   1,
	}
	db := database.GetDB()
	if err := db.Create(user).Error; err != nil {
		b.Fatalf("create benchmark user: %v", err)
	}

	projectReq := dto.CreateProjectRequest{
		Name:           "款项测试项目",
		Company:        benchmarkCompany,
		ContractNumber: "PAY-BENCH",
		TotalAmount:    1000000,
		StartDate:      time.Now().Format("2006-01-02"),
		EndDate:        time.Now().AddDate(0, 12, 0).Format("2006-01-02"),
		Status:         constants.ProjectStatusOngoing,
		UserID:         user.ID,
	}
	project, err := projectSvc.Create(projectReq)
	if err != nil {
		b.Fatalf("create benchmark parent project: %v", err)
	}

	req := dto.PaymentRequest{
		ProjectID: project.ID,
		Amount:    10000,
		Stage:     "测试款项",
		PlanDate:  time.Now().Format("2006-01-02"),
		Status:    constants.PaymentStatusPending,
		UserID:    user.ID,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := paymentSvc.Create(req); err != nil {
			b.Fatalf("create benchmark payment: %v", err)
		}
	}
}

// BenchmarkPaymentServiceConfirm 款项确认性能测试（含事务）
func BenchmarkPaymentServiceConfirm(b *testing.B) {
	setupBenchmarkDB(b)
	projectSvc := service.NewProjectService()
	paymentSvc := service.NewPaymentService()

	// 创建测试数据
	user := &models.User{
		Username: "confirmuser",
		Password: benchmarkPasswordPlaceholder,
		Email:    "confirm@test.com",
		Role:     constants.RoleUser,
		Status:   1,
	}
	db := database.GetDB()
	if err := db.Create(user).Error; err != nil {
		b.Fatalf("create benchmark user: %v", err)
	}

	projectReq := dto.CreateProjectRequest{
		Name:           "确认测试项目",
		Company:        benchmarkCompany,
		ContractNumber: "CONF-BENCH",
		TotalAmount:    10000000,
		StartDate:      time.Now().Format("2006-01-02"),
		EndDate:        time.Now().AddDate(0, 12, 0).Format("2006-01-02"),
		Status:         constants.ProjectStatusOngoing,
		UserID:         user.ID,
	}
	project, err := projectSvc.Create(projectReq)
	if err != nil {
		b.Fatalf("create benchmark parent project: %v", err)
	}

	// 创建N个待确认款项
	payments := make([]*models.Payment, b.N)
	for i := 0; i < b.N; i++ {
		req := dto.PaymentRequest{
			ProjectID: project.ID,
			Amount:    1000,
			Stage:     fmt.Sprintf("款项%d", i),
			PlanDate:  time.Now().Format("2006-01-02"),
			Status:    constants.PaymentStatusPending,
			UserID:    user.ID,
		}
		payment, err := paymentSvc.Create(req)
		if err != nil {
			b.Fatalf("create benchmark payment: %v", err)
		}
		payments[i] = payment
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := paymentSvc.ConfirmForUser(user.ID, payments[i].ID, time.Now().Format("2006-01-02"), "bank"); err != nil {
			b.Fatalf("confirm benchmark payment: %v", err)
		}
	}
}

// BenchmarkDashboardServiceGetStats Dashboard统计性能测试
func BenchmarkDashboardServiceGetStats(b *testing.B) {
	setupBenchmarkDB(b)
	dashboardSvc := service.NewDashboardService()
	projectSvc := service.NewProjectService()

	// 创建测试数据
	user := &models.User{
		Username: "dashuser",
		Password: benchmarkPasswordPlaceholder,
		Email:    "dash@test.com",
		Role:     constants.RoleUser,
		Status:   1,
	}
	db := database.GetDB()
	if err := db.Create(user).Error; err != nil {
		b.Fatalf("create benchmark user: %v", err)
	}

	// 创建50个项目
	for i := 0; i < 50; i++ {
		req := dto.CreateProjectRequest{
			Name:           fmt.Sprintf("统计项目%d", i),
			Company:        "公司",
			ContractNumber: fmt.Sprintf("DASH-%d", i),
			TotalAmount:    100000,
			StartDate:      time.Now().Format("2006-01-02"),
			EndDate:        time.Now().AddDate(0, 6, 0).Format("2006-01-02"),
			Status:         constants.ProjectStatusOngoing,
			UserID:         user.ID,
		}
		if _, err := projectSvc.Create(req); err != nil {
			b.Fatalf("create benchmark dashboard project: %v", err)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := dashboardSvc.GetStats(user.ID, "all"); err != nil {
			b.Fatalf("read benchmark dashboard: %v", err)
		}
	}
}

func setupBenchmarkDB(b *testing.B) {
	b.Helper()
	config.AppConfig = &config.Config{
		DBType: "sqlite",
		DBPath: "file:benchmark_test?mode=memory&cache=shared",
	}
	db := database.GetDB()
	if err := db.AutoMigrate(&models.User{}, &models.Project{}, &models.Payment{}); err != nil {
		b.Fatalf("migrate benchmark schema: %v", err)
	}
}

// 主函数用于手动运行基准测试
func main() {
	flag.Parse()

	fmt.Println("运行性能基准测试...")
	fmt.Println(strings.Repeat("=", 60))

	// 运行项目创建测试
	fmt.Println("\n1. 项目创建性能:")
	result := testing.Benchmark(BenchmarkProjectServiceCreate)
	fmt.Printf("   迭代次数: %d\n", result.N)
	fmt.Printf("   每次操作: %v\n", result.NsPerOp())
	fmt.Printf("   吞吐量: %.0f ops/s\n", float64(result.N)/result.T.Seconds())

	// 运行项目列表查询测试
	fmt.Println("\n2. 项目列表查询性能:")
	result = testing.Benchmark(BenchmarkProjectServiceList)
	fmt.Printf("   迭代次数: %d\n", result.N)
	fmt.Printf("   每次操作: %v\n", result.NsPerOp())
	fmt.Printf("   吞吐量: %.0f ops/s\n", float64(result.N)/result.T.Seconds())

	// 运行款项创建测试
	fmt.Println("\n3. 款项创建性能:")
	result = testing.Benchmark(BenchmarkPaymentServiceCreate)
	fmt.Printf("   迭代次数: %d\n", result.N)
	fmt.Printf("   每次操作: %v\n", result.NsPerOp())
	fmt.Printf("   吞吐量: %.0f ops/s\n", float64(result.N)/result.T.Seconds())

	// 运行款项确认测试
	fmt.Println("\n4. 款项确认性能(含事务):")
	result = testing.Benchmark(BenchmarkPaymentServiceConfirm)
	fmt.Printf("   迭代次数: %d\n", result.N)
	fmt.Printf("   每次操作: %v\n", result.NsPerOp())
	fmt.Printf("   吞吐量: %.0f ops/s\n", float64(result.N)/result.T.Seconds())

	// 运行Dashboard统计测试
	fmt.Println("\n5. Dashboard统计性能:")
	result = testing.Benchmark(BenchmarkDashboardServiceGetStats)
	fmt.Printf("   迭代次数: %d\n", result.N)
	fmt.Printf("   每次操作: %v\n", result.NsPerOp())
	fmt.Printf("   吞吐量: %.0f ops/s\n", float64(result.N)/result.T.Seconds())

	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("性能测试完成")
}
