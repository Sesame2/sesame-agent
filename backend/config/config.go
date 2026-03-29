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
