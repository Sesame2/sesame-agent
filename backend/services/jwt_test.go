package services

import "testing"

func TestGenerateAndParseToken(t *testing.T) {
	secret := "test-secret-key"
	userID := "user-abc-123"

	token, err := GenerateToken(userID, secret, 1)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	if token == "" {
		t.Fatal("token should not be empty")
	}

	parsedID, err := ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}
	if parsedID != userID {
		t.Errorf("expected user ID %s, got %s", userID, parsedID)
	}
}

func TestParseInvalidToken(t *testing.T) {
	_, err := ParseToken("invalid-token", "secret")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
}

func TestParseWrongSecret(t *testing.T) {
	token, _ := GenerateToken("user-1", "secret-a", 1)
	_, err := ParseToken(token, "secret-b")
	if err == nil {
		t.Fatal("expected error for wrong secret")
	}
}
