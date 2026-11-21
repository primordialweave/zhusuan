package docs

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func swaggerObject(t *testing.T, value map[string]any, key string) map[string]any {
	t.Helper()
	require.IsType(t, map[string]any{}, value[key], "missing Swagger object %q", key)
	return value[key].(map[string]any)
}

func swaggerKeys(value map[string]any) []string {
	keys := make([]string, 0, len(value))
	for key := range value {
		keys = append(keys, key)
	}
	return keys
}

func TestSwaggerPublicInfoAndCollectionContracts(t *testing.T) {
	file, err := os.ReadFile("swagger.json")
	require.NoError(t, err)
	documents := map[string]map[string]any{}
	for name, data := range map[string][]byte{
		"runtime": []byte(SwaggerInfo.ReadDoc()),
		"json":    file,
	} {
		t.Run(name, func(t *testing.T) {
			var document map[string]any
			require.NoError(t, json.Unmarshal(data, &document))
			documents[name] = document
			security := swaggerObject(t, document, "securityDefinitions")
			require.Equal(t, map[string]any{"type": "apiKey", "in": "header", "name": "Authorization"}, security["Bearer"])
			definitions := swaggerObject(t, document, "definitions")
			stats := swaggerObject(t, definitions, "dto.Stats")
			properties := swaggerObject(t, stats, "properties")
			require.Equal(t, "number", swaggerObject(t, properties, "planned_received_amount")["type"])

			info := swaggerObject(t, definitions, "handler.SystemInfoResponse")
			require.ElementsMatch(t, []string{"version", "slogan", "wechat_public_account"}, swaggerKeys(swaggerObject(t, info, "properties")))
			update := swaggerObject(t, definitions, "updater.Release")
			require.ElementsMatch(t, []string{"tag_name", "html_url", "body", "draft", "prerelease", "assets"}, swaggerKeys(swaggerObject(t, update, "properties")))

			paths := swaggerObject(t, document, "paths")
			require.NotContains(t, paths, "/api/v1/system/check-update")
			for path, payload := range map[string]string{
				"/api/v1/system/info":          "handler.SystemInfoResponse",
				"/api/v1/system/updates/check": "updater.Release",
			} {
				operation := swaggerObject(t, swaggerObject(t, paths, path), "get")
				require.Equal(t, []any{map[string]any{"Bearer": []any{}}}, operation["security"])
				responses := swaggerObject(t, operation, "responses")
				require.Contains(t, responses, "401")
				schema := swaggerObject(t, swaggerObject(t, responses, "200"), "schema")
				require.IsType(t, []any{}, schema["allOf"])
				parts := schema["allOf"].([]any)
				require.Len(t, parts, 2)
				require.Equal(t, map[string]any{"$ref": "#/definitions/response.Response"}, parts[0])
				data := swaggerObject(t, swaggerObject(t, parts[1].(map[string]any), "properties"), "data")
				require.Equal(t, "#/definitions/"+payload, data["$ref"])
			}
		})
	}
	for _, section := range []string{"paths", "definitions", "securityDefinitions"} {
		require.Equal(t, documents["runtime"][section], documents["json"][section], "generated %s must match the runtime Swagger template", section)
	}
}
