package db

import (
	"log"

	"github.com/glebarez/sqlite"
	"github.com/sesame-agent/backend/models"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dsn string) {
	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err = DB.AutoMigrate(&models.User{}, &models.Session{}, &models.Message{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	log.Println("[DB] SQLite initialized at", dsn)
}
