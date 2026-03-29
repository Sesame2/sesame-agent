package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/middleware"
	"github.com/sesame-agent/backend/models"
)

// ListSessionsHandler 返回当前用户的所有会话，按创建时间倒序
func ListSessionsHandler(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user_id not found in context"})
		return
	}
	uid := userID.(string)

	var sessions []models.Session
	db.DB.Select("id, title, created_at").
		Where("user_id = ?", uid).
		Order("created_at DESC").
		Find(&sessions)

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

// DeleteSessionHandler 删除指定会话及其所有消息
func DeleteSessionHandler(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user_id not found in context"})
		return
	}
	uid := userID.(string)
	sessionID := c.Param("id")

	// 验证 session 属于当前用户
	var session models.Session
	if result := db.DB.Where("id = ? AND user_id = ?", sessionID, uid).First(&session); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	// 删除关联消息，再删除会话
	db.DB.Where("session_id = ?", sessionID).Delete(&models.Message{})
	db.DB.Delete(&session)

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
