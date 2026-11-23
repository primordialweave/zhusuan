package jwt

import (
	"testing"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func TestParseTokenRequiresIssuedAlgorithmExpiryAndPositiveIdentity(t *testing.T) {
	for _, tc := range []struct {
		name    string
		method  jwtlib.SigningMethod
		id      int64
		expires bool
		valid   bool
	}{
		{"issued token", jwtlib.SigningMethodHS256, 1, true, true},
		{"other HMAC algorithm", jwtlib.SigningMethodHS512, 1, true, false},
		{"missing expiration", jwtlib.SigningMethodHS256, 1, false, false},
		{"zero identity", jwtlib.SigningMethodHS256, 0, true, false},
		{"negative identity", jwtlib.SigningMethodHS256, -1, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims := Claims{UserID: tc.id}
			if tc.expires {
				claims.ExpiresAt = jwtlib.NewNumericDate(time.Now().Add(time.Hour))
			}
			encoded, err := jwtlib.NewWithClaims(tc.method, claims).SignedString(SecretKey)
			require.NoError(t, err)
			parsed, err := ParseToken(encoded)
			if tc.valid {
				require.NoError(t, err)
				require.Equal(t, tc.id, parsed.UserID)
			} else {
				require.Error(t, err)
				require.Nil(t, parsed)
			}
		})
	}
}
