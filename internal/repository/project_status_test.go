package repository

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/primordialweave/zhusuan/internal/models"
)

func projectStatusFixture(t *testing.T) *ProjectRepository {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "project-status.db")), &gorm.Config{Logger: logger.Discard})
	require.NoError(t, err)
	raw, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, raw.Close()) })
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}))
	users := []models.User{{ID: 1, Username: "status-one", Password: "test"}, {ID: 2, Username: "status-two", Password: "test"}}
	require.NoError(t, db.Create(&users).Error)
	projects := []models.Project{
		{ID: 1, UserID: 1, Name: "match active", Company: "fixture", Status: "active"},
		{ID: 2, UserID: 1, Name: "completed", Company: "match company", Status: "completed"},
		{ID: 3, UserID: 1, Name: "match overdue", Company: "fixture", Status: "overdue"},
		{ID: 4, UserID: 1, Name: "match archived", Company: "fixture", Status: "archived"},
		{ID: 5, UserID: 1, Name: "active without keyword", Company: "fixture", Status: "active"},
		{ID: 6, UserID: 1, Name: "match legacy", Company: "fixture", Status: "processing"},
		{ID: 7, UserID: 2, Name: "match other active", Company: "fixture", Status: "active"},
		{ID: 8, UserID: 2, Name: "match other completed", Company: "fixture", Status: "completed"},
	}
	for i := range projects {
		projects[i].ContractNumber = projects[i].Name
		projects[i].CreateTime = time.Date(2026, 11, 23, 0, i, 0, 0, time.UTC)
	}
	require.NoError(t, db.Create(&projects).Error)
	return &ProjectRepository{db: db}
}

func projectIDs(projects []models.Project) []int64 {
	ids := make([]int64, 0, len(projects))
	for _, project := range projects {
		ids = append(ids, project.ID)
	}
	return ids
}

func TestProjectRepositoryListStatusUnionAndCompatibility(t *testing.T) {
	repo := projectStatusFixture(t)
	for _, tc := range []struct {
		name   string
		status string
		ids    []int64
	}{
		{"empty", "", []int64{6, 5, 4, 3, 2, 1}},
		{"all", "all", []int64{6, 5, 4, 3, 2, 1}},
		{"single", "active", []int64{5, 1}},
		{"stored overdue", "overdue", []int64{3}},
		{"multiple", "active,completed,overdue", []int64{5, 3, 2, 1}},
		{"whitespace and duplicates", " active, completed ,active,, ", []int64{5, 2, 1}},
		{"all mixed with statuses", "active, all,completed", []int64{6, 5, 4, 3, 2, 1}},
		{"empty tokens", " , , ", []int64{6, 5, 4, 3, 2, 1}},
		{"legacy value", "processing", []int64{6}},
		{"unknown", "unknown", []int64{}},
		{"unknown with known", "unknown,completed", []int64{2}},
		{"SQL-looking value is bound", "active' OR 1=1 --", []int64{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			projects, total, err := repo.List(1, tc.status, "", 1, 20)
			require.NoError(t, err)
			require.Equal(t, tc.ids, projectIDs(projects))
			require.Equal(t, int64(len(tc.ids)), total)
			for _, project := range projects {
				require.Equal(t, int64(1), project.UserID)
				require.NotNil(t, project.User, "owner preload remains available")
			}
		})
	}
}

func TestProjectRepositoryListStatusUnionKeepsKeywordAndPaginationScoped(t *testing.T) {
	repo := projectStatusFixture(t)
	for _, tc := range []struct {
		page int
		ids  []int64
	}{
		{1, []int64{3, 2}},
		{2, []int64{1}},
		{3, []int64{}},
	} {
		projects, total, err := repo.List(1, "active,completed,overdue,active", "match", tc.page, 2)
		require.NoError(t, err)
		require.Equal(t, int64(3), total)
		require.Equal(t, tc.ids, projectIDs(projects))
	}
	projects, total, err := repo.List(2, "active,completed,overdue", "match", 1, 20)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Equal(t, []int64{8, 7}, projectIDs(projects))
}
