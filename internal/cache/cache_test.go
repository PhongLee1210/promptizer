package cache

import (
	"testing"
	"time"
)

func TestBoundedAndExpiring(t *testing.T) {
	now := time.Unix(100, 0)
	cache := New[string, string](2, time.Minute)
	cache.now = func() time.Time { return now }
	cache.Set("one", "1")
	now = now.Add(time.Second)
	cache.Set("two", "2")
	now = now.Add(time.Second)
	cache.Set("three", "3")
	if _, ok := cache.Get("one"); ok {
		t.Fatal("oldest entry was not evicted")
	}
	if cache.Len() != 2 {
		t.Fatalf("len=%d", cache.Len())
	}
	now = now.Add(time.Minute)
	if _, ok := cache.Get("two"); ok {
		t.Fatal("expired entry returned")
	}
}
