package api

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func DefaultTokenPath() (string, error) {
	directory, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(directory, "promptrefine", "token"), nil
}

func GenerateToken(path string) (string, error) {
	if path == "" {
		var err error
		path, err = DefaultTokenPath()
		if err != nil {
			return "", err
		}
	}
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(bytes)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", err
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), ".token-*")
	if err != nil {
		return "", err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return "", err
	}
	if _, err := temporary.WriteString(token + "\n"); err != nil {
		temporary.Close()
		return "", err
	}
	if err := temporary.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return "", err
	}
	return token, nil
}

func LoadToken(path string) (string, error) {
	if path == "" {
		var err error
		path, err = DefaultTokenPath()
		if err != nil {
			return "", err
		}
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if info.Mode().Perm()&0o077 != 0 {
		return "", errors.New("pairing token permissions must be 0600")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	token := strings.TrimSpace(string(data))
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		return "", fmt.Errorf("pairing token is invalid")
	}
	return token, nil
}
