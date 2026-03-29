package models

import "testing"

func TestUserStructFields(t *testing.T) {
	u := User{
		ID:        "user-123",
		Username:  "testuser",
		Password:  "hashed",
	}
	if u.ID != "user-123" {
		t.Errorf("expected ID user-123, got %s", u.ID)
	}
	if u.Username != "testuser" {
		t.Errorf("expected username testuser, got %s", u.Username)
	}
	if u.Password != "hashed" {
		t.Errorf("expected password hashed, got %s", u.Password)
	}
}
