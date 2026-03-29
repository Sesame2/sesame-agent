package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/config"
	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/middleware"
	"github.com/sesame-agent/backend/models"
	"github.com/sesame-agent/backend/services"
)

func setupSessionRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{JWTSecret: "test-secret", JWTExpireHours: 24}

	// 内存数据库
	db.Init(":memory:")
	db.DB.AutoMigrate(&models.User{}, &models.Session{}, &models.Message{})

	// 创建测试用户
	user := models.User{ID: "user-1", Username: "tester", Password: "$2a$10$xx"}
	db.DB.Create(&user)

	router := gin.New()
	router.Use(middleware.CORS())
	router.Use(middleware.Auth(cfg.JWTSecret))

	api := router.Group("/api")
	{
		api.POST("/sessions", CreateSessionHandler)
		api.GET("/sessions", ListSessionsHandler)
		api.DELETE("/sessions/:id", DeleteSessionHandler)
	}

	return router
}

func generateTestToken(t *testing.T) string {
	t.Helper()
	token, err := services.GenerateToken("user-1", "test-secret", 24)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestListSessionsHandler_Empty(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	req := httptest.NewRequest("GET", "/api/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		Sessions []models.Session `json:"sessions"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if len(resp.Sessions) != 0 {
		t.Fatalf("expected 0 sessions, got %d", len(resp.Sessions))
	}
}

func TestListSessionsHandler_WithData(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	// 创建一些 sessions
	db.DB.Create(&models.Session{ID: "s1", UserID: "user-1", Title: "Session 1"})
	db.DB.Create(&models.Session{ID: "s2", UserID: "user-1", Title: "Session 2"})

	req := httptest.NewRequest("GET", "/api/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		Sessions []models.Session `json:"sessions"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if len(resp.Sessions) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(resp.Sessions))
	}
}

func TestListSessionsHandler_DataIsolation(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	// 为另一个用户创建 session
	db.DB.Create(&models.Session{ID: "s-other", UserID: "user-other", Title: "Other"})

	req := httptest.NewRequest("GET", "/api/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var resp struct {
		Sessions []models.Session `json:"sessions"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if len(resp.Sessions) != 0 {
		t.Fatalf("expected 0 sessions (data isolation), got %d", len(resp.Sessions))
	}
}

func TestDeleteSessionHandler_Success(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	db.DB.Create(&models.Session{ID: "s1", UserID: "user-1", Title: "To Delete"})

	req := httptest.NewRequest("DELETE", "/api/sessions/s1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 验证已删除
	var count int64
	db.DB.Where("id = ?", "s1").Count(&count)
	if count != 0 {
		t.Fatal("session should be deleted")
	}
}

func TestDeleteSessionHandler_NotFound(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	req := httptest.NewRequest("DELETE", "/api/sessions/nonexistent", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestDeleteSessionHandler_CrossUser(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	// 其他用户的 session
	db.DB.Create(&models.Session{ID: "s-other", UserID: "user-other", Title: "Other"})

	req := httptest.NewRequest("DELETE", "/api/sessions/s-other", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 (cross-user), got %d", w.Code)
	}
}

func TestCreateSessionHandler_Success(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	body := `{"title":"新会话"}`
	req := httptest.NewRequest("POST", "/api/sessions", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.Session
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.ID == "" {
		t.Fatalf("expected non-empty session ID, got: %s", w.Body.String())
	}
	if resp.Title != "新会话" {
		t.Fatalf("expected title '新会话', got '%s'", resp.Title)
	}
	if resp.UserID != "user-1" {
		t.Fatalf("expected user_id 'user-1', got '%s'", resp.UserID)
	}

	// 验证 session 在数据库中
	var found models.Session
	result := db.DB.Where("id = ?", resp.ID).First(&found)
	if result.Error != nil {
		t.Fatalf("session should exist in DB: %v (resp.ID=%s)", result.Error, resp.ID)
	}
}

func TestCreateSessionHandler_DefaultTitle(t *testing.T) {
	router := setupSessionRouter(t)
	token := generateTestToken(t)

	body := `{}`
	req := httptest.NewRequest("POST", "/api/sessions", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.Session
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Title != "新会话" {
		t.Fatalf("expected default title '新会话', got '%s'", resp.Title)
	}
}
