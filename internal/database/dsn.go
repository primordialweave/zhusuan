package database

import (
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

// PostgresDSN quotes every connection value, preserving whitespace, quotes and backslashes.
// Keyword format also retains PostgreSQL's Unix-socket host support.
func PostgresDSN(host string, port int, user, password, name, sslMode string) string {
	quote := func(value string) string {
		value = strings.ReplaceAll(value, `\`, `\\`)
		value = strings.ReplaceAll(value, `'`, `\'`)
		return "'" + value + "'"
	}
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		quote(host), port, quote(user), quote(password), quote(name), quote(sslMode))
}

// MySQLDSN preserves credentials and brackets IPv6 addresses using the driver's formatter.
func MySQLDSN(host string, port int, user, password, name string) string {
	settings := mysql.NewConfig()
	settings.User, settings.Passwd, settings.DBName = user, password, name
	settings.Net, settings.Addr = "tcp", net.JoinHostPort(host, fmt.Sprint(port))
	settings.ParseTime, settings.Loc = true, time.Local
	settings.Params = map[string]string{"charset": "utf8mb4"}
	return settings.FormatDSN()
}
