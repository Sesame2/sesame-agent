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
