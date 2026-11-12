package api

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateAndLoadToken(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config", "token")
	token, err := GenerateToken(path)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		t.Fatalf("invalid token")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("permissions=%o", info.Mode().Perm())
	}
	loaded, err := LoadToken(path)
	if err != nil || loaded != token {
		t.Fatalf("loaded=%q error=%v", loaded, err)
	}
}
