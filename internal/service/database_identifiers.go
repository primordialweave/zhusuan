package service

// Shared identifiers keep administrative updates and ordered sync column lists consistent.
const (
	columnName       = "name"
	columnPassword   = "password"
	columnStatus     = "status"
	columnRemark     = "remark"
	columnUserID     = "user_id"
	columnCreateTime = "create_time"
	columnUpdateTime = "update_time"

	syncTableUsers                = "users"
	syncTableProjects             = "projects"
	syncTablePayments             = "payments"
	syncTableDictionaries         = "dictionaries"
	syncTableDictionaryItems      = "dictionary_item"
	syncTableNotifications        = "notifications"
	syncTableUserNotifications    = "user_notifications"
	syncTablePersonalAccessTokens = "personal_access_tokens"

	postgresDialect = "postgres"
	mysqlDialect    = "mysql"
)
