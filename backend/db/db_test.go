package db

import (
	"testing"

	"github.com/sesame-agent/backend/models"
)

func TestInitAndMigrate(t *testing.T) {
	Init(":memory:")

	// 插入 Session
	session := models.Session{ID: "test-session-1", UserID: "test-user-1", Title: "Test Session"}
	if err := DB.Create(&session).Error; err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// 插入 Message
	msg := models.Message{
		SessionID: "test-session-1",
		UserID:    "test-user-1",
		Role:      "user",
		Content:   "Hello world",
	}
	if err := DB.Create(&msg).Error; err != nil {
		t.Fatalf("failed to create message: %v", err)
	}

	// 验证查询
	var count int64
	DB.Model(&models.Message{}).Where("session_id = ? AND user_id = ?", "test-session-1", "test-user-1").Count(&count)
	if count != 1 {
		t.Errorf("expected 1 message, got %d", count)
	}

	// 验证用户隔离：其他用户查不到
	var otherCount int64
	DB.Model(&models.Message{}).Where("session_id = ? AND user_id = ?", "test-session-1", "other-user").Count(&otherCount)
	if otherCount != 0 {
		t.Errorf("expected 0 messages for other user, got %d", otherCount)
	}
}
