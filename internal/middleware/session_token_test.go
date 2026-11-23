package middleware

import (
	"testing"
	"time"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/pkg/cache"
	"github.com/primordialweave/zhusuan/internal/pkg/jwt"
	"github.com/stretchr/testify/require"
)

func TestValidateSessionTokenReturnsVerifiedIdentityAndRejectsDisabledAccount(t *testing.T) {
	setupJWTAuthTestDB(t)
	previousKey, previousExpiry := jwt.SecretKey, jwt.TokenExpiry
	jwt.SecretKey, jwt.TokenExpiry = []byte("native-session-fixture-secret-32-bytes"), time.Hour
	t.Cleanup(func() { jwt.SecretKey, jwt.TokenExpiry = previousKey, previousExpiry })
	db := database.GetDB()
	user := models.User{ID: 991070, Username: "native-session-fixture", Password: "fixture", Status: 1}
	require.NoError(t, db.Create(&user).Error)
	t.Cleanup(func() {
		require.NoError(t, cache.Delete(cache.UserActiveKey(user.ID)))
		require.NoError(t, db.Delete(&user).Error)
	})
	token, err := jwt.GenerateToken(user.ID, user.Username, "user")
	require.NoError(t, err)
	identity, err := ValidateSessionToken(token)
	require.NoError(t, err)
	require.Equal(t, user.ID, identity)
	require.NoError(t, db.Model(&user).Update("status", 0).Error)
	require.NoError(t, cache.Delete(cache.UserActiveKey(user.ID)))
	identity, err = ValidateSessionToken(token)
	require.Error(t, err)
	require.Zero(t, identity)
	identity, err = ValidateSessionToken("pat_fixture")
	require.Error(t, err)
	require.Zero(t, identity)
}
