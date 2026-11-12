package refine

import (
	"context"
	"errors"
	"strings"
	"testing"
	"unicode/utf8"

	"promptizer/internal/provider"
)

type fakeProvider struct {
	calls    int
	response provider.Response
	err      error
	errors   []error
}

func (f *fakeProvider) Refine(context.Context, provider.Request) (provider.Response, error) {
	f.calls++
	if len(f.errors) > 0 {
		err := f.errors[0]
		f.errors = f.errors[1:]
		return f.response, err
	}
	return f.response, f.err
}

func TestExplicitRequestRetriesTransientFailureOnce(t *testing.T) {
	fake := &fakeProvider{
		response: provider.Response{Decision: "keep", RefinedPrompt: "valid prompt", Model: "fake"},
		errors:   []error{&provider.HTTPError{StatusCode: 503}},
	}
	result, err := NewService(fake).Refine(context.Background(), Request{Prompt: "valid prompt", AllowRetry: true})
	if err != nil || result.Decision != "keep" || fake.calls != 2 {
		t.Fatalf("result=%+v error=%v calls=%d", result, err, fake.calls)
	}
}

func TestLiveRequestDoesNotRetry(t *testing.T) {
	fake := &fakeProvider{errors: []error{&provider.HTTPError{StatusCode: 503}}}
	_, err := NewService(fake).Refine(context.Background(), Request{Prompt: "valid prompt"})
	if err == nil || fake.calls != 1 {
		t.Fatalf("error=%v calls=%d", err, fake.calls)
	}
}

func (f *fakeProvider) Model() string { return "fake" }

func TestMinimumPromptNeverCallsProvider(t *testing.T) {
	for _, prompt := range []string{"", "1234567", "  short  "} {
		fake := &fakeProvider{}
		_, err := NewService(fake).Refine(context.Background(), Request{Prompt: prompt})
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("prompt %q: got %v, want invalid input", prompt, err)
		}
		if fake.calls != 0 {
			t.Fatalf("prompt %q called provider %d times", prompt, fake.calls)
		}
	}
}

func TestEightCharacterPromptCallsProvider(t *testing.T) {
	fake := &fakeProvider{response: provider.Response{Decision: "keep", RefinedPrompt: "12345678", Model: "fake"}}
	result, err := NewService(fake).Refine(context.Background(), Request{Prompt: "12345678"})
	if err != nil {
		t.Fatal(err)
	}
	if fake.calls != 1 || result.Decision != "keep" {
		t.Fatalf("calls=%d result=%+v", fake.calls, result)
	}
}

func TestInputBounds(t *testing.T) {
	tests := []Request{
		{Prompt: strings.Repeat("a", MaxPromptBytes+1)},
		{Prompt: "valid prompt", TaskContext: strings.Repeat("c", MaxContextBytes+1)},
		{Prompt: "valid prompt", Constraints: make([]string, MaxConstraints+1)},
		{Prompt: "valid prompt", Constraints: []string{strings.Repeat("c", MaxConstraintBytes+1)}},
	}
	for _, request := range tests {
		if _, err := Validate(request); !errors.Is(err, ErrTooLarge) {
			t.Fatalf("Validate() error = %v, want too large", err)
		}
	}
}

func TestContextTrimmedBeforePrompt(t *testing.T) {
	request, err := Validate(Request{Prompt: strings.Repeat("p", 3000), TaskContext: strings.Repeat("á", 500)})
	if err != nil {
		t.Fatal(err)
	}
	if len([]byte(request.TaskContext)) > ApproxInputBytes-inputOverheadBytes-3000 {
		t.Fatalf("context bytes=%d", len([]byte(request.TaskContext)))
	}
	if !utf8.ValidString(request.TaskContext) {
		t.Fatal("trimmed context is invalid UTF-8")
	}
	if request.Prompt != strings.Repeat("p", 3000) {
		t.Fatal("current prompt was changed")
	}
}

func TestOutputValidation(t *testing.T) {
	tests := []struct {
		name     string
		decision string
		output   string
	}{
		{name: "unknown decision", decision: "maybe", output: "valid prompt"},
		{name: "empty", decision: "refine", output: ""},
		{name: "multiline", decision: "refine", output: "one\ntwo"},
		{name: "bullet", decision: "refine", output: "- one item"},
		{name: "too large", decision: "refine", output: strings.Repeat("a", MaxOutputBytes+1)},
		{name: "changed keep", decision: "keep", output: "different prompt"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validateOutput("valid prompt", test.decision, test.output); !errors.Is(err, ErrInvalidOutput) {
				t.Fatalf("validateOutput() error = %v", err)
			}
		})
	}
}
