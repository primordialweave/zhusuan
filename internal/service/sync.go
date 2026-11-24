package service

import (
	"context"
	"database/sql"
	stderrors "errors"
	"fmt"
	"log"
	"log/slog"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib" // Register the pgx driver for database/sql synchronization.
	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
)

// 允许同步的固定表结构白名单
var syncTableColumns = map[string][]string{
	syncTableUsers:                {"id", "username", columnPassword, columnName, "email", "phone", "avatar", "role", "department", "position", columnStatus, "last_login_time", columnCreateTime, columnUpdateTime},
	syncTableProjects:             {"id", columnName, "company", "total_amount", "received_amount", columnStatus, "type", "contract_number", "contract_date", "payment_method", "start_date", "end_date", "description", columnUserID, columnCreateTime, columnUpdateTime},
	syncTablePayments:             {"id", "project_id", "stage", "amount", "percentage", "plan_date", columnStatus, "actual_date", "method", columnRemark, columnUserID, columnCreateTime, columnUpdateTime},
	syncTableDictionaries:         {"id", "code", columnName, columnStatus, columnRemark, columnCreateTime, columnUpdateTime},
	syncTableDictionaryItems:      {"id", "dictionary_id", "label", "value", "sort", columnStatus, columnRemark, columnCreateTime, columnUpdateTime},
	syncTableNotifications:        {"id", "title", "content", "type", "sender_id", "is_global", columnCreateTime, columnUpdateTime},
	syncTableUserNotifications:    {"id", columnUserID, "notification_id", "is_read", "read_time"},
	syncTablePersonalAccessTokens: {"id", columnUserID, columnName, "token_hash", "scopes", columnStatus, "last_used_at", "expires_at", columnCreateTime, columnUpdateTime},
}

// SyncConfig 云端数据库连接配置
type SyncConfig struct {
	DBType   string `json:"db_type"`  // postgres, mysql
	Host     string `json:"host"`     // 主机地址
	Port     int    `json:"port"`     // 端口号
	User     string `json:"user"`     // 用户名
	Password string `json:"password"` // 密码
	DBName   string `json:"db_name"`  // 数据库名
	SSLMode  string `json:"ssl_mode"` // SSL 模式 (postgres: disable/require)
}

// TableCompareResult 表对比结果
type TableCompareResult struct {
	TableName   string `json:"table_name"`   // 表名
	LocalCount  int64  `json:"local_count"`  // 本地记录数
	RemoteCount int64  `json:"remote_count"` // 云端记录数
}

// SyncResult 同步结果
type SyncResult struct {
	TableName    string `json:"table_name"`    // 表名
	SyncedCount  int64  `json:"synced_count"`  // 同步记录数
	Success      bool   `json:"success"`       // 是否成功
	ErrorMessage string `json:"error_message"` // 错误信息
}

// SyncService 数据同步服务
type SyncService struct{}

type syncExecutor interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
}

type syncTransaction interface {
	syncExecutor
	Commit() error
	Rollback() error
}

type syncTableWriter func(*SyncService, context.Context, *gorm.DB, syncExecutor, string) (int64, string)

var syncTableWriters = map[string]syncTableWriter{
	syncTableUsers:                (*SyncService).syncUsers,
	syncTableProjects:             (*SyncService).syncProjects,
	syncTablePayments:             (*SyncService).syncPayments,
	syncTableDictionaries:         (*SyncService).syncDictionaries,
	syncTableDictionaryItems:      (*SyncService).syncDictionaryItems,
	syncTableNotifications:        (*SyncService).syncNotifications,
	syncTableUserNotifications:    (*SyncService).syncUserNotifications,
	syncTablePersonalAccessTokens: (*SyncService).syncPersonalAccessTokens,
}

const syncOperationTimeout = 60 * time.Second

// NewSyncService 创建同步服务实例
func NewSyncService() *SyncService {
	return &SyncService{}
}

// validateTableName 验证表名是否在白名单中
func (s *SyncService) validateTableName(table string) error {
	if _, ok := syncTableColumns[table]; !ok {
		return fmt.Errorf("invalid table name: %s", table)
	}
	return nil
}

// buildDSN 根据配置构建数据库连接字符串
func (s *SyncService) buildDSN(cfg SyncConfig) string {
	switch cfg.DBType {
	case mysqlDialect:
		return database.MySQLSyncDSN(cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName)
	case postgresDialect:
		sslMode := cfg.SSLMode
		if sslMode == "" {
			sslMode = "require" // 云端默认开启 SSL
		}
		return database.PostgresDSN(cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, sslMode)
	default:
		return ""
	}
}

// getDriverName 获取对应的驱动名称
func (s *SyncService) getDriverName(dbType string) string {
	switch dbType {
	case mysqlDialect:
		return mysqlDialect
	case postgresDialect:
		return "pgx"
	default:
		return ""
	}
}

// TestConnection 测试云端数据库连接
func (s *SyncService) TestConnection(cfg SyncConfig) error {
	driver := s.getDriverName(cfg.DBType)
	if driver == "" {
		return fmt.Errorf("不支持的数据库类型: %s", cfg.DBType)
	}

	dsn := s.buildDSN(cfg)
	db, err := sql.Open(driver, dsn)
	if err != nil {
		return fmt.Errorf("连接失败: %w", err)
	}
	defer closeSyncDatabase(db)

	// 验证连接
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("连接测试失败: %w", err)
	}

	return nil
}

// CompareData 对比本地与云端表的记录数
func (s *SyncService) CompareData(cfg SyncConfig) ([]TableCompareResult, error) {
	// 连接云端数据库
	driver := s.getDriverName(cfg.DBType)
	if driver == "" {
		return nil, fmt.Errorf("不支持的数据库类型: %s", cfg.DBType)
	}

	dsn := s.buildDSN(cfg)
	remoteDB, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("连接云端数据库失败: %w", err)
	}
	defer closeSyncDatabase(remoteDB)
	ctx, cancel := context.WithTimeout(context.Background(), syncOperationTimeout)
	defer cancel()
	if err := remoteDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("连接云端数据库失败: %w", err)
	}

	// 获取本地数据库
	localDB := database.GetDB()

	// 要对比的表
	tables := []string{syncTableUsers, syncTableProjects, syncTablePayments, syncTableDictionaries, syncTableDictionaryItems, syncTableNotifications, syncTableUserNotifications, syncTablePersonalAccessTokens}
	results := make([]TableCompareResult, 0, len(tables))

	for _, table := range tables {
		// 验证表名白名单
		if err := s.validateTableName(table); err != nil {
			continue // 跳过非法表名
		}

		result := TableCompareResult{TableName: table}

		// 本地计数
		var localCount int64
		if err := localDB.WithContext(ctx).Table(table).Count(&localCount).Error; err != nil {
			return nil, fmt.Errorf("读取本地表 %s 失败: %w", table, err)
		}
		result.LocalCount = localCount

		quotedTable, err := s.quoteSyncIdentifier(table, cfg.DBType)
		if err != nil {
			continue
		}

		// 云端计数 (表可能不存在)
		var remoteCount int64
		row := remoteDB.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", quotedTable))
		if err := row.Scan(&remoteCount); err != nil {
			if !isRemoteTableMissing(err) {
				return nil, fmt.Errorf("读取云端表 %s 失败: %w", table, err)
			}
			result.RemoteCount = -1
		} else {
			result.RemoteCount = remoteCount
		}

		results = append(results, result)
	}

	return results, nil
}

func isRemoteTableMissing(err error) bool {
	var mysqlErr *mysql.MySQLError
	if stderrors.As(err, &mysqlErr) && mysqlErr.Number == 1146 {
		return true
	}
	var postgresErr *pgconn.PgError
	return stderrors.As(err, &postgresErr) && postgresErr.Code == "42P01"
}

// SyncTables 执行数据同步
func (s *SyncService) SyncTables(cfg SyncConfig, tables []string) ([]SyncResult, error) {
	driver := s.getDriverName(cfg.DBType)
	if driver == "" {
		return nil, fmt.Errorf("不支持的数据库类型: %s", cfg.DBType)
	}

	dsn := s.buildDSN(cfg)
	remoteDB, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("连接云端数据库失败: %w", err)
	}
	defer closeSyncDatabase(remoteDB)

	ctx, cancel := context.WithTimeout(context.Background(), syncOperationTimeout)
	defer cancel()
	if err := remoteDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("云端数据库连接失败: %w", err)
	}

	if err := s.ensureRemoteTables(ctx, remoteDB, cfg.DBType, tables); err != nil {
		return nil, fmt.Errorf("创建云端数据表失败: %w", err)
	}

	tx, err := remoteDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("开启云端事务失败: %w", err)
	}
	return s.syncTablesInTransaction(ctx, database.GetDB(), tx, cfg.DBType, tables)
}

func (s *SyncService) ensureRemoteTables(ctx context.Context, remoteDB syncExecutor, dbType string, tables []string) error {
	for _, table := range tables {
		if err := s.validateTableName(table); err != nil {
			continue
		}
		ddl, err := s.buildCreateTableQuery(table, dbType)
		if err != nil {
			return err
		}
		if _, err := remoteDB.ExecContext(ctx, ddl); err != nil {
			return fmt.Errorf("初始化表 %s 失败: %w", table, err)
		}
	}
	return nil
}

func (s *SyncService) buildCreateTableQuery(table string, dbType string) (string, error) {
	if err := s.validateTableName(table); err != nil {
		return "", err
	}
	isPostgres := dbType == postgresDialect
	idDef := "`id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY"
	floatDef := "DOUBLE"
	timeDef := "DATETIME(3)"
	if isPostgres {
		idDef = `"id" BIGSERIAL PRIMARY KEY`
		floatDef = "DOUBLE PRECISION"
		timeDef = "TIMESTAMPTZ"
	}
	q := func(col string) string { return s.quoteColumn(col, dbType) }
	quotedTable := q(table)

	var columns []string
	switch table {
	case syncTableUsers:
		columns = []string{
			idDef,
			fmt.Sprintf("%s VARCHAR(50) NOT NULL UNIQUE", q("username")),
			fmt.Sprintf("%s VARCHAR(100) NOT NULL", q(columnPassword)),
			fmt.Sprintf("%s VARCHAR(50) NOT NULL", q(columnName)),
			fmt.Sprintf("%s VARCHAR(100)", q("email")),
			fmt.Sprintf("%s VARCHAR(20)", q("phone")),
			fmt.Sprintf("%s VARCHAR(255)", q("avatar")),
			fmt.Sprintf("%s VARCHAR(20) NOT NULL DEFAULT 'user'", q("role")),
			fmt.Sprintf("%s VARCHAR(50)", q("department")),
			fmt.Sprintf("%s VARCHAR(50)", q("position")),
			fmt.Sprintf("%s INTEGER NOT NULL DEFAULT 1", q(columnStatus)),
			fmt.Sprintf("%s %s", q("last_login_time"), timeDef),
			fmt.Sprintf("%s %s", q(columnCreateTime), timeDef),
			fmt.Sprintf("%s %s", q(columnUpdateTime), timeDef),
		}
	case syncTableProjects:
		columns = []string{
			idDef,
			fmt.Sprintf("%s VARCHAR(100) NOT NULL", q(columnName)),
			fmt.Sprintf("%s VARCHAR(100) NOT NULL", q("company")),
			fmt.Sprintf("%s %s NOT NULL", q("total_amount"), floatDef),
			fmt.Sprintf("%s %s DEFAULT 0", q("received_amount"), floatDef),
			fmt.Sprintf("%s VARCHAR(20) NOT NULL", q(columnStatus)),
			fmt.Sprintf("%s VARCHAR(50) NOT NULL", q("type")),
			fmt.Sprintf("%s VARCHAR(50)", q("contract_number")),
			fmt.Sprintf("%s DATE", q("contract_date")),
			fmt.Sprintf("%s VARCHAR(30)", q("payment_method")),
			fmt.Sprintf("%s DATE NOT NULL", q("start_date")),
			fmt.Sprintf("%s DATE NOT NULL", q("end_date")),
			fmt.Sprintf("%s TEXT", q("description")),
			fmt.Sprintf("%s BIGINT NOT NULL", q(columnUserID)),
			fmt.Sprintf("%s %s", q(columnCreateTime), timeDef),
			fmt.Sprintf("%s %s", q(columnUpdateTime), timeDef),
		}
	case syncTablePayments:
		columns = []string{
			idDef,
			fmt.Sprintf("%s BIGINT NOT NULL", q("project_id")),
			fmt.Sprintf("%s VARCHAR(50) NOT NULL", q("stage")),
			fmt.Sprintf("%s %s NOT NULL", q("amount"), floatDef),
			fmt.Sprintf("%s %s", q("percentage"), floatDef),
			fmt.Sprintf("%s DATE NOT NULL", q("plan_date")),
			fmt.Sprintf("%s VARCHAR(20) NOT NULL", q(columnStatus)),
			fmt.Sprintf("%s DATE", q("actual_date")),
			fmt.Sprintf("%s VARCHAR(30)", q("method")),
			fmt.Sprintf("%s VARCHAR(255)", q(columnRemark)),
			fmt.Sprintf("%s BIGINT NOT NULL", q(columnUserID)),
			fmt.Sprintf("%s %s", q(columnCreateTime), timeDef),
			fmt.Sprintf("%s %s", q(columnUpdateTime), timeDef),
		}
	case syncTableDictionaries:
		columns = []string{
			idDef,
			fmt.Sprintf("%s VARCHAR(50) NOT NULL UNIQUE", q("code")),
			fmt.Sprintf("%s VARCHAR(50) NOT NULL", q(columnName)),
			fmt.Sprintf("%s INTEGER DEFAULT 1", q(columnStatus)),
			fmt.Sprintf("%s VARCHAR(255)", q(columnRemark)),
			fmt.Sprintf("%s %s", q(columnCreateTime), timeDef),
			fmt.Sprintf("%s %s", q(columnUpdateTime), timeDef),
		}
	case syncTableDictionaryItems:
		columns = []string{
			idDef,
			fmt.Sprintf("%s BIGINT NOT NULL", q("dictionary_id")),
			fmt.Sprintf("%s VARCHAR(50) NOT NULL", q("label")),
			fmt.Sprintf("%s VARCHAR(50) NOT NULL", q("value")),
			fmt.Sprintf("%s INTEGER DEFAULT 0", q("sort")),
			fmt.Sprintf("%s INTEGER DEFAULT 1", q(columnStatus)),
			fmt.Sprintf("%s VARCHAR(255)", q(columnRemark)),
			fmt.Sprintf("%s %s", q(columnCreateTime), timeDef),
			fmt.Sprintf("%s %s", q(columnUpdateTime), timeDef),
		}
	case syncTableNotifications:
		columns = []string{
			idDef,
			fmt.Sprintf("%s VARCHAR(100) NOT NULL", q("title")),
			fmt.Sprintf("%s TEXT NOT NULL", q("content")),
			fmt.Sprintf("%s INTEGER DEFAULT 1", q("type")),
			fmt.Sprintf("%s BIGINT NOT NULL", q("sender_id")),
			fmt.Sprintf("%s INTEGER DEFAULT 0", q("is_global")),
			fmt.Sprintf("%s %s", q(columnCreateTime), timeDef),
			fmt.Sprintf("%s %s", q(columnUpdateTime), timeDef),
		}
	case syncTableUserNotifications:
		columns = []string{
			idDef,
			fmt.Sprintf("%s BIGINT NOT NULL", q(columnUserID)),
			fmt.Sprintf("%s BIGINT NOT NULL", q("notification_id")),
			fmt.Sprintf("%s INTEGER DEFAULT 0", q("is_read")),
			fmt.Sprintf("%s %s", q("read_time"), timeDef),
			fmt.Sprintf("UNIQUE (%s, %s)", q(columnUserID), q("notification_id")),
		}
	case syncTablePersonalAccessTokens:
		columns = []string{
			idDef,
			fmt.Sprintf("%s BIGINT NOT NULL", q(columnUserID)),
			fmt.Sprintf("%s VARCHAR(50) NOT NULL", q(columnName)),
			fmt.Sprintf("%s VARCHAR(100) NOT NULL", q("token_hash")),
			fmt.Sprintf("%s VARCHAR(255) DEFAULT ''", q("scopes")),
			fmt.Sprintf("%s INTEGER DEFAULT 1", q(columnStatus)),
			fmt.Sprintf("%s %s", q("last_used_at"), timeDef),
			fmt.Sprintf("%s %s", q("expires_at"), timeDef),
			fmt.Sprintf("%s %s", q(columnCreateTime), timeDef),
			fmt.Sprintf("%s %s", q(columnUpdateTime), timeDef),
		}
	}

	return fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (%s)", quotedTable, strings.Join(columns, ", ")), nil
}

func (s *SyncService) syncTablesInTransaction(ctx context.Context, localDB *gorm.DB, tx syncTransaction, dbType string, tables []string) ([]SyncResult, error) {
	results := make([]SyncResult, 0, len(tables))
	finalized := false
	defer func() {
		if !finalized {
			if rollbackErr := tx.Rollback(); rollbackErr != nil {
				// 记录回滚失败，但不影响主错误返回
				log.Printf("事务回滚失败: %v", rollbackErr)
			}
		}
	}()

	failed := false
	for _, table := range tables {
		if err := s.validateTableName(table); err != nil {
			results = append(results, SyncResult{
				TableName:    table,
				Success:      false,
				ErrorMessage: err.Error(),
			})
			failed = true
			break
		}

		result := SyncResult{TableName: table, Success: true}

		writer := syncTableWriters[table]
		result.SyncedCount, result.ErrorMessage = writer(s, ctx, localDB, tx, dbType)

		if result.ErrorMessage != "" {
			result.Success = false
			failed = true
		}
		results = append(results, result)
		if failed {
			break
		}
	}

	if failed {
		for i := range results {
			if results[i].ErrorMessage != "" {
				slog.Error("Sync table failed", "table", results[i].TableName, "error", results[i].ErrorMessage)
			}
		}
		rollbackErr := tx.Rollback()
		finalized = true
		if rollbackErr != nil {
			markSyncResultsUncommitted(results, "同步失败，本次更改未提交")
			return results, fmt.Errorf("回滚云端事务失败: %w", rollbackErr)
		}
		markSyncResultsUncommitted(results, "同步失败，本次事务已回滚")
		return results, nil
	}
	if err := tx.Commit(); err != nil {
		markSyncResultsUncommitted(results, "同步失败，本次更改未确认提交")
		return results, fmt.Errorf("提交云端事务失败: %w", err)
	}
	finalized = true

	return results, nil
}

func markSyncResultsUncommitted(results []SyncResult, message string) {
	for i := range results {
		results[i].Success, results[i].SyncedCount = false, 0
		results[i].ErrorMessage = message
	}
}

func closeSyncDatabase(db *sql.DB) {
	if err := db.Close(); err != nil {
		slog.Debug("Unable to close sync database", "error", err)
	}
}

func isRequiredNonEmptySyncTable(table string) bool {
	switch table {
	case syncTableUsers, syncTableDictionaries, syncTableDictionaryItems:
		return true
	default:
		return false
	}
}

// deleteExtras 删除云端多余的数据
func (s *SyncService) deleteExtras(ctx context.Context, remoteDB syncExecutor, table string, keepIDs []interface{}, dbType string) error {
	quotedTable, err := s.quoteSyncIdentifier(table, dbType)
	if err != nil {
		return err
	}

	if len(keepIDs) == 0 {
		if isRequiredNonEmptySyncTable(table) {
			return fmt.Errorf("refuse to delete all rows from %s because local ID list is empty", table)
		}
		query := fmt.Sprintf("DELETE FROM %s", quotedTable) // #nosec G201 -- table name is validated against syncTableColumns before quoting.
		_, err = remoteDB.ExecContext(ctx, query)
		return err
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE %s NOT IN (", quotedTable, s.quoteColumn("id", dbType)) // #nosec G201 -- table name is validated against syncTableColumns before quoting.
	args := make([]interface{}, len(keepIDs))

	for i, id := range keepIDs {
		args[i] = id
		if i > 0 {
			query += ","
		}
		if dbType == postgresDialect {
			query += fmt.Sprintf("$%d", i+1)
		} else {
			query += "?"
		}
	}
	query += ")"

	_, err = remoteDB.ExecContext(ctx, query, args...)
	return err
}

// syncUsers 同步用户表
func (s *SyncService) syncUsers(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTableUsers, dbType, userSyncValues)
}

func userSyncValues(u models.User) (int64, []interface{}) {
	return u.ID, []interface{}{u.ID, u.Username, u.Password, u.Name, u.Email, u.Phone, u.Avatar, u.Role, u.Department, u.Position, u.Status, u.LastLoginTime, u.CreateTime, u.UpdateTime}
}

// syncProjects 同步项目表
func (s *SyncService) syncProjects(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTableProjects, dbType, projectSyncValues)
}

func projectSyncValues(p models.Project) (int64, []interface{}) {
	return p.ID, []interface{}{p.ID, p.Name, p.Company, p.TotalAmount, p.ReceivedAmount, p.Status, p.Type, p.ContractNumber, p.ContractDate, p.PaymentMethod, p.StartDate, p.EndDate, p.Description, p.UserID, p.CreateTime, p.UpdateTime}
}

// syncPayments 同步收款表
func (s *SyncService) syncPayments(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTablePayments, dbType, paymentSyncValues)
}

func paymentSyncValues(p models.Payment) (int64, []interface{}) {
	return p.ID, []interface{}{p.ID, p.ProjectID, p.Stage, p.Amount, p.Percentage, p.PlanDate, p.Status, p.ActualDate, p.Method, p.Remark, p.UserID, p.CreateTime, p.UpdateTime}
}

func syncRecords[T any](ctx context.Context, service *SyncService, localDB *gorm.DB, remoteDB syncExecutor, table, dbType string, row func(T) (int64, []interface{})) (int64, string) {
	var records []T
	if err := localDB.WithContext(ctx).Find(&records).Error; err != nil {
		return 0, fmt.Sprintf("读取本地数据失败: %v", err)
	}
	if dbType != postgresDialect && dbType != mysqlDialect {
		return 0, fmt.Sprintf("不支持的数据库类型: %s", dbType)
	}
	query := ""
	if dbType == postgresDialect {
		var err error
		query, err = service.buildPostgresUpsertQuery(table)
		if err != nil {
			return 0, err.Error()
		}
	}
	ids := make([]interface{}, 0, len(records))
	for _, record := range records {
		id, args := row(record)
		ids = append(ids, id)
		var writeErr error
		if dbType == mysqlDialect {
			writeErr = service.executeMySQLMirrorRow(ctx, remoteDB, table, id, args)
		} else {
			_, writeErr = remoteDB.ExecContext(ctx, query, args...)
		}
		if writeErr != nil {
			return 0, fmt.Sprintf("同步失败: %v", writeErr)
		}
	}
	if err := service.deleteExtras(ctx, remoteDB, table, ids, dbType); err != nil {
		return 0, fmt.Sprintf("清理 %s 多余数据失败: %v", table, err)
	}
	return int64(len(records)), ""
}

// syncDictionaries 同步字典表
func (s *SyncService) syncDictionaries(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTableDictionaries, dbType, dictionarySyncValues)
}

func dictionarySyncValues(d models.Dictionary) (int64, []interface{}) {
	return d.ID, []interface{}{d.ID, d.Code, d.Name, d.Status, d.Remark, d.CreateTime, d.UpdateTime}
}

// syncDictionaryItems 同步字典项表
func (s *SyncService) syncDictionaryItems(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTableDictionaryItems, dbType, dictionaryItemSyncValues)
}

func dictionaryItemSyncValues(item models.DictionaryItem) (int64, []interface{}) {
	return item.ID, []interface{}{item.ID, item.DictionaryID, item.Label, item.Value, item.Sort, item.Status, item.Remark, item.CreateTime, item.UpdateTime}
}

// syncNotifications 同步通知表
func (s *SyncService) syncNotifications(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTableNotifications, dbType, notificationSyncValues)
}

func notificationSyncValues(n models.Notification) (int64, []interface{}) {
	return n.ID, []interface{}{n.ID, n.Title, n.Content, n.Type, n.SenderID, n.IsGlobal, n.CreateTime, n.UpdateTime}
}

// syncUserNotifications 同步用户通知关联表
func (s *SyncService) syncUserNotifications(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTableUserNotifications, dbType, userNotificationSyncValues)
}

func userNotificationSyncValues(un models.UserNotification) (int64, []interface{}) {
	return un.ID, []interface{}{un.ID, un.UserID, un.NotificationID, un.IsRead, un.ReadTime}
}

// syncPersonalAccessTokens 同步个人访问令牌表
func (s *SyncService) syncPersonalAccessTokens(ctx context.Context, localDB *gorm.DB, remoteDB syncExecutor, dbType string) (int64, string) {
	return syncRecords(ctx, s, localDB, remoteDB, syncTablePersonalAccessTokens, dbType, tokenSyncValues)
}

func tokenSyncValues(t models.PersonalAccessToken) (int64, []interface{}) {
	return t.ID, []interface{}{t.ID, t.UserID, t.Name, t.TokenHash, t.Scopes, t.Status, t.LastUsedAt, t.ExpiresAt, t.CreateTime, t.UpdateTime}
}

// buildPostgresUpsertQuery builds an ID-keyed upsert for PostgreSQL.
func (s *SyncService) buildPostgresUpsertQuery(table string) (string, error) {
	columns, ok := syncTableColumns[table]
	if !ok {
		return "", fmt.Errorf("invalid table name: %s", table)
	}

	quotedTable := s.quoteColumn(table, postgresDialect)
	quotedColumns := make([]string, 0, len(columns))
	placeholders := make([]string, 0, len(columns))
	updateSet := make([]string, 0, len(columns)-1)

	for i, col := range columns {
		quotedCol := s.quoteColumn(col, postgresDialect)
		quotedColumns = append(quotedColumns, quotedCol)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		if col != "id" {
			updateSet = append(updateSet, fmt.Sprintf("%s = EXCLUDED.%s", quotedCol, quotedCol))
		}
	}

	return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (%s) DO UPDATE SET %s",
		quotedTable,
		strings.Join(quotedColumns, ", "),
		strings.Join(placeholders, ", "),
		s.quoteColumn("id", postgresDialect),
		strings.Join(updateSet, ", ")), nil
}

func (s *SyncService) buildMySQLUpdateQuery(table string) (string, error) {
	columns, ok := syncTableColumns[table]
	if !ok {
		return "", fmt.Errorf("invalid table name: %s", table)
	}
	quotedTable := s.quoteColumn(table, mysqlDialect)
	updateSet := make([]string, 0, len(columns)-1)
	for _, column := range columns[1:] {
		quotedColumn := s.quoteColumn(column, mysqlDialect)
		updateSet = append(updateSet, fmt.Sprintf("%s = ?", quotedColumn))
	}
	return fmt.Sprintf("UPDATE %s SET %s WHERE %s = ?", quotedTable, strings.Join(updateSet, ", "), s.quoteColumn("id", mysqlDialect)), nil
}

func (s *SyncService) buildInsertQuery(table string, dbType string) (string, error) {
	columns, ok := syncTableColumns[table]
	if !ok {
		return "", fmt.Errorf("invalid table name: %s", table)
	}
	quotedColumns := make([]string, 0, len(columns))
	placeholders := make([]string, 0, len(columns))
	for index, column := range columns {
		quotedColumns = append(quotedColumns, s.quoteColumn(column, dbType))
		if dbType == postgresDialect {
			placeholders = append(placeholders, fmt.Sprintf("$%d", index+1))
		} else {
			placeholders = append(placeholders, "?")
		}
	}
	return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", s.quoteColumn(table, dbType), strings.Join(quotedColumns, ", "), strings.Join(placeholders, ", ")), nil
}

func (s *SyncService) executeMySQLMirrorRow(ctx context.Context, remoteDB syncExecutor, table string, id int64, values []interface{}) error {
	update, err := s.buildMySQLUpdateQuery(table)
	if err != nil {
		return err
	}
	updateArgs := append(append([]interface{}(nil), values[1:]...), id)
	result, err := remoteDB.ExecContext(ctx, update, updateArgs...)
	if err != nil {
		return err
	}
	matched, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("读取 %s 更新行数失败: %w", table, err)
	}
	if matched > 0 {
		return nil
	}
	insert, err := s.buildInsertQuery(table, mysqlDialect)
	if err != nil {
		return err
	}
	_, err = remoteDB.ExecContext(ctx, insert, values...)
	return err
}

func (s *SyncService) quoteSyncIdentifier(identifier string, dbType string) (string, error) {
	if err := s.validateTableName(identifier); err != nil {
		return "", err
	}
	return s.quoteColumn(identifier, dbType), nil
}

func (s *SyncService) quoteColumn(identifier string, dbType string) string {
	if dbType == postgresDialect {
		return `"` + identifier + `"`
	}
	return "`" + identifier + "`"
}
