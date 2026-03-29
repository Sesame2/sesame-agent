package handlers

import (
	"testing"
	"unicode/utf8"
)

func TestShouldUpdateSessionTitle(t *testing.T) {
	tests := []struct {
		name     string
		current  string
		expected bool
	}{
		{"default title should update", "新会话", true},
		{"empty title should update", "", true},
		{"custom title should not update", "我的项目", false},
		{"custom title should not update 2", "Build a dashboard", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := shouldUpdateSessionTitle(tt.current)
			if result != tt.expected {
				t.Errorf("shouldUpdateSessionTitle(%q) = %v, want %v", tt.current, result, tt.expected)
			}
		})
	}
}

func TestTruncateTitle(t *testing.T) {
	tests := []struct {
		input    string
		maxRunes int
		expected string
	}{
		{"short", 20, "short"},
		{"12345678901234567890", 20, "12345678901234567890"},
		{"123456789012345678901", 20, "12345678901234567890..."},
		{"这是一个超过二十个字符的标题用来测试截断功能", 20, "这是一个超过二十个字符的标题用来测试截断..."},
		{"hello world this is a long title", 10, "hello worl..."},
		{"", 20, ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := truncateTitle(tt.input, tt.maxRunes)
			if result != tt.expected {
				t.Errorf("truncateTitle(%q, %d) = %q, want %q", tt.input, tt.maxRunes, result, tt.expected)
			}
			// Verify length constraint (result should be at most maxRunes + 3 for "...")
			if utf8.RuneCountInString(result) > tt.maxRunes+3 {
				t.Errorf("truncateTitle result too long: %d runes", utf8.RuneCountInString(result))
			}
		})
	}
}
