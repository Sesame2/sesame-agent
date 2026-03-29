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
	BaseURL     string // 自定义 API base URL，兼容 Qwen / 其他 OpenAI-compatible 接口
	DBPath      string
}

func Load() *Config {
	_ = godotenv.Load("../.env") // 从项目根加载 .env，不存在则忽略

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		LLMProvider: getEnv("LLM_PROVIDER", "openai"),
		APIKey:      getEnv("API_KEY", ""),
		ModelName:   getEnv("MODEL_NAME", "gpt-4o"),
		BaseURL:     getEnv("BASE_URL", ""),
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
