package cache

import (
	"sync"
	"time"
)

type entry[V any] struct {
	value     V
	createdAt time.Time
}

type Cache[K comparable, V any] struct {
	mu      sync.Mutex
	entries map[K]entry[V]
	maximum int
	ttl     time.Duration
	now     func() time.Time
}

func New[K comparable, V any](maximum int, ttl time.Duration) *Cache[K, V] {
	return &Cache[K, V]{entries: make(map[K]entry[V]), maximum: maximum, ttl: ttl, now: time.Now}
}

func (c *Cache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	value, ok := c.entries[key]
	if !ok {
		var zero V
		return zero, false
	}
	if c.now().Sub(value.createdAt) >= c.ttl {
		delete(c.entries, key)
		var zero V
		return zero, false
	}
	return value.value, true
}

func (c *Cache[K, V]) Set(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	for existingKey, existing := range c.entries {
		if now.Sub(existing.createdAt) >= c.ttl {
			delete(c.entries, existingKey)
		}
	}
	if _, exists := c.entries[key]; !exists && len(c.entries) >= c.maximum {
		var oldestKey K
		var oldestTime time.Time
		first := true
		for existingKey, existing := range c.entries {
			if first || existing.createdAt.Before(oldestTime) {
				oldestKey, oldestTime, first = existingKey, existing.createdAt, false
			}
		}
		if !first {
			delete(c.entries, oldestKey)
		}
	}
	c.entries[key] = entry[V]{value: value, createdAt: now}
}

func (c *Cache[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.entries)
}
