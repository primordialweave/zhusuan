package service

import (
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
	"github.com/primordialweave/zhusuan/internal/repository"
)

// ProjectService 项目服务
// 负责处理项目管理模块的所有核心业务逻辑，包括项目的增删改查、状态管理、
// 合同编号生成以及相关的款项级联操作。
//
// 依赖:
//   - ProjectRepository: 项目数据持久化接口
//   - PaymentRepository: 款项数据持久化接口
type ProjectService struct {
	projectRepo *repository.ProjectRepository
	paymentRepo *repository.PaymentRepository
}

// NewProjectService 创建并初始化项目服务实例
//
// 返回:
//   - *ProjectService: 包含已初始化 Repository 的服务实例
func NewProjectService() *ProjectService {
	return &ProjectService{
		projectRepo: repository.NewProjectRepository(),
		paymentRepo: repository.NewPaymentRepository(),
	}
}

// List 分页获取项目列表
// 支持根据用户ID、项目状态和关键词进行过滤查询。
//
// 参数:
//   - userID: 当前用户ID，强制数据隔离
//   - status: 项目状态筛选 (如 "active", "completed", "archived")，为空则查全部
//   - keyword: 搜索关键词，支持匹配项目名称、公司名或合同编号
//   - page: 页码，从1开始
//   - pageSize: 每页数量
//
// 返回:
//   - *dto.ProjectListResult: 包含项目列表数据、总数及分页信息
//   - error: 数据库查询错误
func (s *ProjectService) List(userID int64, status, keyword string, page, pageSize int) (*dto.ProjectListResult, error) {
	// 参数校验与默认值填充
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}

	// 执行查询
	projects, total, err := s.projectRepo.List(userID, status, keyword, page, pageSize)
	if err != nil {
		return nil, err
	}

	// 组装返回结果
	return &dto.ProjectListResult{
		List:     projects,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetForUser 获取项目详情（校验归属）
// 根据项目ID获取单个项目的详细信息，并包含该项目关联的所有款项数据，
// 用于详情页展示收款计划。
func (s *ProjectService) GetForUser(userID, id int64) (*models.Project, error) {
	project, err := s.projectRepo.FindByIDWithPaymentsForUser(id, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, pkgerrors.ErrProjectNotFound
		}
		return nil, pkgerrors.Wrap(err, "查询项目失败")
	}
	return project, nil
}

// Create 创建新项目
// 接收前端表单数据，进行日期解析和默认值处理后，将项目存入数据库。
//
// 参数:
//   - input: 创建项目的请求DTO，包含前端传递的所有表单字段
//
// 返回:
//   - *models.Project: 创建成功的项目实体
//   - error: 日期解析失败或数据库写入错误
func (s *ProjectService) Create(input dto.CreateProjectRequest) (*models.Project, error) {
	if err := validatePositiveAmount(input.TotalAmount); err != nil {
		return nil, err
	}
	// 1. 检查合同编号是否已存在
	if strings.TrimSpace(input.ContractNumber) != "" {
		exists, err := s.projectRepo.ExistsByContractNumber(input.UserID, input.ContractNumber, 0)
		if err != nil {
			return nil, pkgerrors.Wrap(err, "检查合同编号失败")
		}
		if exists {
			return nil, pkgerrors.ErrContractDuplicate
		}
	}

	// 2. 日期字段解析 (字符串 "YYYY-MM-DD" -> time.Time)
	// 使用 ParseInLocation 确保时区一致性
	loc := time.Local // 或使用 time.LoadLocation("Asia/Shanghai")
	startDate, err := time.ParseInLocation("2006-01-02", input.StartDate, loc)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "开始日期格式错误")
	}
	endDate, err := time.ParseInLocation("2006-01-02", input.EndDate, loc)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "结束日期格式错误")
	}

	// 合同日期为选填项，需处理空值情况
	var contractDate *time.Time
	if input.ContractDate != "" {
		t, err := time.ParseInLocation("2006-01-02", input.ContractDate, loc)
		if err != nil {
			return nil, pkgerrors.WrapWithCode(err, 400, "合同日期格式错误")
		}
		contractDate = &t
	}

	// 3. 构建项目实体
	project := &models.Project{
		Name:           input.Name,
		Company:        input.Company,
		TotalAmount:    input.TotalAmount,
		Status:         input.Status,
		Type:           input.Type,
		ContractNumber: input.ContractNumber,
		ContractDate:   contractDate,
		PaymentMethod:  input.PaymentMethod,
		StartDate:      startDate,
		EndDate:        endDate,
		Description:    input.Description,
		UserID:         input.UserID,
	}

	// 4. 设置默认状态
	if project.Status == "" {
		project.Status = "active"
	}

	// 5. 持久化到数据库
	if err := s.saveWithContractNumber(&input, input.UserID, 0, "创建项目失败", func() error {
		project.ContractNumber = input.ContractNumber
		return s.projectRepo.Create(project)
	}); err != nil {
		return nil, err
	}

	// 项目合同总额影响 Dashboard 全局统计，创建后清除缓存
	invalidateDashboardCache(input.UserID)
	return project, nil
}

// UpdateForUser 更新项目详情（校验归属与合同编号唯一性）
func (s *ProjectService) UpdateForUser(userID, id int64, input dto.CreateProjectRequest) (*models.Project, error) {
	if err := validatePositiveAmount(input.TotalAmount); err != nil {
		return nil, err
	}
	project, err := s.projectRepo.FindByIDForUser(id, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, pkgerrors.ErrProjectNotFound
		}
		return nil, pkgerrors.Wrap(err, "查询项目失败")
	}

	// 检查合同编号唯一性
	if strings.TrimSpace(input.ContractNumber) != "" && input.ContractNumber != project.ContractNumber {
		exists, err := s.projectRepo.ExistsByContractNumber(userID, input.ContractNumber, id)
		if err != nil {
			return nil, pkgerrors.Wrap(err, "检查合同编号失败")
		}
		if exists {
			return nil, pkgerrors.ErrContractDuplicate
		}
	}

	loc := time.Local
	startDate, err := time.ParseInLocation("2006-01-02", input.StartDate, loc)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "开始日期格式错误")
	}
	endDate, err := time.ParseInLocation("2006-01-02", input.EndDate, loc)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "结束日期格式错误")
	}
	var contractDate *time.Time
	if input.ContractDate != "" {
		t, err := time.ParseInLocation("2006-01-02", input.ContractDate, loc)
		if err != nil {
			return nil, pkgerrors.WrapWithCode(err, 400, "合同日期格式错误")
		}
		contractDate = &t
	}

	if err := s.saveWithContractNumber(&input, userID, id, "更新项目失败", func() error {
		return updateProjectAndPercentages(project, input, startDate, endDate, contractDate)
	}); err != nil {
		return nil, err
	}

	// 合同总额/状态变更影响 Dashboard 统计，更新后清除缓存
	invalidateDashboardCache(userID)
	return project, nil
}

// saveWithContractNumber generates omitted numbers at save time. Suggestions are
// not reservations, so a competing writer may require generating another number.
func (s *ProjectService) saveWithContractNumber(input *dto.CreateProjectRequest, userID, excludeID int64, message string, save func() error) error {
	automatic := strings.TrimSpace(input.ContractNumber) == ""
	attempts := 1
	if automatic {
		attempts = 3
	}
	for attempt := 0; attempt < attempts; attempt++ {
		if automatic {
			date := input.ContractDate
			if date == "" {
				date = input.StartDate
			}
			number, err := s.GenerateNextContractNumber(userID, date)
			if err != nil {
				return pkgerrors.Wrap(err, "生成合同编号失败")
			}
			input.ContractNumber = number
		}
		err := save()
		if err == nil {
			return nil
		}
		if !isDuplicateDatabaseError(database.GetDB().Dialector, err) {
			return pkgerrors.Wrap(err, message)
		}
		// Other unique keys (for example a primary key) must keep their original
		// error. This check runs after the failed transaction has rolled back.
		exists, checkErr := s.projectRepo.ExistsByContractNumber(userID, input.ContractNumber, excludeID)
		if checkErr != nil || !exists {
			return pkgerrors.Wrap(err, message)
		}
	}
	return pkgerrors.ErrContractDuplicate
}

// isDuplicateDatabaseError uses the configured driver's translation locally,
// without changing error handling for the application's other services.
func isDuplicateDatabaseError(dialector gorm.Dialector, err error) bool {
	translator, ok := dialector.(gorm.ErrorTranslator)
	for current := err; current != nil; current = errors.Unwrap(current) {
		if errors.Is(current, gorm.ErrDuplicatedKey) {
			return true
		}
		if ok && errors.Is(translator.Translate(current), gorm.ErrDuplicatedKey) {
			return true
		}
	}
	return false
}

// updateProjectAndPercentages preserves aggregates from the locked row and commits the new ratios with the contract.
func updateProjectAndPercentages(project *models.Project, input dto.CreateProjectRequest, startDate, endDate time.Time, contractDate *time.Time) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		current, err := lockPaymentProjectInTx(tx, project.ID, project.UserID)
		if err != nil {
			return err
		}
		current.Name, current.Company, current.TotalAmount = input.Name, input.Company, input.TotalAmount
		current.Status, current.Type, current.ContractNumber = input.Status, input.Type, input.ContractNumber
		current.ContractDate, current.PaymentMethod = contractDate, input.PaymentMethod
		current.StartDate, current.EndDate, current.Description = startDate, endDate, input.Description
		if err := tx.Save(current).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Payment{}).Where("project_id = ? AND user_id = ?", project.ID, project.UserID).Update("percentage", gorm.Expr("amount * 100.0 / ?", input.TotalAmount)).Error; err != nil {
			return err
		}
		*project = *current
		return nil
	})
}

// DeleteForUser 删除项目及关联数据（校验归属）
// 事务操作: 同时删除项目本身及其下属的所有款项记录。
func (s *ProjectService) DeleteForUser(userID, id int64) error {
	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		// Use the same parent-first order as payment writers, including deletion.
		if _, err := lockPaymentProjectInTx(tx, id, userID); err != nil {
			return err
		}
		if err := tx.Where("project_id = ? AND user_id = ?", id, userID).Delete(&models.Payment{}).Error; err != nil {
			return pkgerrors.Wrap(err, "删除关联款项失败")
		}
		return tx.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Project{}).Error
	})
	if err != nil {
		return err
	}

	// 事务提交后清除该用户的 Dashboard 统计缓存
	invalidateDashboardCache(userID)
	return nil
}

// ArchiveForUser 归档项目（校验归属）
// 将项目状态更新为 "archived"，归档后的项目通常只读或不显示在主列表中。
func (s *ProjectService) ArchiveForUser(userID, id int64) error {
	if _, err := s.projectRepo.FindByIDForUser(id, userID); err != nil {
		return err
	}
	return s.projectRepo.UpdateStatusForUser(id, userID, "archived")
}

// CheckContractNumberExists 检查合同编号是否在库中已存在
//
// 参数:
//   - userID: 用户ID
//   - contractNumber: 待检查的合同编号
//   - excludeID: 排除的项目ID（更新项目时使用，排除因为自己导致的重复）
//
// 返回:
//   - bool: true表示存在(不可用)，false表示不存在(可用)
//   - error: 数据库查询错误
func (s *ProjectService) CheckContractNumberExists(userID int64, contractNumber string, excludeID int64) (bool, error) {
	return s.projectRepo.ExistsByContractNumber(userID, contractNumber, excludeID)
}

// GenerateNextContractNumber 生成智能建议合同编号
// 规则: HT + YYYYMMDD + 0001 (流水号)
//
// 逻辑:
//  1. 基于输入的日期构建前缀 (HT20260111)
//  2. 查找数据库中当天最大的流水号
//  3. 如果存在则+1，否则从 0001 开始
//
// 参数:
//   - userID: 保证用户间编号独立
//   - date: 基础日期字符串 "YYYY-MM-DD"
//
// 返回:
//   - string: 生成的合同编号
func (s *ProjectService) GenerateNextContractNumber(userID int64, date string) (string, error) {
	// 解析日期
	loc := time.Local
	t, err := time.ParseInLocation("2006-01-02", date, loc)
	if err != nil {
		return "", err
	}

	// 构造前缀: HT + YYYYMMDD
	prefix := "HT" + t.Format("20060102")

	// Only numeric suffixes belong to the automatic sequence. Sorting their
	// normalized length also handles 9999 -> 10000 and custom leading zeroes.
	suffix := fmt.Sprintf("SUBSTR(contract_number, %d)", len(prefix)+1)
	numericSuffix := suffix + " NOT GLOB '*[^0-9]*'"
	normalizedSuffix := "LTRIM(" + suffix + ", '0')"
	const (
		postgresDialect = "postgres"
		mysqlDialect    = "mysql"
	)
	switch database.GetDBType() {
	case postgresDialect:
		numericSuffix = suffix + " ~ '^[0-9]+$'"
	case mysqlDialect:
		numericSuffix = suffix + " REGEXP '^[0-9]+$'"
		normalizedSuffix = "TRIM(LEADING '0' FROM " + suffix + ")"
	}
	var maxNumber string
	query := database.GetDB().Model(&models.Project{}).
		Where("user_id = ? AND contract_number LIKE ?", userID, prefix+"%").
		Where("LENGTH(contract_number) >= ?", len(prefix)+4).
		Where(numericSuffix).
		Order("LENGTH(" + normalizedSuffix + ") DESC").
		Order(normalizedSuffix + " DESC").
		Limit(1)
	if err := query.Pluck("contract_number", &maxNumber).Error; err != nil {
		return "", err
	}
	sequence := big.NewInt(1)
	if maxNumber != "" {
		sequence.SetString(maxNumber[len(prefix):], 10)
		sequence.Add(sequence, big.NewInt(1))
	}
	digits := sequence.String()
	if len(digits) < 4 {
		digits = strings.Repeat("0", 4-len(digits)) + digits
	}
	return prefix + digits, nil
}
