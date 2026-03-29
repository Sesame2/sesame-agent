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
