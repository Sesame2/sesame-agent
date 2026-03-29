package handlers

import (
	"strings"

	"github.com/sesame-agent/backend/db"
	"github.com/sesame-agent/backend/models"
)

// defaultSessionTitle 是新建会话时的默认标题
const defaultSessionTitle = "新会话"

// shouldUpdateSessionTitle 判断是否应该更新会话标题
// 只有默认标题（"新会话"）或空标题才需要更新
func shouldUpdateSessionTitle(currentTitle string) bool {
	return currentTitle == "" || currentTitle == defaultSessionTitle
}

// truncateTitle 将标题截断到 maxRunes 个字符，超出部分加 "..."
func truncateTitle(title string, maxRunes int) string {
	runes := []rune(title)
	if len(runes) <= maxRunes {
		return title
	}
	return string(runes[:maxRunes]) + "..."
}

// updateSessionTitleIfNeeded 在需要时更新会话标题为首条消息内容
// 返回是否执行了更新
func updateSessionTitleIfNeeded(sessionID string, userID string, firstMessage string) bool {
	var session models.Session
	if result := db.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session); result.Error != nil {
		return false
	}

	if !shouldUpdateSessionTitle(session.Title) {
		return false
	}

	newTitle := truncateTitle(strings.TrimSpace(firstMessage), 20)
	if newTitle == "" {
		newTitle = defaultSessionTitle
	}

	db.DB.Model(&session).Update("title", newTitle)
	return true
}
