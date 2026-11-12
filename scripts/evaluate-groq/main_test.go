package main

import "testing"

func TestIsParagraph(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "sentence", value: "Make the existing button sticky without changing its design.", want: true},
		{name: "empty", value: "  ", want: false},
		{name: "two lines", value: "First line.\nSecond line.", want: false},
		{name: "heading", value: "# Refined prompt", want: false},
		{name: "bullet", value: "- Preserve the design.", want: false},
		{name: "numbered", value: "1. Preserve the design.", want: false},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := isParagraph(test.value); got != test.want {
				t.Fatalf("isParagraph() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestLoadSelectedCases(t *testing.T) {
	t.Parallel()
	cases, err := loadCases("../../testdata/golden-prompts.jsonl", false)
	if err != nil {
		t.Fatal(err)
	}
	if len(cases) != 10 {
		t.Fatalf("loaded %d cases, want 10", len(cases))
	}
}
