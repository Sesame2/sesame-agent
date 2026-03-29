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
