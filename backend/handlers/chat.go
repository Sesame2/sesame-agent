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
	"github.com/sesame-agent/backend/middleware"
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

		// 从 auth 中间件获取 user_id
		userID, exists := c.Get(middleware.ContextUserIDKey)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user_id not found in context"})
			return
		}
		uid := userID.(string)

		// 1. 确保 Session 存在（且属于当前用户）
		var session models.Session
		if result := db.DB.Where("id = ? AND user_id = ?", req.SessionID, uid).First(&session); result.Error != nil {
			title := truncateTitle(req.Message, 20)
			session = models.Session{ID: req.SessionID, UserID: uid, Title: title, CreatedAt: time.Now()}
			db.DB.Create(&session)
		} else {
			// Session 已存在，如果是默认标题则用首条消息更新
			updateSessionTitleIfNeeded(req.SessionID, uid, req.Message)
		}

		// 2. 加载历史，构建 LLM 上下文
		var history []models.Message
		db.DB.Where("session_id = ? AND user_id = ?", req.SessionID, uid).Order("created_at asc").Find(&history)

		messages := []llm.ChatMessage{{Role: "system", Content: llm.SystemPrompt}}
		for _, h := range history {
			messages = append(messages, llm.ChatMessage{Role: h.Role, Content: h.Content})
		}
		messages = append(messages, llm.ChatMessage{Role: "user", Content: req.Message})

		// 3. 保存用户消息
		db.DB.Create(&models.Message{
			SessionID: req.SessionID,
			UserID:    uid,
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

		// sseWrite 同时写 SSE 输出流和内存 buffer
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
				UserID:      uid,
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
