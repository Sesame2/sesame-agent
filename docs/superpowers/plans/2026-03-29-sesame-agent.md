# sesame-agent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个类 Claude Artifacts / v0.dev 的 AI 全栈 Web 应用原型——用户输入自然语言，AI 生成前端代码并实时渲染在沙箱中，所有对话数据持久化到 SQLite。

**Architecture:** 前后端分离，Go + Gin 提供 REST API 和 SSE 流式输出，React (Vite) + Tailwind CSS 构建聊天+预览双栏 UI。AI 调用通过后端统一封装，支持 OpenAI / Anthropic 两种 provider。数据持久化使用 SQLite via GORM，零部署依赖。

**Tech Stack:** Go 1.22+, Gin, GORM + glebarez/sqlite (纯 Go, 无 cgo), React 18, Vite 5, Tailwind CSS v3, react-markdown, uuid

---

## 文件结构总览

```
sesame-agent/
├── backend/
│   ├── main.go                    # 程序入口：初始化 DB、路由、启动服务器
│   ├── go.mod / go.sum
│   ├── config/
│   │   └── config.go              # 环境变量读取 (PORT, LLM_PROVIDER, API_KEY, etc.)
│   ├── db/
│   │   ├── db.go                  # GORM 初始化 + AutoMigrate
│   │   └── db_test.go
│   ├── models/
│   │   ├── session.go             # Session 数据模型
│   │   └── message.go             # Message 数据模型
│   ├── handlers/
│   │   ├── chat.go                # POST /api/chat - SSE 流式响应
│   │   └── history.go             # GET /api/history/:session_id
│   ├── llm/
│   │   ├── client.go              # LLM 接口定义 + 工厂函数
│   │   ├── openai.go              # OpenAI GPT-4o 实现
│   │   └── anthropic.go           # Anthropic Claude 实现 (纯 HTTP)
│   └── middleware/
│       └── cors.go                # CORS 中间件
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── index.css              # @import "tailwindcss"
│       ├── App.tsx                # 根布局：双栏分割
│       ├── types.ts               # TypeScript 类型定义
│       ├── hooks/
│       │   ├── useSession.ts      # Session ID 管理 (localStorage + UUID)
│       │   └── useChat.ts         # 聊天状态、SSE 流式接收、历史加载
│       ├── components/
│       │   ├── ChatPanel.tsx      # 左栏：消息列表 + 输入框
│       │   ├── MessageBubble.tsx  # 单条消息（Markdown 渲染）
│       │   ├── PreviewPanel.tsx   # 右栏：iframe 代码预览
│       │   └── LoadingDots.tsx    # 流式输出动画
│       └── utils/
│           ├── codeExtractor.ts   # 从 Markdown 中正则提取 ```html 代码块
│           └── codeExtractor.test.ts
├── .env.example
├── .gitignore
└── README.md
```

---

## Chunk 1：项目基础设施

### Task 1: Go 模块初始化与依赖配置

**Files:**
- Create: `backend/go.mod`
- Create: `backend/config/config.go`
- Create: `backend/middleware/cors.go`

- [ ] **Step 1: 初始化 Go 模块**

```bash
cd /Users/mei/Desktop/Project/sesame-agent
mkdir -p backend && cd backend
go mod init github.com/sesame-agent/backend
```

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/backend
go get github.com/gin-gonic/gin@latest
go get gorm.io/gorm@latest
go get github.com/glebarez/sqlite@latest    # 纯 Go SQLite，无需 cgo
go get github.com/google/uuid@latest
go get github.com/joho/godotenv@latest
go get github.com/sashabaranov/go-openai@latest
```

> ⚠️ 使用 `github.com/glebarez/sqlite` 替代 `gorm.io/driver/sqlite`，避免 cgo 编译依赖，在无 gcc 环境下也可正常构建。

- [ ] **Step 3: 创建 `backend/config/config.go`**

```go
package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	LLMProvider string // "openai" | "anthropic"
	APIKey      string
	ModelName   string
	DBPath      string
}

func Load() *Config {
	_ = godotenv.Load("../.env") // 从项目根加载 .env，不存在则忽略

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		LLMProvider: getEnv("LLM_PROVIDER", "openai"),
		APIKey:      getEnv("API_KEY", ""),
		ModelName:   getEnv("MODEL_NAME", "gpt-4o"),
		DBPath:      getEnv("DB_PATH", "./data.db"),
	}

	if cfg.APIKey == "" {
		log.Println("[WARN] API_KEY not set. LLM calls will fail.")
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

- [ ] **Step 4: 创建 `backend/middleware/cors.go`**

```go
package middleware

import "github.com/gin-gonic/gin"

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
```

- [ ] **Step 5: 验证模块编译**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/backend
go build ./config/... ./middleware/...
```

Expected: 无错误

- [ ] **Step 6: Commit**

```bash
cd /Users/mei/Desktop/Project/sesame-agent
git add backend/
git commit -m "chore: init Go module and base config/middleware"
```

---

### Task 2: 数据库模型与初始化

**Files:**
- Create: `backend/models/session.go`
- Create: `backend/models/message.go`
- Create: `backend/db/db.go`
- Create: `backend/db/db_test.go`

- [ ] **Step 1: 创建 `backend/models/session.go`**

```go
package models

import "time"

type Session struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
}
```

- [ ] **Step 2: 创建 `backend/models/message.go`**

```go
package models

import "time"

type Message struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SessionID   string    `gorm:"index;not null" json:"session_id"`
	Role        string    `gorm:"not null" json:"role"` // "user" | "assistant"
	Content     string    `gorm:"type:text;not null" json:"content"`
	CodeSnippet string    `gorm:"type:text" json:"code_snippet,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}
```

- [ ] **Step 3: 创建 `backend/db/db.go`**

```go
package db

import (
	"log"

	"github.com/glebarez/sqlite"
	"github.com/sesame-agent/backend/models"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dsn string) {
	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err = DB.AutoMigrate(&models.Session{}, &models.Message{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	log.Println("[DB] SQLite initialized at", dsn)
}
```

- [ ] **Step 4: 编写数据库测试 `backend/db/db_test.go`**

```go
package db

import (
	"testing"

	"github.com/sesame-agent/backend/models"
)

func TestInitAndMigrate(t *testing.T) {
	Init(":memory:")

	// 插入 Session
	session := models.Session{ID: "test-session-1", Title: "Test Session"}
	if err := DB.Create(&session).Error; err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// 插入 Message
	msg := models.Message{
		SessionID: "test-session-1",
		Role:      "user",
		Content:   "Hello world",
	}
	if err := DB.Create(&msg).Error; err != nil {
		t.Fatalf("failed to create message: %v", err)
	}

	// 验证查询
	var count int64
	DB.Model(&models.Message{}).Where("session_id = ?", "test-session-1").Count(&count)
	if count != 1 {
		t.Errorf("expected 1 message, got %d", count)
	}
}
```

- [ ] **Step 5: 运行测试**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/backend
go test ./db/... -v
```

Expected: `--- PASS: TestInitAndMigrate`

- [ ] **Step 6: Commit**

```bash
git add backend/models/ backend/db/
git commit -m "feat: add database models and SQLite initialization"
```

---

## Chunk 2：核心 API

### Task 3: LLM 客户端封装

**Files:**
- Create: `backend/llm/client.go`
- Create: `backend/llm/openai.go`
- Create: `backend/llm/anthropic.go`

- [ ] **Step 1: 创建 `backend/llm/client.go`**

```go
package llm

import (
	"context"
	"io"
)

// ChatMessage 是发给 LLM 的消息格式
type ChatMessage struct {
	Role    string `json:"role"`    // "system" | "user" | "assistant"
	Content string `json:"content"`
}

// StreamClient 是 LLM 流式调用的统一接口
type StreamClient interface {
	StreamChat(ctx context.Context, messages []ChatMessage, writer io.Writer) error
}

// SystemPrompt 是注入给 LLM 的系统提示词
const SystemPrompt = `你是一个顶级的前端工程师（类似 Claude Artifacts）。
用户的需求会被发送给你，你需要思考并实现该需求。
请必须遵循以下规则：
1. 你的实现必须包含在一个完整的 HTML 文件中，包含内联的 CSS 和 JS。
2. 将代码包裹在 ` + "```html" + ` 标签中。
3. 请确保 UI 现代、美观，可以直接运行，无需额外的外部依赖（可使用 CDN 引入 Tailwind 或 React/Vue）。
4. 在代码块之前，先用1-2句话简短描述你的实现思路。`

// NewClient 根据 provider 创建对应的 LLM 客户端
func NewClient(provider, apiKey, modelName string) StreamClient {
	switch provider {
	case "anthropic":
		return NewAnthropicClient(apiKey, modelName)
	default:
		return NewOpenAIClient(apiKey, modelName)
	}
}
```

- [ ] **Step 2: 创建 `backend/llm/openai.go`**

```go
package llm

import (
	"context"
	"errors"
	"fmt"
	"io"

	openai "github.com/sashabaranov/go-openai"
)

type OpenAIClient struct {
	client    *openai.Client
	modelName string
}

func NewOpenAIClient(apiKey, modelName string) *OpenAIClient {
	return &OpenAIClient{
		client:    openai.NewClient(apiKey),
		modelName: modelName,
	}
}

func (c *OpenAIClient) StreamChat(ctx context.Context, messages []ChatMessage, writer io.Writer) error {
	oaiMessages := make([]openai.ChatCompletionMessage, len(messages))
	for i, m := range messages {
		oaiMessages[i] = openai.ChatCompletionMessage{Role: m.Role, Content: m.Content}
	}

	stream, err := c.client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
		Model:    c.modelName,
		Messages: oaiMessages,
		Stream:   true,
	})
	if err != nil {
		return fmt.Errorf("openai stream error: %w", err)
	}
	defer stream.Close()

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("stream recv error: %w", err)
		}
		if len(resp.Choices) > 0 {
			_, _ = writer.Write([]byte(resp.Choices[0].Delta.Content))
		}
	}
}
```

- [ ] **Step 3: 创建 `backend/llm/anthropic.go`**

```go
package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type AnthropicClient struct {
	apiKey    string
	modelName string
}

func NewAnthropicClient(apiKey, modelName string) *AnthropicClient {
	return &AnthropicClient{apiKey: apiKey, modelName: modelName}
}

func (c *AnthropicClient) StreamChat(ctx context.Context, messages []ChatMessage, writer io.Writer) error {
	var systemContent string
	var convMsgs []map[string]string
	for _, m := range messages {
		if m.Role == "system" {
			systemContent = m.Content
		} else {
			convMsgs = append(convMsgs, map[string]string{"role": m.Role, "content": m.Content})
		}
	}

	reqBody, _ := json.Marshal(map[string]any{
		"model":      c.modelName,
		"max_tokens": 8192,
		"system":     systemContent,
		"messages":   convMsgs,
		"stream":     true,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("anthropic request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("anthropic API error %d: %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var event struct {
			Type  string `json:"type"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}
		if event.Type == "content_block_delta" && event.Delta.Type == "text_delta" {
			_, _ = writer.Write([]byte(event.Delta.Text))
		}
	}
	return scanner.Err()
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/llm/
git commit -m "feat: add LLM client abstraction (OpenAI + Anthropic)"
```

---

### Task 4: Chat Handler (POST /api/chat — SSE)

**Files:**
- Create: `backend/handlers/chat.go`

- [ ] **Step 1: 创建 `backend/handlers/chat.go`**

```go
package handlers

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/llm"
	"github.com/sesame-agent/backend/models"
)

type ChatRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Message   string `json:"message" binding:"required"`
}

var codeBlockRegex = regexp.MustCompile("(?s)```(?:html|jsx?)\\s*\\n?(.*?)```")

func extractCodeSnippet(content string) string {
	matches := codeBlockRegex.FindStringSubmatch(content)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func ChatHandler(llmClient llm.StreamClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ChatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 1. 确保 Session 存在
		var session models.Session
		if result := db.DB.First(&session, "id = ?", req.SessionID); result.Error != nil {
			title := req.Message
			if len([]rune(title)) > 20 {
				title = string([]rune(title)[:20]) + "..."
			}
			session = models.Session{ID: req.SessionID, Title: title, CreatedAt: time.Now()}
			db.DB.Create(&session)
		}

		// 2. 加载历史，构建 LLM 上下文
		var history []models.Message
		db.DB.Where("session_id = ?", req.SessionID).Order("created_at asc").Find(&history)

		messages := []llm.ChatMessage{{Role: "system", Content: llm.SystemPrompt}}
		for _, h := range history {
			messages = append(messages, llm.ChatMessage{Role: h.Role, Content: h.Content})
		}
		messages = append(messages, llm.ChatMessage{Role: "user", Content: req.Message})

		// 3. 保存用户消息
		db.DB.Create(&models.Message{
			SessionID: req.SessionID,
			Role:      "user",
			Content:   req.Message,
			CreatedAt: time.Now(),
		})

		// 4. 设置 SSE headers
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")

		flusher, hasFlusher := c.Writer.(http.Flusher)
		var fullResponse bytes.Buffer

		// sseWriter 同时写 SSE 和内存 buffer
		sseWrite := func(p []byte) {
			fullResponse.Write(p)
			chunk := string(p)
			lines := strings.Split(chunk, "\n")
			for _, line := range lines {
				fmt.Fprintf(c.Writer, "data: %s\n", line)
			}
			fmt.Fprintf(c.Writer, "\n")
			if hasFlusher {
				flusher.Flush()
			}
		}

		// 5. 流式调用 LLM
		writerFunc := &funcWriter{fn: sseWrite}
		if err := llmClient.StreamChat(c.Request.Context(), messages, writerFunc); err != nil {
			log.Printf("[ERROR] LLM stream error: %v", err)
			fmt.Fprintf(c.Writer, "data: [ERROR] %s\n\n", err.Error())
			if hasFlusher {
				flusher.Flush()
			}
			return
		}

		fmt.Fprintf(c.Writer, "data: [DONE]\n\n")
		if hasFlusher {
			flusher.Flush()
		}

		// 6. 异步持久化 assistant 消息
		responseContent := fullResponse.String()
		go func() {
			db.DB.Create(&models.Message{
				SessionID:   req.SessionID,
				Role:        "assistant",
				Content:     responseContent,
				CodeSnippet: extractCodeSnippet(responseContent),
				CreatedAt:   time.Now(),
			})
		}()
	}
}

type funcWriter struct {
	fn func([]byte)
}

func (w *funcWriter) Write(p []byte) (int, error) {
	w.fn(p)
	return len(p), nil
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/handlers/chat.go
git commit -m "feat: add SSE chat handler"
```

---

### Task 5: History Handler + 主入口

**Files:**
- Create: `backend/handlers/history.go`
- Create: `backend/main.go`
- Create: `.env.example`

- [ ] **Step 1: 创建 `backend/handlers/history.go`**

```go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/models"
)

func HistoryHandler(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	var messages []models.Message
	db.DB.Where("session_id = ?", sessionID).Order("created_at asc").Find(&messages)

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}
```

- [ ] **Step 2: 创建 `backend/main.go`**

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

	llmClient := llm.NewClient(cfg.LLMProvider, cfg.APIKey, cfg.ModelName)

	r := gin.Default()
	r.Use(middleware.CORS())

	api := r.Group("/api")
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

- [ ] **Step 3: 创建 `.env.example`**

```
PORT=8080
LLM_PROVIDER=openai
API_KEY=your-api-key-here
MODEL_NAME=gpt-4o
DB_PATH=./data.db

# 前端构建
VITE_API_BASE_URL=http://localhost:8080
```

- [ ] **Step 4: 完整后端构建验证**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/backend
go build -o sesame-backend ./...
```

Expected: 生成 `sesame-backend` 可执行文件，无编译错误

- [ ] **Step 5: 运行所有后端测试**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/backend
go test ./... -v
```

Expected: `PASS` for all tests

- [ ] **Step 6: Commit**

```bash
git add backend/handlers/ backend/main.go .env.example
git commit -m "feat: add history handler and main server entry"
```

---

## Chunk 3：React 前端

### Task 6: Vite + React 项目脚手架

- [ ] **Step 1: 初始化 React + TypeScript + Vite 项目**

```bash
cd /Users/mei/Desktop/Project/sesame-agent
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/frontend
npm install react-markdown remark-gfm uuid
npm install -D @types/uuid vitest @vitest/ui
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: 修改 `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 4: 修改 `frontend/src/index.css`（替换全部内容）**

```css
@import "tailwindcss";
```

- [ ] **Step 5: 清理 Vite 默认文件**

删除 `frontend/src/App.css`，清空 `frontend/src/assets/` 目录内容

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold React + Vite + Tailwind frontend"
```

---

### Task 7: TypeScript 类型与工具函数

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/utils/codeExtractor.ts`
- Create: `frontend/src/utils/codeExtractor.test.ts`

- [ ] **Step 1: 创建 `frontend/src/types.ts`**

```typescript
export interface Message {
  id?: number;
  session_id?: string;
  role: 'user' | 'assistant';
  content: string;
  code_snippet?: string;
  created_at?: string;
  isStreaming?: boolean; // 前端流式状态，不存 DB
}

export interface HistoryResponse {
  messages: Message[];
}
```

- [ ] **Step 2: 创建 `frontend/src/utils/codeExtractor.ts`**

```typescript
/**
 * 从 Markdown 文本中提取第一个 ```html / ```jsx / ```js 代码块的内容
 */
export function extractCodeFromMarkdown(markdown: string): string | null {
  const regex = /```(?:html|jsx?)\s*\n?([\s\S]*?)```/;
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}
```

- [ ] **Step 3: 创建 `frontend/src/utils/codeExtractor.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { extractCodeFromMarkdown } from './codeExtractor';

describe('extractCodeFromMarkdown', () => {
  it('extracts html code block', () => {
    const md = 'Here is the app:\n```html\n<h1>Hello</h1>\n```';
    expect(extractCodeFromMarkdown(md)).toBe('<h1>Hello</h1>');
  });

  it('returns null when no code block', () => {
    expect(extractCodeFromMarkdown('just text')).toBeNull();
  });

  it('extracts jsx block', () => {
    const md = '```jsx\nconst App = () => <div>Hi</div>;\n```';
    expect(extractCodeFromMarkdown(md)).toContain('const App');
  });

  it('handles code with internal newlines', () => {
    const md = '```html\n<div>\n  <p>test</p>\n</div>\n```';
    expect(extractCodeFromMarkdown(md)).toContain('<p>test</p>');
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/frontend
npx vitest run src/utils/codeExtractor.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/utils/
git commit -m "feat: add TypeScript types and code extractor utility"
```

---

### Task 8: 自定义 Hooks

**Files:**
- Create: `frontend/src/hooks/useSession.ts`
- Create: `frontend/src/hooks/useChat.ts`

- [ ] **Step 1: 创建 `frontend/src/hooks/useSession.ts`**

```typescript
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY = 'sesame_session_id';

export function useSession(): string {
  const [sessionId] = useState<string>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const newId = uuidv4();
    localStorage.setItem(SESSION_KEY, newId);
    return newId;
  });
  return sessionId;
}
```

- [ ] **Step 2: 创建 `frontend/src/hooks/useChat.ts`**

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from '../types';
import { extractCodeFromMarkdown } from '../utils/codeExtractor';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 加载历史
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history/${sessionId}`);
      const data = await res.json();
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

    // 占位 assistant 消息
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userInput }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // 保留不完整的最后一行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          if (data.startsWith('[ERROR]')) { fullContent += `\n\n⚠️ ${data}`; break; }
          fullContent += data;
        }

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullContent, isStreaming: true };
          return updated;
        });

        const code = extractCodeFromMarkdown(fullContent);
        if (code) setCurrentCode(code);
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: fullContent, isStreaming: false };
        return updated;
      });

    } catch (e: any) {
      if (e.name !== 'AbortError') {
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

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add useSession and useChat hooks"
```

---

### Task 9: UI 组件

**Files:**
- Create: `frontend/src/components/LoadingDots.tsx`
- Create: `frontend/src/components/MessageBubble.tsx`
- Create: `frontend/src/components/ChatPanel.tsx`
- Create: `frontend/src/components/PreviewPanel.tsx`

- [ ] **Step 1: 创建 `frontend/src/components/LoadingDots.tsx`**

```tsx
export function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 `frontend/src/components/MessageBubble.tsx`**

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { LoadingDots } from './LoadingDots';

interface Props { message: Message; }

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
          AI
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
      }`}>
        {message.isStreaming && message.content === '' ? (
          <LoadingDots />
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }: any) {
                const isBlock = /language-/.test(className || '');
                return isBlock ? (
                  <pre className="bg-gray-800 text-green-300 rounded-lg p-3 overflow-x-auto text-xs my-2">
                    <code {...props}>{children}</code>
                  </pre>
                ) : (
                  <code className="bg-gray-200 text-red-600 px-1 rounded text-xs" {...props}>{children}</code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.isStreaming && message.content !== '' && (
          <span className="inline-block w-1 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 `frontend/src/components/ChatPanel.tsx`**

```tsx
import { useRef, useEffect, useState } from 'react';
import { Message } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
  isLoading: boolean;
  onSend: (msg: string) => void;
  onStop: () => void;
}

const EXAMPLES = ['做一个番茄钟 ⏱️', '写一个计算器 🔢', '创建一个待办事项 ✅'];

export function ChatPanel({ messages, isLoading, onSend, onStop }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => { if (!input.trim() || isLoading) return; onSend(input.trim()); setInput(''); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-200">
        <h1 className="font-semibold text-gray-900 text-sm">✨ Sesame Agent</h1>
        <p className="text-xs text-gray-400 mt-0.5">描述你的想法，AI 为你生成应用</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3">
            <div className="text-4xl">🪄</div>
            <p className="text-sm font-medium">告诉我你想构建什么</p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => onSend(ex)}
                  className="text-xs text-left px-3 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg border border-gray-200 transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none rounded-xl border border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none px-3 py-2 text-sm text-gray-800 placeholder-gray-400 max-h-32 min-h-[40px]"
            placeholder="描述你想要的应用..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          {isLoading ? (
            <button onClick={onStop} className="px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium transition-colors flex-shrink-0">
              ■ 停止
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium transition-colors flex-shrink-0">
              发送 ↑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 `frontend/src/components/PreviewPanel.tsx`**

```tsx
const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;
font-family:-apple-system,BlinkMacSystemFont,sans-serif;
background:linear-gradient(135deg,#f5f7fa 0%,#e8ecf0 100%);color:#94a3b8;}
.p{text-align:center}.i{font-size:3rem;margin-bottom:12px}p{font-size:.9rem}
</style></head><body><div class="p"><div class="i">🖼️</div><p>你的应用将在这里渲染</p></div></body></html>`;

export function PreviewPanel({ code }: { code: string }) {
  const htmlContent = code || PLACEHOLDER_HTML;
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <span className="text-xs text-gray-400 font-mono ml-2">
          {code ? '⚡ 预览' : '等待生成...'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          key={htmlContent}
          srcDoc={htmlContent}
          sandbox="allow-scripts allow-forms allow-modals"
          title="preview"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add Chat and Preview UI components"
```

---

### Task 10: App 根组件组合

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/index.html`

- [ ] **Step 1: 修改 `frontend/src/App.tsx`（替换全部内容）**

```tsx
import { ChatPanel } from './components/ChatPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { useSession } from './hooks/useSession';
import { useChat } from './hooks/useChat';

export default function App() {
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
```

- [ ] **Step 2: 修改 `frontend/src/main.tsx`（保持 StrictMode，清理默认样式引用）**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
```

- [ ] **Step 3: 修改 `frontend/index.html` 的 `<title>`**

将 `<title>Vite + React + TS</title>` 替换为 `<title>Sesame Agent ✨</title>`

- [ ] **Step 4: 前端构建验证**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/frontend
npm run build
```

Expected: `dist/` 生成，无 TypeScript 错误

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx frontend/index.html
git commit -m "feat: assemble root App component with dual-panel layout"
```

---

## Chunk 4：集成联调与部署配置

### Task 11: 本地联调验证

- [ ] **Step 1: 创建 `.gitignore`**

```gitignore
# Env & DB
.env
*.db
backend/sesame-backend

# Node
node_modules/
frontend/node_modules/
frontend/dist/

# IDE / OS
.DS_Store
.idea/
.vscode/
```

- [ ] **Step 2: 复制并配置本地 .env**

```bash
cp /Users/mei/Desktop/Project/sesame-agent/.env.example /Users/mei/Desktop/Project/sesame-agent/.env
# 编辑 .env，填入真实 API_KEY
```

- [ ] **Step 3: 启动后端并验证**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/backend
go run main.go &
curl http://localhost:8080/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: 启动前端开发服务器**

```bash
cd /Users/mei/Desktop/Project/sesame-agent/frontend
npm run dev
```

Expected: `Local: http://localhost:5173`

- [ ] **Step 5: 手动端到端测试**

打开 `http://localhost:5173`：
1. ✅ 双栏布局正常显示
2. ✅ 输入"做一个计算器"后，左侧流式显示 AI 回复
3. ✅ 右侧 iframe 渲染出计算器 HTML
4. ✅ 刷新页面后，历史记录和代码自动恢复
5. ✅ 点击"停止"按钮可中断生成

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: add gitignore and env template"
```

---

### Task 12: 更新 README

- [ ] **Step 1: 更新 `README.md`**

```markdown
# Sesame Agent ✨

> 一个类 Claude Artifacts 的 AI 全栈 Web 应用原型。用自然语言描述想法，AI 实时生成并渲染前端应用。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite 5 + Tailwind CSS |
| 后端 | Go + Gin + GORM |
| 数据库 | SQLite (无 cgo 依赖) |
| AI | OpenAI GPT-4o / Anthropic Claude (可配置) |

## 快速启动

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 API_KEY
```

### 2. 启动后端

```bash
cd backend && go run main.go
```

### 3. 启动前端

```bash
cd frontend && npm install && npm run dev
```

打开 http://localhost:5173 开始使用。

## 架构

```
用户输入 → POST /api/chat → LLM (SSE) → 前端实时渲染
                ↓
     SQLite 持久化 (sessions + messages)
```

## 部署

- **后端**: `go build -o sesame-backend && ./sesame-backend`
- **前端**: `npm run build`，部署到 Vercel，设置 `VITE_API_BASE_URL`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README"
```

---

## ✅ 完成检查清单

- [ ] `go test ./...` 全部通过
- [ ] `npm run build` 无 TypeScript 错误
- [ ] `npx vitest run` 4 tests PASS
- [ ] 前后端联调：流式响应正常显示
- [ ] 页面刷新后历史记录和代码恢复
- [ ] iframe 沙箱正确渲染生成的 HTML
- [ ] `.env` 未被提交到 git (`git status` 确认)

---

*计划生成时间: 2026-03-29*
*Spec 状态: ✅ Approved*
