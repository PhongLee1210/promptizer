package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestRefineRejectsPromptArgument(t *testing.T) {
	err := run([]string{"refine", "secret prompt"}, strings.NewReader(""), &bytes.Buffer{}, &bytes.Buffer{})
	if err == nil || !strings.Contains(err.Error(), "stdin") {
		t.Fatalf("error=%v", err)
	}
}

func TestReadBounded(t *testing.T) {
	if _, err := readBounded(strings.NewReader("12345"), 4); err == nil {
		t.Fatal("expected size error")
	}
	value, err := readBounded(strings.NewReader("  prompt  \n"), 20)
	if err != nil || value != "prompt" {
		t.Fatalf("value=%q error=%v", value, err)
	}
}

func TestShortPromptRejectedBeforeCredentialLookup(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "")
	err := run([]string{"refine"}, strings.NewReader("short"), &bytes.Buffer{}, &bytes.Buffer{})
	if err == nil || !strings.Contains(err.Error(), "at least 8") {
		t.Fatalf("error=%v", err)
	}
}
