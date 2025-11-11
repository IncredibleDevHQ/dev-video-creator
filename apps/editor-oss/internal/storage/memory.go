package storage

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sort"
	"sync"
	"time"

	"incredible.dev/editoross/internal/models"
)

var (
	ErrStoryNotFound    = errors.New("story not found")
	ErrFragmentNotFound = errors.New("fragment not found")
)

// MemoryStore is a threadsafe in-memory persistence layer. It is meant for bootstrapping only.
type MemoryStore struct {
	mu                sync.RWMutex
	stories           map[string]models.Story
	fragments         map[string]models.Fragment
	fragmentRevisions map[string][]models.FragmentRevision
}

// NewMemoryStore seeds the store with a demo story so the editor has something to render.
func NewMemoryStore() *MemoryStore {
	store := &MemoryStore{
		stories:           make(map[string]models.Story),
		fragments:         make(map[string]models.Fragment),
		fragmentRevisions: make(map[string][]models.FragmentRevision),
	}
	store.seed()
	return store
}

func (m *MemoryStore) seed() {
	storyID := newID()
	now := time.Now().UTC()

	story := models.Story{
		ID:        storyID,
		Title:     "Welcome to the OSS Editor",
		Summary:   "A sample storyboard demonstrating intro, code, and outro fragments.",
		CreatedAt: now,
		UpdatedAt: now,
	}

	introID := newID()
	codeID := newID()
	outroID := newID()

	intro := models.Fragment{
		ID:       introID,
		StoryID:  storyID,
		Name:     "Intro",
		Order:    0,
		Markdown: "# Hello Incredible!\nWe're rebuilding the editor with open tooling.",
		View: models.BlockView{
			Layout:      "classic",
			Mode:        "landscape",
			AspectRatio: "16:9",
			Note:        "Set the stage with a friendly greeting.",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	code := models.Fragment{
		ID:       codeID,
		StoryID:  storyID,
		Name:     "Code Walkthrough",
		Order:    1,
		Markdown: "```ts\nconst greet = (name: string) => `Welcome ${name}!`\n```\n\nExplain how the new pipeline works while highlighting key lines.",
		View: models.BlockView{
			Layout:     "code-left",
			Mode:       "landscape",
			Theme:      "monokai",
			Animation:  "highlight",
			Highlights: []int{2},
			Note:       "Animate highlight between lines 1-2.",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	outro := models.Fragment{
		ID:       outroID,
		StoryID:  storyID,
		Name:     "Outro",
		Order:    2,
		Markdown: "Thanks for watching! 🎬\n\nSubscribe for updates on the OSS rewrite.",
		View: models.BlockView{
			Layout:      "outro",
			Mode:        "landscape",
			AspectRatio: "16:9",
			Tags:        []string{"call-to-action"},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	story.Fragments = []models.Fragment{intro, code, outro}

	m.stories[storyID] = story
	m.fragments[introID] = intro
	m.fragments[codeID] = code
	m.fragments[outroID] = outro
}

// ListStories returns every story in insertion order (sorted by updatedAt desc).
func (m *MemoryStore) ListStories() []models.Story {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stories := make([]models.Story, 0, len(m.stories))
	for _, s := range m.stories {
		stories = append(stories, s)
	}

	// Sort newest first so the UI can show most recent work on top.
	sortStoriesByUpdatedAt(stories)
	return stories
}

// GetStory returns a story and a bool describing if it exists.
func (m *MemoryStore) GetStory(id string) (models.Story, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	story, ok := m.stories[id]
	return story, ok
}

// CreateStory inserts a new story with optional initial fragments.
func (m *MemoryStore) CreateStory(story models.Story) models.Story {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	if story.ID == "" {
		story.ID = newID()
	}
	story.CreatedAt = now
	story.UpdatedAt = now

	for i := range story.Fragments {
		if story.Fragments[i].ID == "" {
			story.Fragments[i].ID = newID()
		}
		story.Fragments[i].StoryID = story.ID
		story.Fragments[i].CreatedAt = now
		story.Fragments[i].UpdatedAt = now
		m.fragments[story.Fragments[i].ID] = story.Fragments[i]
	}

	m.stories[story.ID] = story
	return story
}

// UpdateStory replaces an existing story and its fragments atomically.
func (m *MemoryStore) UpdateStory(story models.Story) (models.Story, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.stories[story.ID]; !ok {
		return models.Story{}, ErrStoryNotFound
	}

	now := time.Now().UTC()
	story.UpdatedAt = now

	// Remove old fragments tied to this story.
	for _, frag := range m.stories[story.ID].Fragments {
		delete(m.fragments, frag.ID)
	}

	for i := range story.Fragments {
		if story.Fragments[i].ID == "" {
			story.Fragments[i].ID = newID()
		}
		story.Fragments[i].StoryID = story.ID
		story.Fragments[i].CreatedAt = now
		story.Fragments[i].UpdatedAt = now
		m.fragments[story.Fragments[i].ID] = story.Fragments[i]
	}

	m.stories[story.ID] = story
	return story, nil
}

// DeleteStory removes a story and its fragments.
func (m *MemoryStore) DeleteStory(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	story, ok := m.stories[id]
	if !ok {
		return ErrStoryNotFound
	}
	for _, frag := range story.Fragments {
		delete(m.fragments, frag.ID)
	}
	delete(m.stories, id)
	return nil
}

// ListFragments returns the fragments for a story in order.
func (m *MemoryStore) ListFragments(storyID string) ([]models.Fragment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	story, ok := m.stories[storyID]
	if !ok {
		return nil, ErrStoryNotFound
	}
	frags := append([]models.Fragment(nil), story.Fragments...)
	sort.Slice(frags, func(i, j int) bool {
		if frags[i].Order == frags[j].Order {
			return frags[i].CreatedAt.Before(frags[j].CreatedAt)
		}
		return frags[i].Order < frags[j].Order
	})
	return frags, nil
}

// GetFragment fetches a fragment by story and fragment ID.
func (m *MemoryStore) GetFragment(storyID, fragmentID string) (models.Fragment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	story, ok := m.stories[storyID]
	if !ok {
		return models.Fragment{}, ErrStoryNotFound
	}

	for _, frag := range story.Fragments {
		if frag.ID == fragmentID {
			return frag, nil
		}
	}
	return models.Fragment{}, ErrFragmentNotFound
}

// CreateFragment appends a new fragment to a story.
func (m *MemoryStore) CreateFragment(storyID string, fragment models.Fragment) (models.Fragment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	story, ok := m.stories[storyID]
	if !ok {
		return models.Fragment{}, ErrStoryNotFound
	}

	now := time.Now().UTC()
	if fragment.ID == "" {
		fragment.ID = newID()
	}
	fragment.StoryID = storyID
	fragment.CreatedAt = now
	fragment.UpdatedAt = now

	// Auto-assign order if not specified
	if fragment.Order == 0 {
		maxOrder := 0
		for _, f := range story.Fragments {
			if f.Order > maxOrder {
				maxOrder = f.Order
			}
		}
		fragment.Order = maxOrder + 1
	}

	story.Fragments = append(story.Fragments, fragment)
	story.UpdatedAt = now

	m.fragments[fragment.ID] = fragment
	m.stories[storyID] = story
	return fragment, nil
}

// UpdateFragment updates an existing fragment in-place.
func (m *MemoryStore) UpdateFragment(storyID string, fragment models.Fragment) (models.Fragment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	story, ok := m.stories[storyID]
	if !ok {
		return models.Fragment{}, ErrStoryNotFound
	}

	idx := -1
	for i, frag := range story.Fragments {
		if frag.ID == fragment.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return models.Fragment{}, ErrFragmentNotFound
	}

	now := time.Now().UTC()
	fragment.StoryID = storyID
	fragment.CreatedAt = story.Fragments[idx].CreatedAt
	fragment.UpdatedAt = now

	story.Fragments[idx] = fragment
	story.UpdatedAt = now

	m.fragments[fragment.ID] = fragment
	m.stories[storyID] = story
	return fragment, nil
}

// DeleteFragment removes a fragment from a story.
func (m *MemoryStore) DeleteFragment(storyID, fragmentID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	story, ok := m.stories[storyID]
	if !ok {
		return ErrStoryNotFound
	}

	idx := -1
	for i, frag := range story.Fragments {
		if frag.ID == fragmentID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return ErrFragmentNotFound
	}

	story.Fragments = append(story.Fragments[:idx], story.Fragments[idx+1:]...)
	story.UpdatedAt = time.Now().UTC()

	delete(m.fragments, fragmentID)
	delete(m.fragmentRevisions, fragmentID)
	m.stories[storyID] = story
	return nil
}

// ListFragmentRevisions returns revisions for a given fragment.
func (m *MemoryStore) ListFragmentRevisions(storyID, fragmentID string) ([]models.FragmentRevision, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if _, ok := m.stories[storyID]; !ok {
		return nil, ErrStoryNotFound
	}
	if _, ok := m.fragments[fragmentID]; !ok {
		return nil, ErrFragmentNotFound
	}

	revs := m.fragmentRevisions[fragmentID]
	result := make([]models.FragmentRevision, len(revs))
	copy(result, revs)
	return result, nil
}

// CreateFragmentRevision stores a new revision record.
func (m *MemoryStore) CreateFragmentRevision(
	storyID string,
	revision models.FragmentRevision,
) (models.FragmentRevision, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	story, ok := m.stories[storyID]
	if !ok {
		return models.FragmentRevision{}, ErrStoryNotFound
	}
	if _, ok := m.fragments[revision.FragmentID]; !ok {
		return models.FragmentRevision{}, ErrFragmentNotFound
	}

	now := time.Now().UTC()
	if revision.ID == "" {
		revision.ID = newID()
	}
	revision.StoryID = storyID
	revision.CreatedAt = now

	m.fragmentRevisions[revision.FragmentID] = append(
		m.fragmentRevisions[revision.FragmentID],
		revision,
	)

	// Update story timestamp to reflect latest revision.
	story.UpdatedAt = now
	m.stories[storyID] = story
	return revision, nil
}

func sortStoriesByUpdatedAt(stories []models.Story) {
	sort.Slice(stories, func(i, j int) bool {
		return stories[i].UpdatedAt.After(stories[j].UpdatedAt)
	})
}

// newID generates a cryptographically secure random ID.
func newID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based ID if crypto/rand fails
		return base64.RawURLEncoding.EncodeToString([]byte(time.Now().Format(time.RFC3339Nano)))[:12]
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
