package database

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
)

func TestPostgresDSNPreservesQuotedCredentialsAndSocketHosts(t *testing.T) {
	for _, host := range []string{"localhost", "/tmp/pg socket", "::1"} {
		parsed, err := pgx.ParseConfig(PostgresDSN(host, 5432, "user name", `pass word'\ sslmode=disable`, "book name", "require"))
		require.NoError(t, err)
		require.Equal(t, host, parsed.Host)
		require.Equal(t, "user name", parsed.User)
		require.Equal(t, `pass word'\ sslmode=disable`, parsed.Password)
		require.Equal(t, "book name", parsed.Database)
		if host != "/tmp/pg socket" {
			require.NotNil(t, parsed.TLSConfig)
		}
	}
}
