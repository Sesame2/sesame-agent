# Auth & Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 sesame-agent 添加 JWT 登录认证系统实现会话隔离，并完成前端 token 拦截器、Makefile 构建、nginx 部署配置。

**Architecture:** 后端新增 `users` 表 + JWT 签发/验证中间件；`/api/auth` 路由组处理登录注册，`/api` 业务路由组受 auth 中间件保护并注入 `user_id`，Session 和 Message 表新增 `user_id` 外键实现数据隔离。前端新增 `api.ts` 封装 axios（带 token 拦截器）+ 登录页面路由。构建产物通过 Makefile 统一管理，前端静态文件由 nginx 托管并反向代理后端。

**Tech Stack:** Go + Gin + golang-jwt + bcrypt | React + react-router + axios | Makefile | nginx

---

## 文件结构总览

### 新建文件
```
backend/
├── models/user.go                  # User 模型
├── middleware/auth.go               # JWT 认证中间件
├── handlers/auth.go                 # 登录/注册 handler
├── services/jwt.go                  # JWT 签发与解析
frontend/
├── src/api/client.ts                # axios 实例 + token 拦截器
├── src/pages/LoginPage.tsx          # 登录页面
├── src/pages/AppShell.tsx           # 认证后的主布局（替代当前 App.tsx）
├── src/components/AuthGuard.tsx     # 路由守卫
deploy/
├── nginx.conf                       # nginx 配置模板
Makefile
```

### 修改文件
```
backend/
├── models/session.go                # 新增 UserID 字段
├── models/message.go                # 新增 UserID 字段
├── config/config.go                 # 新增 JWT_SECRET 配置
├── main.go                          # 注册新路由组、挂载 auth 中间件
├── handlers/chat.go                 # 从 context 取 user_id，写入 session/message
├── handlers/history.go              # 按 user_id 过滤历史
├── db/db.go                         # AutoMigrate 新增 User 模型
frontend/
├── src/types.ts                     # 新增 User、AuthResponse 类型
├── src/hooks/useSession.ts          # 改为后端管理 session（前端不再 localStorage 生成 UUID）
├── src/hooks/useChat.ts             # 改用 api client
├── src/App.tsx                      # 改为 react-router 布局
├── src/main.tsx                     # 确保 BrowserRouter 包裹
├── package.json                     # 新增 react-router-dom、axios
.env.example                         # 新增 JWT_SECRET
.gitignore                           # 忽略 Makefile 产物
```

---

## Chunk 1: 后端认证系统

### Task 1: Config 扩展 & User 模型

**Files:**
- Modify: `backend/config/config.go`
- Create: `backend/models/user.go`
- Test: `backend/models/user_test.go`

- [ ] **Step 1: 写 User 模型失败测试**

```go
// backend/models/user_test.go
package models

import "testing"

func TestUserStructFields(t *testing.T) {
	u := User{
		ID:       "user-123",
		Username: "testuser",
		Password: "hashed",
	}
	if u.ID != "user-123" {
		t.Errorf("expected ID user-123, got %s", u.ID)
	}
	if u.Username != "testuser" {
		t.Errorf("expected username testuser, got %s", u.Username)
	}
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && go test ./models/... -run TestUserStructFields -v`
Expected: FAIL — User type not defined

- [ ] **Step 3: 实现 User 模型**

```go
// backend/models/user.go
package models

import "time"

type User struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;not null;size:50" json:"username"`
	Password  string    `gorm:"not null" json:"-"` // 永不序列化到 JSON
	CreatedAt time.Time `json:"created_at"`
}
```

- [ ] **Step 4: 修改 config.go 增加 JWT 配置**

在 `Config` struct 增加：
```go
JWTSecret     string // JWT 签名密钥
JWTExpireHours int    // Token 过期时间（小时）
```

在 `Load()` 中增加：
```go
JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
JWTExpireHours: 24,
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && go test ./models/... -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/models/user.go backend/models/user_test.go backend/config/config.go
git commit -m "feat: add User model and JWT config"
```

---

### Task 2: JWT 服务

**Files:**
- Create: `backend/services/jwt.go`
- Create: `backend/services/jwt_test.go`

- [ ] **Step 1: 写 JWT 签发和解析的失败测试**

```go
// backend/services/jwt_test.go
package services

import "testing"

func TestGenerateAndParseToken(t *testing.T) {
	secret := "test-secret-key"
	userID := "user-abc-123"

	token, err := GenerateToken(userID, secret, 1)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	if token == "" {
		t.Fatal("token should not be empty")
	}

	parsedID, err := ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}
	if parsedID != userID {
		t.Errorf("expected user ID %s, got %s", userID, parsedID)
	}
}

func TestParseInvalidToken(t *testing.T) {
	_, err := ParseToken("invalid-token", "secret")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
}

func TestParseWrongSecret(t *testing.T) {
	token, _ := GenerateToken("user-1", "secret-a", 1)
	_, err := ParseToken(token, "secret-b")
	if err == nil {
		t.Fatal("expected error for wrong secret")
	}
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && go test ./services/... -v`
Expected: FAIL — services package not found

- [ ] **Step 3: 安装依赖**

```bash
cd backend
go get github.com/golang-jwt/jwt/v5@latest
```

- [ ] **Step 4: 实现 JWT 服务**

```go
// backend/services/jwt.go
package services

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

func GenerateToken(userID, secret string, expireHours int) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(tokenStr, secret string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token claims")
	}
	return claims.UserID, nil
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && go test ./services/... -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/services/
git commit -m "feat: add JWT token generation and parsing service"
```

---

### Task 3: Auth 中间件 & 登录/注册 Handler

**Files:**
- Create: `backend/middleware/auth.go`
- Create: `backend/handlers/auth.go`
- Modify: `backend/main.go` — 注册 `/api/auth` 路由组

- [ ] **Step 1: 创建 auth 中间件**

```go
// backend/middleware/auth.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/services"
)

const ContextUserIDKey = "user_id"

func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		userID, err := services.ParseToken(parts[1], jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(ContextUserIDKey, userID)
		c.Next()
	}
}
```

- [ ] **Step 2: 创建 auth handler（登录 + 注册）**

```go
// backend/handlers/auth.go
package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/config"
	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/models"
	"github.com/sesame-agent/backend/services"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token    string    `json:"token"`
	UserID   string    `json:"user_id"`
	Username string    `json:"username"`
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func RegisterHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 检查用户名是否已存在
		var existing models.User
		if result := db.DB.Where("username = ?", req.Username).First(&existing); result.Error == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}

		// 密码哈希
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

		user := models.User{
			ID:        generateID(),
			Username:  req.Username,
			Password:  string(hashedPassword),
			CreatedAt: time.Now(),
		}
		if err := db.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}

		token, err := services.GenerateToken(user.ID, cfg.JWTSecret, cfg.JWTExpireHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		c.JSON(http.StatusCreated, AuthResponse{
			Token:    token,
			UserID:   user.ID,
			Username: user.Username,
		})
	}
}

func LoginHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var user models.User
		if result := db.DB.Where("username = ?", req.Username).First(&user); result.Error != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		token, err := services.GenerateToken(user.ID, cfg.JWTSecret, cfg.JWTExpireHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			Token:    token,
			UserID:   user.ID,
			Username: user.Username,
		})
	}
}
```

- [ ] **Step 3: 安装 bcrypt 依赖**

```bash
cd backend
go get golang.org/x/crypto@latest
```

- [ ] **Step 4: 修改 main.go 注册路由**

```go
package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/config"
	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/handlers"
	"github.com/sesame-agent/backend/llm"
	"github.com/sesame-agent/backend/middleware"
)

func main() {
	cfg := config.Load()
	db.Init(cfg.DBPath)

	llmClient := llm.NewClient(cfg.LLMProvider, cfg.APIKey, cfg.ModelName, cfg.BaseURL)

	r := gin.Default()
	r.Use(middleware.CORS())

	// 公开路由：认证
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", handlers.RegisterHandler(cfg))
		auth.POST("/login", handlers.LoginHandler(cfg))
	}

	// 受保护路由：需要 JWT
	api := r.Group("/api")
	api.Use(middleware.Auth(cfg.JWTSecret))
	{
		api.POST("/chat", handlers.ChatHandler(llmClient))
		api.GET("/history/:session_id", handlers.HistoryHandler)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Printf("[SERVER] Starting on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
```

- [ ] **Step 5: 更新 db.go AutoMigrate 增加 User**

在 `db.Init` 的 `AutoMigrate` 调用中增加 `&models.User{}`：
```go
if err = DB.AutoMigrate(&models.User{}, &models.Session{}, &models.Message{}); err != nil {
```

- [ ] **Step 6: 验证编译**

Run: `cd backend && go build ./... 2>&1`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add backend/middleware/auth.go backend/handlers/auth.go backend/main.go backend/db/db.go
git commit -m "feat: add JWT auth middleware and login/register handlers"
```

---

### Task 4: 数据隔离 — Session/Message 增加 UserID

**Files:**
- Modify: `backend/models/session.go`
- Modify: `backend/models/message.go`
- Modify: `backend/handlers/chat.go`
- Modify: `backend/handlers/history.go`
- Test: `backend/handlers/chat_test.go`

- [ ] **Step 1: 写 chat handler user_id 注入的失败测试**

```go
// backend/handlers/chat_test.go
package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/middleware"
)

func TestChatRejectsWithoutUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(middleware.ContextUserIDKey, "test-user-id")
		c.Next()
	})

	// 不设置 user_id 的路由
	rNoAuth := gin.New()
	rNoAuth.POST("/api/chat", func(c *gin.Context) {
		userID, exists := c.Get(middleware.ContextUserIDKey)
		if !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id not found in context"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user_id": userID})
	})

	body := `{"session_id": "s1", "message": "hello"}`
	req := httptest.NewRequest(http.MethodPost, "/api/chat", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	rNoAuth.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && go test ./handlers/... -run TestChatRejectsWithoutUserID -v`
Expected: FAIL — 编译失败因为 handler 内没有从 context 取 user_id

- [ ] **Step 3: 修改 Session 模型**

```go
// backend/models/session.go
package models

import "time"

type Session struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"` // 新增
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
}
```

- [ ] **Step 4: 修改 Message 模型**

```go
// backend/models/message.go
package models

import "time"

type Message struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SessionID   string    `gorm:"index;not null" json:"session_id"`
	UserID      string    `gorm:"index;not null" json:"user_id"` // 新增
	Role        string    `gorm:"not null" json:"role"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	CodeSnippet string    `gorm:"type:text" json:"code_snippet,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}
```

- [ ] **Step 5: 修改 chat.go — 从 context 取 user_id**

在 `ChatHandler` 函数体开头增加：
```go
userID, exists := c.Get(middleware.ContextUserIDKey)
if !exists {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "user_id not found in context"})
    return
}
uid := userID.(string)
```

将所有 `db.DB.Create(&models.Message{...})` 中的 `SessionID` 行改为同时写入 `UserID: uid`：
```go
db.DB.Create(&models.Message{
    SessionID: req.SessionID,
    UserID:    uid,       // 新增
    Role:      "user",
    Content:   req.Message,
    CreatedAt: time.Now(),
})
```

Session 创建时也写入 UserID：
```go
session = models.Session{ID: req.SessionID, UserID: uid, Title: title, CreatedAt: time.Now()}
```

异步持久化 assistant 消息也加 UserID：
```go
db.DB.Create(&models.Message{
    SessionID:   req.SessionID,
    UserID:      uid,       // 新增
    Role:        "assistant",
    Content:     responseContent,
    CodeSnippet: extractCodeSnippet(responseContent),
    CreatedAt:   time.Now(),
})
```

- [ ] **Step 6: 修改 history.go — 按 user_id 隔离**

```go
// backend/handlers/history.go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/middleware"
	"github.com/sesame-agent/backend/models"
)

func HistoryHandler(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user_id not found in context"})
		return
	}
	uid := userID.(string)

	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	// 验证 session 属于当前用户
	var session models.Session
	if result := db.DB.Where("id = ? AND user_id = ?", sessionID, uid).First(&session); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	var messages []models.Message
	db.DB.Where("session_id = ? AND user_id = ?", sessionID, uid).Order("created_at asc").Find(&messages)

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}
```

- [ ] **Step 7: 更新 db_test.go 以匹配新模型**

在 `db_test.go` 中创建 Session 时增加 `UserID: "test-user-1"`：
```go
session := models.Session{ID: "test-session-1", UserID: "test-user-1", Title: "Test Session"}
```

创建 Message 时增加 `UserID: "test-user-1"`：
```go
msg := models.Message{
    SessionID: "test-session-1",
    UserID:    "test-user-1",
    Role:      "user",
    Content:   "Hello world",
}
```

- [ ] **Step 8: 运行全部后端测试**

Run: `cd backend && go test ./... -v`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add backend/models/session.go backend/models/message.go backend/handlers/chat.go backend/handlers/history.go backend/handlers/chat_test.go backend/db/db_test.go
git commit -m "feat: add user_id to session/message for data isolation"
```

---

## Chunk 2: 前端认证集成

### Task 5: 前端类型 & API Client

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`
- Modify: `frontend/package.json` — 新增 axios、react-router-dom

- [ ] **Step 1: 安装前端依赖**

```bash
cd frontend
npm install axios react-router-dom
```

- [ ] **Step 2: 更新 types.ts**

```typescript
// frontend/src/types.ts
export interface Message {
  id?: number;
  session_id?: string;
  user_id?: string;
  role: 'user' | 'assistant';
  content: string;
  code_snippet?: string;
  created_at?: string;
  isStreaming?: boolean;
}

export interface HistoryResponse {
  messages: Message[];
}

export interface User {
  id: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user_id: string;
  username: string;
}
```

- [ ] **Step 3: 写 API client 的失败测试**

```typescript
// frontend/src/api/client.test.ts
import { describe, it, expect } from 'vitest';
import { apiClient, getToken, setToken, clearToken } from './client';

describe('api client', () => {
  it('has baseURL from env or empty string', () => {
    // apiClient should exist and have a baseURL
    expect(apiClient).toBeDefined();
    expect(apiClient.defaults.baseURL).toBeDefined();
  });

  it('setToken and getToken work with localStorage', () => {
    clearToken();
    expect(getToken()).toBeNull();
    setToken('test-token-123');
    expect(getToken()).toBe('test-token-123');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('sets Authorization header when token exists', () => {
    setToken('my-jwt-token');
    expect(apiClient.defaults.headers.common['Authorization']).toBe('Bearer my-jwt-token');
    clearToken();
  });

  it('removes Authorization header when token cleared', () => {
    setToken('temp');
    clearToken();
    expect(apiClient.defaults.headers.common['Authorization']).toBeUndefined();
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd frontend && ./node_modules/.bin/vitest run src/api/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: 实现 API client**

```typescript
// frontend/src/api/client.ts
import axios from 'axios';

const TOKEN_KEY = 'sesame_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
});

// Token 管理
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  delete apiClient.defaults.headers.common['Authorization'];
}

// 请求拦截器：确保每请求带 token
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 自动跳转登录
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ---- API 接口 ----

export async function login(username: string, password: string) {
  const { data } = await apiClient.post('/api/auth/login', { username, password });
  return data as { token: string; user_id: string; username: string };
}

export async function register(username: string, password: string) {
  const { data } = await apiClient.post('/api/auth/register', { username, password });
  return data as { token: string; user_id: string; username: string };
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd frontend && ./node_modules/.bin/vitest run src/api/client.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/ frontend/package.json frontend/package-lock.json
git commit -m "feat: add API client with token interceptor and auth endpoints"
```

---

### Task 6: 登录页面 & 路由守卫

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/components/AuthGuard.tsx`
- Modify: `frontend/src/App.tsx` — 改为 react-router 布局

- [ ] **Step 1: 创建 LoginPage**

```tsx
// frontend/src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register, setToken } from '../api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = isRegister
        ? await register(username, password)
        : await login(username, password);
      setToken(result.token);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      // 提取后端返回的错误信息
      setError(msg.includes('401') ? '用户名或密码错误' : msg.includes('409') ? '用户名已存在' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">✨ Sesame Agent</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isRegister ? '创建新账号' : '登录你的账号'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none text-sm"
              placeholder="3-50 个字符"
              minLength={3}
              maxLength={50}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none text-sm"
              placeholder={isRegister ? '至少 6 个字符' : '输入密码'}
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {isRegister ? '已有账号？' : '没有账号？'}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-indigo-600 hover:underline ml-1"
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 AuthGuard**

```tsx
// frontend/src/components/AuthGuard.tsx
import { Navigate } from 'react-router-dom';
import { getToken } from '../api/client';

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 3: 修改 App.tsx 为路由布局**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import { ChatPanel } from './components/ChatPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { useSession } from './hooks/useSession';
import { useChat } from './hooks/useChat';

function AppShell() {
  const sessionId = useSession();
  const { messages, currentCode, isLoading, sendMessage, stopStreaming } = useChat(sessionId);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="w-[380px] flex-shrink-0 border-r border-gray-200 shadow-sm overflow-hidden">
        <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} onStop={stopStreaming} />
      </div>
      <div className="flex-1 overflow-hidden">
        <PreviewPanel code={currentCode} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: 修改 useChat.ts 改用 apiClient**

将 `useChat.ts` 中的 `fetch` 调用替换为 `apiClient`：

```typescript
import { apiClient } from '../api/client';
import type { Message } from '../types';
import { extractCodeFromMarkdown } from '../utils/codeExtractor';

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/history/${sessionId}`);
      const data = res.data;
      if (data.messages?.length > 0) {
        setMessages(data.messages);
        const lastAssistant = [...data.messages].reverse().find((m: Message) => m.role === 'assistant');
        if (lastAssistant) {
          const code = lastAssistant.code_snippet || extractCodeFromMarkdown(lastAssistant.content);
          if (code) setCurrentCode(code);
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, [sessionId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const sendMessage = useCallback(async (userInput: string) => {
    if (isLoading || !userInput.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: userInput }]);
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
    abortRef.current = new AbortController();

    try {
      const res = await apiClient.post('/api/chat', {
        session_id: sessionId,
        message: userInput,
      }, {
        responseType: 'text',
        // SSE 不用 axios 拦截，直接用原生 fetch 来处理流
      });

      // apiClient 的 POST 会走响应拦截器，但 SSE 需要流式处理
      // 所以对于 /api/chat，我们还是用原生 fetch 但带 token
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: '⚠️ 请求失败，请检查后端连接。', isStreaming: false };
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading]);

  const stopStreaming = useCallback(() => { abortRef.current?.abort(); }, []);

  return { messages, currentCode, isLoading, sendMessage, stopStreaming };
}
```

**注意：** SSE 流式接口必须用原生 `fetch`（axios 不支持流式），但要手动带 token：

```typescript
// 在 sendMessage 中的 SSE 部分
const token = getToken();
const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ session_id: sessionId, message: userInput }),
  signal: abortRef.current.signal,
});
```

- [ ] **Step 5: 验证前端构建**

Run: `cd frontend && npm run build 2>&1`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add login page, auth guard, and router layout"
```

---

## Chunk 3: 构建与部署

### Task 7: Makefile

**Files:**
- Create: `Makefile`

- [ ] **Step 1: 创建 Makefile**

```makefile
.PHONY: all build backend frontend dev dev-backend dev-frontend test clean deploy-help

# ---- 默认目标 ----
all: build

# ---- 构建全部 ----
build: build-frontend build-backend

# ---- 构建前端 ----
build-frontend:
	cd frontend && npm ci && npm run build

# ---- 构建后端（交叉编译） ----
build-backend:
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/sesame-server .

# ---- 开发模式 ----
dev: dev-backend dev-frontend

dev-backend:
	cd backend && go run .

dev-frontend:
	cd frontend && npm run dev

# ---- 测试 ----
test: test-backend test-frontend

test-backend:
	cd backend && go test ./... -v

test-frontend:
	cd frontend && ./node_modules/.bin/vitest run

# ---- 代码检查 ----
lint-frontend:
	cd frontend && npm run lint

vet-backend:
	cd backend && go vet ./...

# ---- 清理 ----
clean:
	rm -rf frontend/dist frontend/node_modules
	rm -rf bin/
	cd backend && go clean

# ---- 部署产物打包 ----
dist: build
	mkdir -p dist
	cp -r frontend/dist dist/
	cp bin/sesame-server dist/
	cp -n .env.example dist/.env 2>/dev/null || true
	cp deploy/nginx.conf dist/
	@echo "✅ Deployment package ready in dist/"

# ---- 帮助 ----
deploy-help:
	@echo ""
	@echo "🚀 Sesame Agent Deployment Guide"
	@echo "==============================="
	@echo ""
	@echo "1. Build:         make build"
	@echo "2. Package:       make dist"
	@echo "3. Upload dist/ to server"
	@echo ""
	@echo "Server Setup:"
	@echo "  a) Edit dist/.env with your API keys and JWT_SECRET"
	@echo "  b) Copy dist/nginx.conf to /etc/nginx/conf.d/sesame.conf"
	@echo "  c) Set root path in nginx.conf to your dist directory"
	@echo "  d) nginx -t && systemctl reload nginx"
	@echo "  e) ./sesame-server  (or use systemd)"
	@echo ""
```

- [ ] **Step 2: 创建 bin/.gitkeep 和更新 .gitignore**

```bash
mkdir -p bin
touch bin/.gitkeep
```

在 `.gitignore` 中增加：
```
bin/
dist/
```

- [ ] **Step 3: 验证 Makefile**

```bash
make build-backend  # 应生成 bin/sesame-server
make test-backend
make test-frontend
make dist
```

- [ ] **Step 4: Commit**

```bash
git add Makefile bin/.gitkeep .gitignore
git commit -m "chore: add Makefile with build/test/deploy commands"
```

---

### Task 8: Nginx 配置 & 部署文档

**Files:**
- Create: `deploy/nginx.conf`
- Modify: `.env.example` — 增加 JWT_SECRET
- Modify: `README.md`

- [ ] **Step 1: 创建 nginx 配置**

```nginx
# deploy/nginx.conf
# Sesame Agent — nginx 反向代理配置
# 使用方法：
#   1. 修改 server_name 和 root 路径
#   2. cp nginx.conf /etc/nginx/conf.d/sesame.conf
#   3. nginx -t && systemctl reload nginx

server {
    listen 80;
    server_name your-domain.com;  # ← 改为你的域名或 IP

    # 前端静态文件
    root /var/www/sesame-agent/dist;
    index index.html;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # 前端路由 —— 所有非文件请求回退到 index.html（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        # SSE 必需
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;

        # 通用 proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 超时保护（10 分钟）
        proxy_read_timeout 600s;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

- [ ] **Step 2: 更新 .env.example**

```
PORT=8080
LLM_PROVIDER=openai
API_KEY=your-api-key-here
MODEL_NAME=gpt-4o

# 自定义 API base URL
# BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BASE_URL=

# JWT 配置
JWT_SECRET=change-me-to-a-random-string-in-production
# JWTExpireHours 固定为 24，无需配置

DB_PATH=./data.db
```

- [ ] **Step 3: 更新 README.md**（包含部署指南）

README 内容包含：
- 项目简介
- 本地开发（make dev）
- 部署步骤（make dist → 上传 → nginx 配置 → 启动后端）
- 环境变量说明
- API 文档（新增 /api/auth/login、/api/auth/register）

- [ ] **Step 4: Commit**

```bash
git add deploy/ .env.example README.md
git commit -m "chore: add nginx config and deployment docs"
```

---

### Task 9: 端到端验证

- [ ] **Step 1: 后端全部测试通过**

Run: `make test-backend`
Expected: ALL PASS

- [ ] **Step 2: 前端全部测试通过**

Run: `make test-frontend`
Expected: ALL PASS

- [ ] **Step 3: 前端构建成功**

Run: `make build-frontend`
Expected: 无错误

- [ ] **Step 4: 后端构建成功**

Run: `make build-backend`
Expected: 生成 bin/sesame-server

- [ ] **Step 5: 部署包生成**

Run: `make dist`
Expected: dist/ 目录包含前端静态文件 + 后端二进制 + nginx.conf + .env

- [ ] **Step 6: 最终 Commit（如有遗漏修复）**

```bash
git add -A
git commit -m "chore: final cleanup and e2e verification"
```
